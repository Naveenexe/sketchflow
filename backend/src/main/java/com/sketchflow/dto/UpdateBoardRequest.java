package com.sketchflow.dto;

public class UpdateBoardRequest {

    private String title;
    private String thumbnailUrl;

    public UpdateBoardRequest() {}

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getThumbnailUrl() { return thumbnailUrl; }
    public void setThumbnailUrl(String thumbnailUrl) { this.thumbnailUrl = thumbnailUrl; }
}
