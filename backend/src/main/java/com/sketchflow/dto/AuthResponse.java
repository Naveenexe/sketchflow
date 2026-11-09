package com.sketchflow.dto;

import java.util.UUID;

public class AuthResponse {

    private String token;
    private UUID userId;
    private String email;
    private String displayName;

    public AuthResponse() {}

    public AuthResponse(String token, UUID userId, String email, String displayName) {
        this.token = token;
        this.userId = userId;
        this.email = email;
        this.displayName = displayName;
    }

    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }

    public UUID getUserId() { return userId; }
    public void setUserId(UUID userId) { this.userId = userId; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }
}
