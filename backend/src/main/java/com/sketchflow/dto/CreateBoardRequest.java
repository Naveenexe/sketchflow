package com.sketchflow.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class CreateBoardRequest {

    @NotBlank(message = "Title is required")
    @Size(max = 255, message = "Title cannot exceed 255 characters")
    private String title = "Untitled Board";

    private String sceneJson;

    public CreateBoardRequest() {}

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getSceneJson() { return sceneJson; }
    public void setSceneJson(String sceneJson) { this.sceneJson = sceneJson; }
}
