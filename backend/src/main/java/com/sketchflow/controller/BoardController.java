package com.sketchflow.controller;

import com.sketchflow.dto.BoardDto;
import com.sketchflow.dto.CreateBoardRequest;
import com.sketchflow.dto.ScenePayload;
import com.sketchflow.dto.UpdateBoardRequest;
import com.sketchflow.security.UserPrincipal;
import com.sketchflow.service.BoardService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/boards")
public class BoardController {

    private final BoardService boardService;

    public BoardController(BoardService boardService) {
        this.boardService = boardService;
    }

    @GetMapping
    public ResponseEntity<List<BoardDto>> listBoards(@AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(boardService.listAccessibleBoards(principal.getId()));
    }

    @PostMapping
    public ResponseEntity<BoardDto> createBoard(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody CreateBoardRequest request
    ) {
        BoardDto created = boardService.createBoard(principal.getId(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @GetMapping("/{boardId}")
    public ResponseEntity<BoardDto> getBoard(
            @PathVariable UUID boardId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(boardService.getBoard(boardId, principal.getId()));
    }

    @PatchMapping("/{boardId}")
    public ResponseEntity<BoardDto> updateBoard(
            @PathVariable UUID boardId,
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestBody UpdateBoardRequest request
    ) {
        return ResponseEntity.ok(boardService.updateBoard(boardId, principal.getId(), request));
    }

    @DeleteMapping("/{boardId}")
    public ResponseEntity<Map<String, String>> deleteBoard(
            @PathVariable UUID boardId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        boardService.deleteBoard(boardId, principal.getId());
        return ResponseEntity.ok(Map.of("message", "Board deleted successfully"));
    }

    @GetMapping("/{boardId}/scene")
    public ResponseEntity<Map<String, String>> getScene(
            @PathVariable UUID boardId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        String sceneJson = boardService.getBoardScene(boardId, principal.getId());
        return ResponseEntity.ok(Map.of("sceneJson", sceneJson != null ? sceneJson : ""));
    }

    @PutMapping("/{boardId}/scene")
    public ResponseEntity<BoardDto> updateScene(
            @PathVariable UUID boardId,
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody ScenePayload payload
    ) {
        BoardDto updated = boardService.updateBoardScene(boardId, principal.getId(), payload.getSceneJson());
        return ResponseEntity.ok(updated);
    }
}
