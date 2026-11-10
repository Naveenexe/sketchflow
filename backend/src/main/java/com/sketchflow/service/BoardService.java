package com.sketchflow.service;

import com.sketchflow.dto.AddMemberRequest;
import com.sketchflow.dto.BoardDto;
import com.sketchflow.dto.BoardMemberDto;
import com.sketchflow.dto.CreateBoardRequest;
import com.sketchflow.dto.UpdateBoardRequest;
import com.sketchflow.entity.Board;
import com.sketchflow.entity.BoardMember;
import com.sketchflow.entity.BoardRole;
import com.sketchflow.entity.BoardSnapshot;
import com.sketchflow.entity.User;
import com.sketchflow.repository.BoardMemberRepository;
import com.sketchflow.repository.BoardRepository;
import com.sketchflow.repository.BoardSnapshotRepository;
import com.sketchflow.repository.UserRepository;
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
    private final UserRepository userRepository;

    public BoardService(
            BoardRepository boardRepository,
            BoardMemberRepository boardMemberRepository,
            BoardSnapshotRepository boardSnapshotRepository,
            UserRepository userRepository
    ) {
        this.boardRepository = boardRepository;
        this.boardMemberRepository = boardMemberRepository;
        this.boardSnapshotRepository = boardSnapshotRepository;
        this.userRepository = userRepository;
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
        if (role != BoardRole.OWNER) {
            throw new SecurityException("Permission denied: Only the board owner can rename or archive this board");
        }

        if (request.getTitle() != null && !request.getTitle().isBlank()) {
            board.setTitle(request.getTitle().trim());
        }
        if (request.getThumbnailUrl() != null) {
            board.setThumbnailUrl(request.getThumbnailUrl());
        }
        if (request.getArchived() != null) {
            board.setArchived(request.getArchived());
        }

        board = boardRepository.save(board);
        return mapToDto(board, role);
    }

    @Transactional
    public BoardDto duplicateBoard(UUID boardId, UUID userId) {
        Board source = boardRepository.findById(boardId)
                .orElseThrow(() -> new IllegalArgumentException("Board not found"));

        BoardRole role = resolveRole(source, userId);
        if (role != BoardRole.OWNER) {
            throw new SecurityException("Permission denied: Only the board owner can duplicate this board");
        }

        Board copy = new Board(source.getTitle() + " (Copy)", userId);
        copy.setSceneJson(source.getSceneJson());
        copy.setThumbnailUrl(source.getThumbnailUrl());
        copy = boardRepository.save(copy);

        boardMemberRepository.save(new BoardMember(copy.getId(), userId, BoardRole.OWNER));

        return mapToDto(copy, BoardRole.OWNER);
    }

    @Transactional
    public void deleteBoard(UUID boardId, UUID userId) {
        Board board = boardRepository.findById(boardId)
                .orElseThrow(() -> new IllegalArgumentException("Board not found"));

        if (board.getOwnerId() == null || !board.getOwnerId().equals(userId)) {
            throw new SecurityException("Permission denied: Only the board owner can delete this board");
        }

        boardRepository.delete(board);
    }

    public String getBoardScene(UUID boardId, UUID userId) {
        Board board = boardRepository.findById(boardId)
                .orElseThrow(() -> new IllegalArgumentException("Board not found"));
        resolveRole(board, userId);
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

        if (board.getVersion() % 5 == 0) {
            boardSnapshotRepository.save(new BoardSnapshot(board.getId(), board.getVersion(), sceneJson, userId));
        }

        return mapToDto(board, role);
    }

    public List<BoardMemberDto> listMembers(UUID boardId, UUID requesterId) {
        Board board = boardRepository.findById(boardId)
                .orElseThrow(() -> new IllegalArgumentException("Board not found"));
        resolveRole(board, requesterId);

        return boardMemberRepository.findByBoardId(boardId).stream()
                .map(bm -> {
                    Optional<User> u = userRepository.findById(bm.getUserId());
                    return new BoardMemberDto(
                            bm.getUserId(),
                            u.map(User::getEmail).orElse("unknown"),
                            u.map(User::getDisplayName).orElse("Unknown User"),
                            bm.getRole().name(),
                            bm.getJoinedAt()
                    );
                })
                .toList();
    }

    @Transactional
    public BoardMemberDto addOrUpdateMember(UUID boardId, UUID requesterId, AddMemberRequest request) {
        Board board = boardRepository.findById(boardId)
                .orElseThrow(() -> new IllegalArgumentException("Board not found"));

        BoardRole requesterRole = resolveRole(board, requesterId);
        if (requesterRole != BoardRole.OWNER) {
            throw new SecurityException("Permission denied: Only the board owner can manage members");
        }

        if (request.getRole() == BoardRole.OWNER) {
            throw new IllegalArgumentException("Cannot assign OWNER role via member invite");
        }

        User targetUser = userRepository.findByEmail(request.getEmail().toLowerCase().trim())
                .orElseThrow(() -> new IllegalArgumentException("No registered user found with email: " + request.getEmail()));

        if (targetUser.getId().equals(board.getOwnerId())) {
            throw new IllegalArgumentException("Board owner already has full access");
        }

        BoardMember member = boardMemberRepository.findByBoardIdAndUserId(boardId, targetUser.getId())
                .orElse(new BoardMember(boardId, targetUser.getId(), request.getRole()));
        member.setRole(request.getRole());
        member = boardMemberRepository.save(member);

        return new BoardMemberDto(
                targetUser.getId(),
                targetUser.getEmail(),
                targetUser.getDisplayName(),
                member.getRole().name(),
                member.getJoinedAt()
        );
    }

    @Transactional
    public void removeMember(UUID boardId, UUID requesterId, UUID targetUserId) {
        Board board = boardRepository.findById(boardId)
                .orElseThrow(() -> new IllegalArgumentException("Board not found"));

        BoardRole requesterRole = resolveRole(board, requesterId);
        if (requesterRole != BoardRole.OWNER) {
            throw new SecurityException("Permission denied: Only the board owner can remove members");
        }

        if (targetUserId.equals(board.getOwnerId())) {
            throw new IllegalArgumentException("Cannot remove the board owner");
        }

        boardMemberRepository.deleteByBoardIdAndUserId(boardId, targetUserId);
    }

    public BoardRole resolveUserRole(UUID boardId, UUID userId) {
        Board board = boardRepository.findById(boardId)
                .orElseThrow(() -> new IllegalArgumentException("Board not found"));
        return resolveRole(board, userId);
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
        dto.setArchived(board.isArchived());
        dto.setCreatedAt(board.getCreatedAt());
        dto.setUpdatedAt(board.getUpdatedAt());
        dto.setUserRole(role != null ? role.name() : "VIEWER");
        return dto;
    }
}
