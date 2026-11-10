package com.sketchflow.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/health")
public class HealthController {

    private final JdbcTemplate jdbcTemplate;

    public HealthController(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> getHealth() {
        Map<String, Object> health = new HashMap<>();
        health.put("status", "UP");
        health.put("service", "sketchflow-backend");
        health.put("timestamp", Instant.now().toString());

        try {
            String dbTime = jdbcTemplate.queryForObject("SELECT NOW()::text", String.class);
            health.put("database", Map.of(
                    "status", "CONNECTED",
                    "serverTime", dbTime != null ? dbTime : "unknown"
            ));
        } catch (Exception e) {
            health.put("database", Map.of(
                    "status", "DISCONNECTED",
                    "error", e.getMessage()
            ));
            return ResponseEntity.status(503).body(health);
        }

        return ResponseEntity.ok(health);
    }
}

