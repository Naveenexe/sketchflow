package com.sketchflow.dto;

import java.time.Instant;
import java.util.UUID;

public class ShareLinkDto {

    private UUID id;
    private UUID boardId;
    private String token; // Only returned once upon creation
    private String permission;
    private Instant expiresAt;
    private Instant revokedAt;
    private Instant createdAt;

    public ShareLinkDto() {}

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getBoardId() { return boardId; }
    public void setBoardId(UUID boardId) { this.boardId = boardId; }

    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }

    public String getPermission() { return permission; }
    public void setPermission(String permission) { this.permission = permission; }

    public Instant getExpiresAt() { return expiresAt; }
    public void setExpiresAt(Instant expiresAt) { this.expiresAt = expiresAt; }

    public Instant getRevokedAt() { return revokedAt; }
    public void setRevokedAt(Instant revokedAt) { this.revokedAt = revokedAt; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
