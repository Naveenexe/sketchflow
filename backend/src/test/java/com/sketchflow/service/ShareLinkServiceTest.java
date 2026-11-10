package com.sketchflow.service;

import com.sketchflow.dto.BoardDto;
import com.sketchflow.dto.CreateShareLinkRequest;
import com.sketchflow.dto.ShareLinkDto;
import com.sketchflow.entity.Board;
import com.sketchflow.entity.BoardRole;
import com.sketchflow.entity.ShareLink;
import com.sketchflow.repository.BoardMemberRepository;
import com.sketchflow.repository.BoardRepository;
import com.sketchflow.repository.ShareLinkRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ShareLinkServiceTest {

    @Mock
    private ShareLinkRepository shareLinkRepository;

    @Mock
    private BoardRepository boardRepository;

    @Mock
    private BoardMemberRepository boardMemberRepository;

    @InjectMocks
    private ShareLinkService shareLinkService;

    private UUID ownerId;
    private UUID otherUserId;
    private UUID boardId;
    private Board board;

    @BeforeEach
    void setUp() {
        ownerId = UUID.randomUUID();
        otherUserId = UUID.randomUUID();
        boardId = UUID.randomUUID();
        board = new Board("Public Diagram", ownerId);
        board.setId(boardId);
        board.setSceneJson("{\"elements\":[]}");
    }

    @Test
    void createAndResolveValidViewerShareLink() {
        when(boardRepository.findById(boardId)).thenReturn(Optional.of(board));
        when(shareLinkRepository.save(any(ShareLink.class))).thenAnswer(inv -> {
            ShareLink saved = inv.getArgument(0);
            saved.setId(UUID.randomUUID());
            return saved;
        });

        CreateShareLinkRequest req = new CreateShareLinkRequest();
        req.setPermission(BoardRole.VIEWER);
        req.setExpiresInDays(7);

        ShareLinkDto created = shareLinkService.createShareLink(boardId, ownerId, req);
        assertNotNull(created.getToken());
        assertEquals("VIEWER", created.getPermission());
        assertNotNull(created.getExpiresAt());

        // Mock lookup by SHA-256 hash
        String expectedHash = ShareLinkService.sha256(created.getToken());
        assertNotEquals(created.getToken(), expectedHash);

        ShareLink stored = new ShareLink(boardId, expectedHash, BoardRole.VIEWER, ownerId);
        stored.setExpiresAt(created.getExpiresAt());
        when(shareLinkRepository.findByTokenHash(expectedHash)).thenReturn(Optional.of(stored));

        // Visitor (null userId) can open valid VIEWER link
        BoardDto resolved = shareLinkService.accessBoardByShareToken(created.getToken(), null);
        assertEquals(boardId, resolved.getId());
        assertEquals("VIEWER", resolved.getUserRole());
    }

    @Test
    void revokedShareLinkIsRejected() {
        String rawToken = "secret-token-123";
        String hash = ShareLinkService.sha256(rawToken);
        ShareLink link = new ShareLink(boardId, hash, BoardRole.VIEWER, ownerId);
        link.setId(UUID.randomUUID());
        link.setRevokedAt(Instant.now().minus(1, ChronoUnit.MINUTES));

        when(shareLinkRepository.findByTokenHash(hash)).thenReturn(Optional.of(link));

        assertThrows(SecurityException.class, () -> shareLinkService.accessBoardByShareToken(rawToken, null));
    }

    @Test
    void expiredShareLinkIsRejected() {
        String rawToken = "expired-token-456";
        String hash = ShareLinkService.sha256(rawToken);
        ShareLink link = new ShareLink(boardId, hash, BoardRole.VIEWER, ownerId);
        link.setExpiresAt(Instant.now().minus(1, ChronoUnit.HOURS));

        when(shareLinkRepository.findByTokenHash(hash)).thenReturn(Optional.of(link));

        assertThrows(SecurityException.class, () -> shareLinkService.accessBoardByShareToken(rawToken, null));
    }

    @Test
    void nonOwnerCannotCreateOrRevokeShareLink() {
        when(boardRepository.findById(boardId)).thenReturn(Optional.of(board));
        CreateShareLinkRequest req = new CreateShareLinkRequest();
        req.setPermission(BoardRole.VIEWER);

        assertThrows(SecurityException.class, () -> shareLinkService.createShareLink(boardId, otherUserId, req));
    }
}
