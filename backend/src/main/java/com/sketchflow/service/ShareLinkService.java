package com.sketchflow.service;

import com.sketchflow.dto.BoardDto;
import com.sketchflow.dto.CreateShareLinkRequest;
import com.sketchflow.dto.ShareLinkDto;
import com.sketchflow.entity.Board;
import com.sketchflow.entity.BoardMember;
import com.sketchflow.entity.BoardRole;
import com.sketchflow.entity.ShareLink;
import com.sketchflow.repository.BoardMemberRepository;
import com.sketchflow.repository.BoardRepository;
import com.sketchflow.repository.ShareLinkRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;

@Service
public class ShareLinkService {

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final ShareLinkRepository shareLinkRepository;
    private final BoardRepository boardRepository;
    private final BoardMemberRepository boardMemberRepository;

    public ShareLinkService(
            ShareLinkRepository shareLinkRepository,
            BoardRepository boardRepository,
            BoardMemberRepository boardMemberRepository
    ) {
        this.shareLinkRepository = shareLinkRepository;
        this.boardRepository = boardRepository;
        this.boardMemberRepository = boardMemberRepository;
    }

    @Transactional
    public ShareLinkDto createShareLink(UUID boardId, UUID requesterId, CreateShareLinkRequest request) {
        Board board = boardRepository.findById(boardId)
                .orElseThrow(() -> new IllegalArgumentException("Board not found"));

        if (board.getOwnerId() == null || !board.getOwnerId().equals(requesterId)) {
            throw new SecurityException("Permission denied: Only the board owner can create share links");
        }

        BoardRole permission = request.getPermission() == BoardRole.EDITOR ? BoardRole.EDITOR : BoardRole.VIEWER;

        String rawToken = generateToken();
        String tokenHash = sha256(rawToken);

        ShareLink link = new ShareLink(boardId, tokenHash, permission, requesterId);
        if (request.getExpiresInDays() != null && request.getExpiresInDays() > 0) {
            link.setExpiresAt(Instant.now().plus(request.getExpiresInDays(), ChronoUnit.DAYS));
        }

        link = shareLinkRepository.save(link);
        ShareLinkDto dto = mapToDto(link);
        dto.setToken(rawToken);
        return dto;
    }

    public List<ShareLinkDto> listActiveShareLinks(UUID boardId, UUID requesterId) {
        Board board = boardRepository.findById(boardId)
                .orElseThrow(() -> new IllegalArgumentException("Board not found"));

        if (board.getOwnerId() == null || !board.getOwnerId().equals(requesterId)) {
            throw new SecurityException("Permission denied: Only the board owner can view share links");
        }

        return shareLinkRepository.findByBoardId(boardId).stream()
                .filter(link -> link.getRevokedAt() == null)
                .map(this::mapToDto)
                .toList();
    }

    @Transactional
    public void revokeShareLink(UUID linkId, UUID requesterId) {
        ShareLink link = shareLinkRepository.findById(linkId)
                .orElseThrow(() -> new IllegalArgumentException("Share link not found"));

        Board board = boardRepository.findById(link.getBoardId())
                .orElseThrow(() -> new IllegalArgumentException("Board not found"));

        if (board.getOwnerId() == null || !board.getOwnerId().equals(requesterId)) {
            throw new SecurityException("Permission denied: Only the board owner can revoke share links");
        }

        link.setRevokedAt(Instant.now());
        shareLinkRepository.save(link);
    }

    @Transactional
    public BoardDto accessBoardByShareToken(String rawToken, UUID authenticatedUserId) {
        if (rawToken == null || rawToken.isBlank()) {
            throw new IllegalArgumentException("Share token is required");
        }

        String tokenHash = sha256(rawToken.trim());
        ShareLink link = shareLinkRepository.findByTokenHash(tokenHash)
                .orElseThrow(() -> new SecurityException("Invalid or expired share link"));

        if (link.getRevokedAt() != null) {
            throw new SecurityException("This share link has been revoked");
        }

        if (link.getExpiresAt() != null && link.getExpiresAt().isBefore(Instant.now())) {
            throw new SecurityException("This share link has expired");
        }

        Board board = boardRepository.findById(link.getBoardId())
                .orElseThrow(() -> new IllegalArgumentException("Board not found"));

        // If an authenticated user uses a valid EDITOR link, grant them member access cleanly
        if (authenticatedUserId != null && !authenticatedUserId.equals(board.getOwnerId())) {
            BoardMember existing = boardMemberRepository.findByBoardIdAndUserId(board.getId(), authenticatedUserId)
                    .orElse(null);
            if (existing == null) {
                boardMemberRepository.save(new BoardMember(board.getId(), authenticatedUserId, link.getPermission()));
            }
        } else if (authenticatedUserId == null && link.getPermission() == BoardRole.EDITOR) {
            // Unauthenticated visitors can only view read-only
            throw new SecurityException("Please sign in to access an Editor share link");
        }

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
        dto.setUserRole(link.getPermission().name());
        return dto;
    }

    private String generateToken() {
        byte[] bytes = new byte[32];
        SECURE_RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    static String sha256(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }

    private ShareLinkDto mapToDto(ShareLink link) {
        ShareLinkDto dto = new ShareLinkDto();
        dto.setId(link.getId());
        dto.setBoardId(link.getBoardId());
        dto.setPermission(link.getPermission().name());
        dto.setExpiresAt(link.getExpiresAt());
        dto.setRevokedAt(link.getRevokedAt());
        dto.setCreatedAt(link.getCreatedAt());
        return dto;
    }
}
