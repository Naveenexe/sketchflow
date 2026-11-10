package com.sketchflow.websocket;

import com.sketchflow.entity.Board;
import com.sketchflow.entity.BoardMember;
import com.sketchflow.entity.BoardRole;
import com.sketchflow.repository.BoardMemberRepository;
import com.sketchflow.repository.BoardRepository;
import com.sketchflow.repository.BoardSnapshotRepository;
import com.sketchflow.repository.UserRepository;
import com.sketchflow.service.BoardService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpHeaders;
import org.springframework.web.socket.*;

import java.net.InetSocketAddress;
import java.net.URI;
import java.security.Principal;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CollabWebSocketHandlerTest {

    @Mock
    private BoardRepository boardRepository;

    @Mock
    private BoardMemberRepository boardMemberRepository;

    @Mock
    private BoardSnapshotRepository boardSnapshotRepository;

    @Mock
    private UserRepository userRepository;

    private CollabWebSocketHandler handler;

    private UUID boardId;
    private UUID ownerId;
    private UUID editorId;
    private UUID viewerId;
    private Board board;

    @BeforeEach
    void setUp() {
        BoardService boardService = new BoardService(
                boardRepository,
                boardMemberRepository,
                boardSnapshotRepository,
                userRepository
        );
        handler = new CollabWebSocketHandler(boardService);

        boardId = UUID.randomUUID();
        ownerId = UUID.randomUUID();
        editorId = UUID.randomUUID();
        viewerId = UUID.randomUUID();

        board = new Board("Collab Board", ownerId);
        board.setId(boardId);
        board.setVersion(1);
        board.setSceneJson("{\"elements\":[]}");
    }

    @Test
    void editorSceneUpdateBroadcastsToPeerAndDeduplicatesEventId() throws Exception {
        when(boardRepository.findById(boardId)).thenReturn(Optional.of(board));
        when(boardMemberRepository.findByBoardIdAndUserId(boardId, editorId))
                .thenReturn(Optional.of(new BoardMember(boardId, editorId, BoardRole.EDITOR)));

        FakeWebSocketSession editorSession = new FakeWebSocketSession("s1", editorId, "Alice");
        FakeWebSocketSession ownerSession = new FakeWebSocketSession("s2", ownerId, "Bob");

        handler.handleTextMessage(editorSession, new TextMessage(
                "{\"type\":\"JOIN_BOARD\",\"boardId\":\"" + boardId + "\"}"
        ));
        handler.handleTextMessage(ownerSession, new TextMessage(
                "{\"type\":\"JOIN_BOARD\",\"boardId\":\"" + boardId + "\"}"
        ));

        ownerSession.sentMessages.clear();
        editorSession.sentMessages.clear();

        String updateMsg = "{\"type\":\"SCENE_UPDATE\",\"boardId\":\"" + boardId + "\",\"eventId\":\"evt-1\",\"payload\":{\"elements\":[{\"id\":\"r1\"}]}}";
        handler.handleTextMessage(editorSession, new TextMessage(updateMsg));

        assertEquals(1, ownerSession.sentMessages.size());
        assertTrue(ownerSession.sentMessages.get(0).contains("\"type\":\"SCENE_UPDATE\""));
        assertTrue(ownerSession.sentMessages.get(0).contains("\"eventId\":\"evt-1\""));

        // Replaying exact same eventId "evt-1" is ignored (idempotent deduplication)
        handler.handleTextMessage(editorSession, new TextMessage(updateMsg));
        assertEquals(1, ownerSession.sentMessages.size());
    }

    @Test
    void viewerCannotSendSceneUpdates() throws Exception {
        when(boardRepository.findById(boardId)).thenReturn(Optional.of(board));
        when(boardMemberRepository.findByBoardIdAndUserId(boardId, viewerId))
                .thenReturn(Optional.of(new BoardMember(boardId, viewerId, BoardRole.VIEWER)));

        FakeWebSocketSession viewerSession = new FakeWebSocketSession("s-viewer", viewerId, "Viewer");
        FakeWebSocketSession ownerSession = new FakeWebSocketSession("s-owner", ownerId, "Owner");

        handler.handleTextMessage(ownerSession, new TextMessage(
                "{\"type\":\"JOIN_BOARD\",\"boardId\":\"" + boardId + "\"}"
        ));
        handler.handleTextMessage(viewerSession, new TextMessage(
                "{\"type\":\"JOIN_BOARD\",\"boardId\":\"" + boardId + "\"}"
        ));

        ownerSession.sentMessages.clear();
        viewerSession.sentMessages.clear();

        handler.handleTextMessage(viewerSession, new TextMessage(
                "{\"type\":\"SCENE_UPDATE\",\"boardId\":\"" + boardId + "\",\"eventId\":\"evt-v1\",\"payload\":{\"elements\":[]}}"
        ));

        assertEquals(0, ownerSession.sentMessages.size());
        assertEquals(1, viewerSession.sentMessages.size());
        assertTrue(viewerSession.sentMessages.get(0).contains("\"code\":\"FORBIDDEN\""));
    }

    @Test
    void unauthorizedUserCannotJoinRoom() throws Exception {
        UUID intruderId = UUID.randomUUID();
        when(boardRepository.findById(boardId)).thenReturn(Optional.of(board));
        when(boardMemberRepository.findByBoardIdAndUserId(boardId, intruderId)).thenReturn(Optional.empty());

        FakeWebSocketSession intruderSession = new FakeWebSocketSession("s-intruder", intruderId, "Intruder");
        handler.handleTextMessage(intruderSession, new TextMessage(
                "{\"type\":\"JOIN_BOARD\",\"boardId\":\"" + boardId + "\"}"
        ));

        assertEquals(1, intruderSession.sentMessages.size());
        assertTrue(intruderSession.sentMessages.get(0).contains("\"code\":\"FORBIDDEN\""));
    }

    private static class FakeWebSocketSession implements WebSocketSession {
        private final String id;
        private final Map<String, Object> attributes = new HashMap<>();
        final List<String> sentMessages = new ArrayList<>();

        FakeWebSocketSession(String id, UUID userId, String displayName) {
            this.id = id;
            this.attributes.put("userId", userId.toString());
            this.attributes.put("displayName", displayName);
        }

        @Override public String getId() { return id; }
        @Override public URI getUri() { return null; }
        @Override public HttpHeaders getHandshakeHeaders() { return new HttpHeaders(); }
        @Override public Map<String, Object> getAttributes() { return attributes; }
        @Override public Principal getPrincipal() { return null; }
        @Override public InetSocketAddress getLocalAddress() { return null; }
        @Override public InetSocketAddress getRemoteAddress() { return null; }
        @Override public String getAcceptedProtocol() { return null; }
        @Override public void setTextMessageSizeLimit(int messageSizeLimit) {}
        @Override public int getTextMessageSizeLimit() { return 65536; }
        @Override public void setBinaryMessageSizeLimit(int messageSizeLimit) {}
        @Override public int getBinaryMessageSizeLimit() { return 65536; }
        @Override public List<WebSocketExtension> getExtensions() { return List.of(); }
        @Override public void sendMessage(WebSocketMessage<?> message) {
            if (message instanceof TextMessage tm) {
                sentMessages.add(tm.getPayload());
            }
        }
        @Override public boolean isOpen() { return true; }
        @Override public void close() {}
        @Override public void close(CloseStatus status) {}
    }
}
