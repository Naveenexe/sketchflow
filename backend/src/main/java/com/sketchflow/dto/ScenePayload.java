package com.sketchflow.dto;

import jakarta.validation.constraints.NotBlank;

public class ScenePayload {

    @NotBlank(message = "Scene data cannot be blank")
    private String sceneJson;

    public ScenePayload() {}

    public ScenePayload(String sceneJson) {
        this.sceneJson = sceneJson;
    }

    public String getSceneJson() { return sceneJson; }
    public void setSceneJson(String sceneJson) { this.sceneJson = sceneJson; }
}

