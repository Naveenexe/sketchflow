package com.sketchflow.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private static final long WINDOW_MS = 60_000L;
    private static final int AUTH_LIMIT_PER_MIN = 25;
    private static final int SHARE_LINK_LIMIT_PER_MIN = 40;

    private final Map<String, WindowCounter> counters = new ConcurrentHashMap<>();

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {
        String path = request.getRequestURI();
        int limit = 0;

        if (path.startsWith("/api/v1/auth/")) {
            limit = AUTH_LIMIT_PER_MIN;
        } else if (path.startsWith("/api/v1/share-links/")) {
            limit = SHARE_LINK_LIMIT_PER_MIN;
        }

        if (limit > 0) {
            String key = resolveClientIp(request) + ":" + (path.startsWith("/api/v1/auth/") ? "auth" : "share");
            if (counters.size() > 5000) {
                counters.clear();
            }

            long now = System.currentTimeMillis();
            WindowCounter counter = counters.compute(key, (k, existing) -> {
                if (existing == null || now - existing.windowStart > WINDOW_MS) {
                    return new WindowCounter(now);
                }
                return existing;
            });

            if (counter.count.incrementAndGet() > limit) {
                response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
                response.setHeader("Retry-After", "60");
                response.setContentType("application/json");
                response.getWriter().write("{\"error\":\"Too many requests. Please wait a minute and try again.\"}");
                return;
            }
        }

        filterChain.doFilter(request, response);
    }

    private String resolveClientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    private static class WindowCounter {
        final long windowStart;
        final AtomicInteger count = new AtomicInteger(0);

        WindowCounter(long windowStart) {
            this.windowStart = windowStart;
        }
    }
}
