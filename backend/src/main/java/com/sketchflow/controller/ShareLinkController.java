package com.sketchflow.controller;

import com.sketchflow.dto.BoardDto;
import com.sketchflow.dto.CreateShareLinkRequest;
import com.sketchflow.dto.ShareLinkDto;
import com.sketchflow.security.UserPrincipal;
import com.sketchflow.service.ShareLinkService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
public class ShareLinkController {

    private final ShareLinkService shareLinkService;

    public ShareLinkController(ShareLinkService shareLinkService) {
        this.shareLinkService = shareLinkService;
    }

    @GetMapping("/boards/{boardId}/share-links")
    public ResponseEntity<List<ShareLinkDto>> listShareLinks(
            @PathVariable UUID boardId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(shareLinkService.listActiveShareLinks(boardId, principal.getId()));
    }

    @PostMapping("/boards/{boardId}/share-links")
    public ResponseEntity<ShareLinkDto> createShareLink(
            @PathVariable UUID boardId,
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody CreateShareLinkRequest request
    ) {
        ShareLinkDto created = shareLinkService.createShareLink(boardId, principal.getId(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @DeleteMapping("/share-links/{linkId}")
    public ResponseEntity<Map<String, String>> revokeShareLink(
            @PathVariable UUID linkId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        shareLinkService.revokeShareLink(linkId, principal.getId());
        return ResponseEntity.ok(Map.of("message", "Share link revoked"));
    }

    @GetMapping("/share-links/{token}")
    public ResponseEntity<BoardDto> resolveShareLink(
            @PathVariable String token,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        UUID userId = principal != null ? principal.getId() : null;
        return ResponseEntity.ok(shareLinkService.accessBoardByShareToken(token, userId));
    }
}
