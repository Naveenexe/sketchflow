package com.sketchflow.service;

import com.sketchflow.dto.BoardDto;
import com.sketchflow.dto.CreateBoardRequest;
import com.sketchflow.dto.UpdateBoardRequest;
import com.sketchflow.entity.Board;
import com.sketchflow.entity.BoardMember;
import com.sketchflow.entity.BoardRole;
import com.sketchflow.entity.BoardSnapshot;
import com.sketchflow.repository.BoardMemberRepository;
import com.sketchflow.repository.BoardRepository;
import com.sketchflow.repository.BoardSnapshotRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class BoardService {

    private final BoardRepository boardRepository;
    private final BoardMemberRepository boardMemberRepository;
    private final BoardSnapshotRepository boardSnapshotRepository;

    public BoardService(
            BoardRepository boardRepository,
            BoardMemberRepository boardMemberRepository,
            BoardSnapshotRepository boardSnapshotRepository
    ) {
        this.boardRepository = boardRepository;
        this.boardMemberRepository = boardMemberRepository;
        this.boardSnapshotRepository = boardSnapshotRepository;
    }

    public List<BoardDto> listAccessibleBoards(UUID userId) {
        return boardRepository.findAccessibleBoards(userId).stream()
                .map(board -> mapToDto(board, resolveRole(board, userId)))
                .toList();
    }

    @Transactional
    public BoardDto createBoard(UUID userId, CreateBoardRequest request) {
        Board board = new Board(request.getTitle(), userId);
        if (request.getSceneJson() != null && !request.getSceneJson().isBlank()) {
            board.setSceneJson(request.getSceneJson());
        } else {
            board.setSceneJson("{\"elements\":[],\"appState\":{\"viewBackgroundColor\":\"#ffffff\"}}");
        }
        board = boardRepository.save(board);

        // Also add owner to members
        boardMemberRepository.save(new BoardMember(board.getId(), userId, BoardRole.OWNER));

        return mapToDto(board, BoardRole.OWNER);
    }

    public BoardDto getBoard(UUID boardId, UUID userId) {
        Board board = boardRepository.findById(boardId)
                .orElseThrow(() -> new IllegalArgumentException("Board not found"));

        BoardRole role = resolveRole(board, userId);
        return mapToDto(board, role);
    }

    @Transactional
    public BoardDto updateBoard(UUID boardId, UUID userId, UpdateBoardRequest request) {
        Board board = boardRepository.findById(boardId)
                .orElseThrow(() -> new IllegalArgumentException("Board not found"));

        BoardRole role = resolveRole(board, userId);
        if (role != BoardRole.OWNER && role != BoardRole.EDITOR) {
            throw new SecurityException("Permission denied: You cannot edit this board");
        }

        if (request.getTitle() != null && !request.getTitle().isBlank()) {
            board.setTitle(request.getTitle().trim());
        }
        if (request.getThumbnailUrl() != null) {
            board.setThumbnailUrl(request.getThumbnailUrl());
        }

        board = boardRepository.save(board);
        return mapToDto(board, role);
    }

    @Transactional
    public void deleteBoard(UUID boardId, UUID userId) {
        Board board = boardRepository.findById(boardId)
                .orElseThrow(() -> new IllegalArgumentException("Board not found"));

        if (!board.getOwnerId().equals(userId)) {
            throw new SecurityException("Permission denied: Only the board owner can delete this board");
        }

        boardRepository.delete(board);
    }

    public String getBoardScene(UUID boardId, UUID userId) {
        Board board = boardRepository.findById(boardId)
                .orElseThrow(() -> new IllegalArgumentException("Board not found"));
        resolveRole(board, userId); // verify access
        return board.getSceneJson();
    }

    @Transactional
    public BoardDto updateBoardScene(UUID boardId, UUID userId, String sceneJson) {
        Board board = boardRepository.findById(boardId)
                .orElseThrow(() -> new IllegalArgumentException("Board not found"));

        BoardRole role = resolveRole(board, userId);
        if (role == BoardRole.VIEWER) {
            throw new SecurityException("Permission denied: Viewers cannot save scene changes");
        }

        board.setSceneJson(sceneJson);
        board.setVersion(board.getVersion() + 1);
        board = boardRepository.save(board);

        // Periodically take snapshot
        if (board.getVersion() % 5 == 0) {
            boardSnapshotRepository.save(new BoardSnapshot(board.getId(), board.getVersion(), sceneJson, userId));
        }

        return mapToDto(board, role);
    }

    private BoardRole resolveRole(Board board, UUID userId) {
        if (board.getOwnerId() != null && board.getOwnerId().equals(userId)) {
            return BoardRole.OWNER;
        }

        Optional<BoardMember> member = boardMemberRepository.findByBoardIdAndUserId(board.getId(), userId);
        if (member.isPresent()) {
            return member.get().getRole();
        }

        throw new SecurityException("Access denied: You do not have permission to access this board");
    }

    private BoardDto mapToDto(Board board, BoardRole role) {
        BoardDto dto = new BoardDto();
        dto.setId(board.getId());
        dto.setOwnerId(board.getOwnerId());
        dto.setTitle(board.getTitle());
        dto.setSceneJson(board.getSceneJson());
        dto.setThumbnailUrl(board.getThumbnailUrl());
        dto.setVersion(board.getVersion());
        dto.setCreatedAt(board.getCreatedAt());
        dto.setUpdatedAt(board.getUpdatedAt());
        dto.setUserRole(role != null ? role.name() : "VIEWER");
        return dto;
    }
}
