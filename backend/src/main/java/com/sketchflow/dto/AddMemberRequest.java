package com.sketchflow.dto;

import com.sketchflow.entity.BoardRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class AddMemberRequest {

    @NotBlank(message = "User email is required")
    @Email(message = "Invalid email format")
    private String email;

    @NotNull(message = "Role is required")
    private BoardRole role = BoardRole.EDITOR;

    public AddMemberRequest() {}

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public BoardRole getRole() { return role; }
    public void setRole(BoardRole role) { this.role = role; }
}

