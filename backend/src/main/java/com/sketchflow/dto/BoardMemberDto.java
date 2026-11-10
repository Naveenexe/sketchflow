package com.sketchflow.dto;

import java.time.Instant;
import java.util.UUID;

public class BoardMemberDto {

    private UUID userId;
    private String email;
    private String displayName;
    private String role;
    private Instant joinedAt;

    public BoardMemberDto() {}

    public BoardMemberDto(UUID userId, String email, String displayName, String role, Instant joinedAt) {
        this.userId = userId;
        this.email = email;
        this.displayName = displayName;
        this.role = role;
        this.joinedAt = joinedAt;
    }

    public UUID getUserId() { return userId; }
    public void setUserId(UUID userId) { this.userId = userId; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public Instant getJoinedAt() { return joinedAt; }
    public void setJoinedAt(Instant joinedAt) { this.joinedAt = joinedAt; }
}

