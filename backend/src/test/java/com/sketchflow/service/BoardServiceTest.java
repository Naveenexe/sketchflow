package com.sketchflow.service;

import com.sketchflow.dto.BoardDto;
import com.sketchflow.dto.CreateBoardRequest;
import com.sketchflow.dto.UpdateBoardRequest;
import com.sketchflow.entity.Board;
import com.sketchflow.entity.BoardMember;
import com.sketchflow.entity.BoardRole;
import com.sketchflow.repository.BoardMemberRepository;
import com.sketchflow.repository.BoardRepository;
import com.sketchflow.repository.BoardSnapshotRepository;
import com.sketchflow.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BoardServiceTest {

    @Mock
    private BoardRepository boardRepository;

    @Mock
    private BoardMemberRepository boardMemberRepository;

    @Mock
    private BoardSnapshotRepository boardSnapshotRepository;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private BoardService boardService;

    private UUID ownerId;
    private UUID editorId;
    private UUID viewerId;
    private UUID outsiderId;
    private UUID boardId;
    private Board board;

    @BeforeEach
    void setUp() {
        ownerId = UUID.randomUUID();
        editorId = UUID.randomUUID();
        viewerId = UUID.randomUUID();
        outsiderId = UUID.randomUUID();
        boardId = UUID.randomUUID();

        board = new Board("Architecture Board", ownerId);
        board.setId(boardId);
        board.setSceneJson("{\"elements\":[]}");
        board.setVersion(1);
    }

    @Test
    void ownerCanPerformAllBoardOperations() {
        when(boardRepository.findById(boardId)).thenReturn(Optional.of(board));
        when(boardRepository.save(any(Board.class))).thenAnswer(inv -> inv.getArgument(0));

        // Read
        BoardDto dto = boardService.getBoard(boardId, ownerId);
        assertEquals("OWNER", dto.getUserRole());

        // Rename & Archive
        UpdateBoardRequest updateReq = new UpdateBoardRequest();
        updateReq.setTitle("Updated Architecture");
        updateReq.setArchived(true);
        BoardDto updated = boardService.updateBoard(boardId, ownerId, updateReq);
        assertEquals("Updated Architecture", updated.getTitle());
        assertTrue(updated.isArchived());

        // Save Scene
        BoardDto sceneUpdated = boardService.updateBoardScene(boardId, ownerId, "{\"elements\":[{\"id\":\"1\"}]}");
        assertEquals(2, sceneUpdated.getVersion());

        // Duplicate
        BoardDto copied = boardService.duplicateBoard(boardId, ownerId);
        assertEquals("Updated Architecture (Copy)", copied.getTitle());

        // Delete
        assertDoesNotThrow(() -> boardService.deleteBoard(boardId, ownerId));
        verify(boardRepository).delete(board);
    }

    @Test
    void editorCanEditSceneButCannotRenameDuplicateOrDelete() {
        when(boardRepository.findById(boardId)).thenReturn(Optional.of(board));
        when(boardMemberRepository.findByBoardIdAndUserId(boardId, editorId))
                .thenReturn(Optional.of(new BoardMember(boardId, editorId, BoardRole.EDITOR)));
        when(boardRepository.save(any(Board.class))).thenAnswer(inv -> inv.getArgument(0));

        // Allowed: Read & Edit Scene
        BoardDto dto = boardService.getBoard(boardId, editorId);
        assertEquals("EDITOR", dto.getUserRole());

        BoardDto sceneUpdated = boardService.updateBoardScene(boardId, editorId, "{\"elements\":[{\"id\":\"2\"}]}");
        assertEquals(2, sceneUpdated.getVersion());

        // Forbidden: Rename, Duplicate, Delete
        UpdateBoardRequest req = new UpdateBoardRequest();
        req.setTitle("Hacked Title");
        assertThrows(SecurityException.class, () -> boardService.updateBoard(boardId, editorId, req));
        assertThrows(SecurityException.class, () -> boardService.duplicateBoard(boardId, editorId));
        assertThrows(SecurityException.class, () -> boardService.deleteBoard(boardId, editorId));
    }

    @Test
    void viewerCanReadButCannotEditSceneOrManageBoard() {
        when(boardRepository.findById(boardId)).thenReturn(Optional.of(board));
        when(boardMemberRepository.findByBoardIdAndUserId(boardId, viewerId))
                .thenReturn(Optional.of(new BoardMember(boardId, viewerId, BoardRole.VIEWER)));

        // Allowed: Read Board & Scene
        BoardDto dto = boardService.getBoard(boardId, viewerId);
        assertEquals("VIEWER", dto.getUserRole());
        assertEquals("{\"elements\":[]}", boardService.getBoardScene(boardId, viewerId));

        // Forbidden: Save Scene, Rename, Duplicate, Delete
        assertThrows(SecurityException.class, () -> boardService.updateBoardScene(boardId, viewerId, "{\"elements\":[1]}"));
        UpdateBoardRequest req = new UpdateBoardRequest();
        req.setTitle("Viewer Rename");
        assertThrows(SecurityException.class, () -> boardService.updateBoard(boardId, viewerId, req));
        assertThrows(SecurityException.class, () -> boardService.duplicateBoard(boardId, viewerId));
        assertThrows(SecurityException.class, () -> boardService.deleteBoard(boardId, viewerId));
    }

    @Test
    void outsiderHasNoAccessToBoard() {
        when(boardRepository.findById(boardId)).thenReturn(Optional.of(board));
        when(boardMemberRepository.findByBoardIdAndUserId(boardId, outsiderId)).thenReturn(Optional.empty());

        assertThrows(SecurityException.class, () -> boardService.getBoard(boardId, outsiderId));
        assertThrows(SecurityException.class, () -> boardService.getBoardScene(boardId, outsiderId));
        assertThrows(SecurityException.class, () -> boardService.updateBoardScene(boardId, outsiderId, "{}"));
        assertThrows(SecurityException.class, () -> boardService.deleteBoard(boardId, outsiderId));
    }

    @Test
    void createBoardSetsDefaultSceneAndOwnerMembership() {
        when(boardRepository.save(any(Board.class))).thenAnswer(inv -> {
            Board saved = inv.getArgument(0);
            saved.setId(UUID.randomUUID());
            return saved;
        });

        CreateBoardRequest req = new CreateBoardRequest();
        req.setTitle("New Workspace");

        BoardDto created = boardService.createBoard(ownerId, req);
        assertEquals("New Workspace", created.getTitle());
        assertEquals("OWNER", created.getUserRole());
        assertNotNull(created.getSceneJson());
        verify(boardMemberRepository).save(any(BoardMember.class));
    }
}

