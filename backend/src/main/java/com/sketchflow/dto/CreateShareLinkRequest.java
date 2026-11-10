package com.sketchflow.dto;

import com.sketchflow.entity.BoardRole;
import jakarta.validation.constraints.NotNull;

public class CreateShareLinkRequest {

    @NotNull(message = "Permission is required")
    private BoardRole permission = BoardRole.VIEWER;

    private Integer expiresInDays; // null = never expires

    public CreateShareLinkRequest() {}

    public BoardRole getPermission() { return permission; }
    public void setPermission(BoardRole permission) { this.permission = permission; }

    public Integer getExpiresInDays() { return expiresInDays; }
    public void setExpiresInDays(Integer expiresInDays) { this.expiresInDays = expiresInDays; }
}
