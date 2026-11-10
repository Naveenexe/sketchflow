package com.sketchflow.websocket;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sketchflow.dto.BoardDto;
import com.sketchflow.entity.BoardRole;
import com.sketchflow.service.BoardService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

@Component
public class CollabWebSocketHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(CollabWebSocketHandler.class);
    private static final int MAX_EVENT_HISTORY = 1000;
    private static final String[] CURSOR_COLORS = {
        "#6366f1", "#ec4899", "#10b981", "#f59e0b", "#06b6d4", "#8b5cf6", "#ef4444"
    };

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final BoardService boardService;

    private final Map<String, BoardRoom> boardRooms = new ConcurrentHashMap<>();
    private final Map<String, String> sessionBoardMap = new ConcurrentHashMap<>();

    public CollabWebSocketHandler(BoardService boardService) {
        this.boardService = boardService;
    }

    @Override
    public void afterConnectionEstablished(@NonNull WebSocketSession session) {
        Object userId = session.getAttributes().get("userId");
        log.info("Authenticated WebSocket connected: session={} userId={}", session.getId(), userId);
    }

    @Override
    protected void handleTextMessage(@NonNull WebSocketSession session, @NonNull TextMessage message) {
        try {
            JsonNode root = objectMapper.readTree(message.getPayload());
            String type = root.has("type") ? root.get("type").asText() : "";
            String boardId = root.has("boardId") ? root.get("boardId").asText() : "";
            String eventId = root.has("eventId") ? root.get("eventId").asText() : UUID.randomUUID().toString();

            String userIdStr = (String) session.getAttributes().get("userId");
            String displayName = (String) session.getAttributes().getOrDefault("displayName", "User");

            if (userIdStr == null) {
                sendError(session, "UNAUTHORIZED", "Authentication required");
                return;
            }

            switch (type) {
                case "JOIN_BOARD" -> handleJoinBoard(session, boardId, userIdStr, displayName);
                case "LEAVE_BOARD" -> leaveCurrentRoom(session);
                case "SCENE_UPDATE" -> handleSceneUpdate(session, root, eventId, userIdStr, displayName);
                case "CURSOR_UPDATE" -> handleCursorUpdate(session, root, eventId, userIdStr, displayName);
                case "PRESENCE_PING" -> handlePresencePing(session);
                case "REQUEST_SYNC" -> handleRequestSync(session, userIdStr);
                default -> sendError(session, "UNKNOWN_EVENT", "Unsupported event type: " + type);
            }
        } catch (Exception e) {
            log.warn("Error handling WebSocket message from session {}: {}", session.getId(), e.getMessage());
            sendError(session, "INVALID_MESSAGE", "Malformed collaboration message");
        }
    }

    private void handleJoinBoard(WebSocketSession session, String boardId, String userIdStr, String displayName) {
        if (boardId == null || boardId.isBlank()) {
            sendError(session, "BAD_REQUEST", "boardId is required");
            return;
        }

        UUID boardUuid;
        UUID userUuid;
        try {
            boardUuid = UUID.fromString(boardId);
            userUuid = UUID.fromString(userIdStr);
        } catch (IllegalArgumentException e) {
            sendError(session, "BAD_REQUEST", "Invalid boardId or userId format");
            return;
        }

        BoardDto board;
        BoardRole role;
        try {
            board = boardService.getBoard(boardUuid, userUuid);
            role = BoardRole.valueOf(board.getUserRole());
        } catch (SecurityException e) {
            sendError(session, "FORBIDDEN", e.getMessage());
            return;
        } catch (IllegalArgumentException e) {
            sendError(session, "NOT_FOUND", e.getMessage());
            return;
        }

        // Leave previous room if switching
        leaveCurrentRoom(session);

        BoardRoom room = boardRooms.computeIfAbsent(boardId, k -> new BoardRoom());
        String color = CURSOR_COLORS[Math.abs(userIdStr.hashCode()) % CURSOR_COLORS.length];
        ParticipantInfo participant = new ParticipantInfo(session, userIdStr, displayName, role, color);

        room.participants.put(session.getId(), participant);
        sessionBoardMap.put(session.getId(), boardId);

        log.info("User {} ({}) joined board room {} as {}", displayName, userIdStr, boardId, role);

        // Send initial authoritative BOARD_STATE to joining client
        sendMessage(session, Map.of(
                "type", "BOARD_STATE",
                "boardId", boardId,
                "userId", userIdStr,
                "eventId", UUID.randomUUID().toString(),
                "version", board.getVersion(),
                "sequence", room.sequence.get(),
                "timestamp", System.currentTimeMillis(),
                "payload", Map.of(
                        "sceneJson", board.getSceneJson() != null ? board.getSceneJson() : "{\"elements\":[]}",
                        "role", role.name(),
                        "participants", room.getParticipantSnapshots()
                )
        ));

        // Broadcast updated presence to all room members
        broadcastPresence(boardId, room);
    }

    private void handleSceneUpdate(
            WebSocketSession session,
            JsonNode root,
            String eventId,
            String userIdStr,
            String displayName
    ) {
        String boardId = sessionBoardMap.get(session.getId());
        if (boardId == null) {
            sendError(session, "NOT_IN_ROOM", "Join a board before sending scene updates");
            return;
        }

        BoardRoom room = boardRooms.get(boardId);
        if (room == null) return;

        ParticipantInfo sender = room.participants.get(session.getId());
        if (sender == null) return;

        // FR-COLLAB-06 & FR-SHARE-07: Enforce read-only viewer restriction
        if (sender.role == BoardRole.VIEWER) {
            sendError(session, "FORBIDDEN", "Viewers cannot submit editing operations");
            return;
        }

        // FR-COLLAB-08: Idempotent duplicate event filtering
        if (!room.markEventSeen(eventId)) {
            log.debug("Ignoring duplicate eventId={} in room={}", eventId, boardId);
            return;
        }

        long seq = room.sequence.incrementAndGet();
        JsonNode payloadNode = root.has("payload") ? root.get("payload") : root;

        Map<String, Object> outbound = new HashMap<>();
        outbound.put("type", "SCENE_UPDATE");
        outbound.put("boardId", boardId);
        outbound.put("userId", userIdStr);
        outbound.put("displayName", displayName);
        outbound.put("eventId", eventId);
        outbound.put("sequence", seq);
        outbound.put("timestamp", System.currentTimeMillis());
        outbound.put("payload", payloadNode);

        broadcastToOthers(room, session.getId(), outbound);
    }

    private void handleCursorUpdate(
            WebSocketSession session,
            JsonNode root,
            String eventId,
            String userIdStr,
            String displayName
    ) {
        String boardId = sessionBoardMap.get(session.getId());
        if (boardId == null) return;

        BoardRoom room = boardRooms.get(boardId);
        if (room == null) return;

        ParticipantInfo sender = room.participants.get(session.getId());
        if (sender == null) return;

        JsonNode payloadNode = root.has("payload") ? root.get("payload") : root;

        Map<String, Object> outbound = new HashMap<>();
        outbound.put("type", "CURSOR_UPDATE");
        outbound.put("boardId", boardId);
        outbound.put("userId", userIdStr);
        outbound.put("displayName", displayName);
        outbound.put("color", sender.color);
        outbound.put("eventId", eventId);
        outbound.put("timestamp", System.currentTimeMillis());
        outbound.put("payload", payloadNode);

        broadcastToOthers(room, session.getId(), outbound);
    }

    private void handlePresencePing(WebSocketSession session) {
        String boardId = sessionBoardMap.get(session.getId());
        if (boardId == null) return;
        BoardRoom room = boardRooms.get(boardId);
        if (room == null) return;

        sendMessage(session, Map.of(
                "type", "PRESENCE_UPDATE",
                "boardId", boardId,
                "eventId", UUID.randomUUID().toString(),
                "timestamp", System.currentTimeMillis(),
                "payload", Map.of("participants", room.getParticipantSnapshots())
        ));
    }

    private void handleRequestSync(WebSocketSession session, String userIdStr) {
        String boardId = sessionBoardMap.get(session.getId());
        if (boardId == null) {
            sendError(session, "NOT_IN_ROOM", "Join a board before requesting sync");
            return;
        }
        BoardRoom room = boardRooms.get(boardId);
        if (room == null) return;

        try {
            BoardDto board = boardService.getBoard(UUID.fromString(boardId), UUID.fromString(userIdStr));
            sendMessage(session, Map.of(
                    "type", "BOARD_STATE",
                    "boardId", boardId,
                    "userId", userIdStr,
                    "eventId", UUID.randomUUID().toString(),
                    "version", board.getVersion(),
                    "sequence", room.sequence.get(),
                    "timestamp", System.currentTimeMillis(),
                    "payload", Map.of(
                            "sceneJson", board.getSceneJson() != null ? board.getSceneJson() : "{\"elements\":[]}",
                            "role", board.getUserRole(),
                            "participants", room.getParticipantSnapshots()
                    )
            ));
        } catch (Exception e) {
            sendError(session, "SYNC_FAILED", "Could not resynchronize board state");
        }
    }

    private void broadcastPresence(String boardId, BoardRoom room) {
        Map<String, Object> msg = Map.of(
                "type", "PRESENCE_UPDATE",
                "boardId", boardId,
                "eventId", UUID.randomUUID().toString(),
                "timestamp", System.currentTimeMillis(),
                "payload", Map.of("participants", room.getParticipantSnapshots())
        );
        for (ParticipantInfo p : room.participants.values()) {
            sendMessage(p.session, msg);
        }
    }

    private void broadcastToOthers(BoardRoom room, String senderSessionId, Map<String, Object> data) {
        try {
            String json = objectMapper.writeValueAsString(data);
            TextMessage textMessage = new TextMessage(json);
            for (ParticipantInfo p : room.participants.values()) {
                if (p.session.isOpen() && !p.session.getId().equals(senderSessionId)) {
                    synchronized (p.session) {
                        p.session.sendMessage(textMessage);
                    }
                }
            }
        } catch (IOException e) {
            log.warn("Failed broadcasting message: {}", e.getMessage());
        }
    }

    private void sendError(WebSocketSession session, String code, String message) {
        sendMessage(session, Map.of(
                "type", "ERROR",
                "eventId", UUID.randomUUID().toString(),
                "timestamp", System.currentTimeMillis(),
                "payload", Map.of("code", code, "message", message)
        ));
    }

    private void sendMessage(WebSocketSession session, Map<String, Object> data) {
        if (!session.isOpen()) return;
        try {
            String json = objectMapper.writeValueAsString(data);
            synchronized (session) {
                session.sendMessage(new TextMessage(json));
            }
        } catch (IOException e) {
            log.warn("Failed sending WS message to {}: {}", session.getId(), e.getMessage());
        }
    }

    private void leaveCurrentRoom(WebSocketSession session) {
        String boardId = sessionBoardMap.remove(session.getId());
        if (boardId == null) return;

        BoardRoom room = boardRooms.get(boardId);
        if (room != null) {
            room.participants.remove(session.getId());
            if (room.participants.isEmpty()) {
                boardRooms.remove(boardId);
            } else {
                broadcastPresence(boardId, room);
            }
        }
        log.info("Session {} left board room {}", session.getId(), boardId);
    }

    @Override
    public void afterConnectionClosed(@NonNull WebSocketSession session, @NonNull CloseStatus status) {
        leaveCurrentRoom(session);
        log.info("WebSocket closed: session={} status={}", session.getId(), status);
    }

    private static class BoardRoom {
        final Map<String, ParticipantInfo> participants = new ConcurrentHashMap<>();
        final AtomicLong sequence = new AtomicLong(0);
        final Set<String> seenEventIds = new HashSet<>();
        private final Deque<String> eventOrder = new ArrayDeque<>();

        synchronized boolean markEventSeen(String eventId) {
            if (eventId == null || eventId.isBlank()) return true;
            if (seenEventIds.contains(eventId)) return false;
            seenEventIds.add(eventId);
            eventOrder.addLast(eventId);
            if (eventOrder.size() > MAX_EVENT_HISTORY) {
                String oldest = eventOrder.removeFirst();
                seenEventIds.remove(oldest);
            }
            return true;
        }

        List<Map<String, String>> getParticipantSnapshots() {
            List<Map<String, String>> list = new ArrayList<>();
            for (ParticipantInfo p : participants.values()) {
                list.add(Map.of(
                        "userId", p.userId,
                        "displayName", p.displayName,
                        "role", p.role.name(),
                        "color", p.color
                ));
            }
            return list;
        }
    }

    private record ParticipantInfo(
            WebSocketSession session,
            String userId,
            String displayName,
            BoardRole role,
            String color
    ) {}
}
