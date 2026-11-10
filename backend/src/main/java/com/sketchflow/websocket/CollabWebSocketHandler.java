package com.sketchflow.websocket;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class CollabWebSocketHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(CollabWebSocketHandler.class);
    private final ObjectMapper objectMapper = new ObjectMapper();

    // Map: boardId -> Set of active WebSocketSession
    private final Map<String, Set<WebSocketSession>> boardRooms = new ConcurrentHashMap<>();
    // Map: sessionId -> boardId
    private final Map<String, String> sessionBoardMap = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(@NonNull WebSocketSession session) {
        log.info("WebSocket connected: session id {}", session.getId());
    }

    @Override
    protected void handleTextMessage(@NonNull WebSocketSession session, @NonNull TextMessage message) throws Exception {
        try {
            JsonNode root = objectMapper.readTree(message.getPayload());
            String type = root.has("type") ? root.get("type").asText() : "";
            String boardId = root.has("boardId") ? root.get("boardId").asText() : "";

            switch (type) {
                case "JOIN_BOARD" -> {
                    if (!boardId.isBlank()) {
                        boardRooms.computeIfAbsent(boardId, k -> ConcurrentHashMap.newKeySet()).add(session);
                        sessionBoardMap.put(session.getId(), boardId);
                        log.info("Session {} joined room {}", session.getId(), boardId);

                        // Acknowledge join
                        session.sendMessage(new TextMessage(objectMapper.writeValueAsString(Map.of(
                                "type", "ROOM_JOINED",
                                "boardId", boardId,
                                "peerCount", boardRooms.get(boardId).size()
                        ))));
                    }
                }
                case "LEAVE_BOARD" -> leaveCurrentRoom(session);
                case "SCENE_UPDATE", "CURSOR_UPDATE" -> {
                    String activeBoardId = sessionBoardMap.get(session.getId());
                    if (activeBoardId != null) {
                        broadcastToRoom(activeBoardId, session, message);
                    }
                }
                default -> log.debug("Received event: {}", type);
            }
        } catch (Exception e) {
            log.warn("Error handling websocket payload: {}", e.getMessage());
        }
    }

    private void broadcastToRoom(String boardId, WebSocketSession sender, TextMessage message) {
        Set<WebSocketSession> sessions = boardRooms.get(boardId);
        if (sessions == null) return;

        for (WebSocketSession s : sessions) {
            if (s.isOpen() && !s.getId().equals(sender.getId())) {
                try {
                    s.sendMessage(message);
                } catch (IOException e) {
                    log.warn("Failed sending WS msg to peer: {}", e.getMessage());
                }
            }
        }
    }

    private void leaveCurrentRoom(WebSocketSession session) {
        String boardId = sessionBoardMap.remove(session.getId());
        if (boardId != null) {
            Set<WebSocketSession> sessions = boardRooms.get(boardId);
            if (sessions != null) {
                sessions.remove(session);
                if (sessions.isEmpty()) {
                    boardRooms.remove(boardId);
                }
            }
            log.info("Session {} left board {}", session.getId(), boardId);
        }
    }

    @Override
    public void afterConnectionClosed(@NonNull WebSocketSession session, @NonNull CloseStatus status) {
        leaveCurrentRoom(session);
        log.info("WebSocket closed: session id {}", session.getId());
    }
}

