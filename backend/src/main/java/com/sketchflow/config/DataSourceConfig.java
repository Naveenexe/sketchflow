package com.sketchflow.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import javax.sql.DataSource;
import java.io.BufferedReader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.Map;

@Configuration
public class DataSourceConfig {

    private static final Logger log = LoggerFactory.getLogger(DataSourceConfig.class);

    @Value("${SPRING_DATASOURCE_URL:}")
    private String springDatasourceUrl;

    @Value("${DATABASE_URL:}")
    private String databaseUrl;

    @Value("${SPRING_DATASOURCE_USERNAME:}")
    private String username;

    @Value("${SPRING_DATASOURCE_PASSWORD:}")
    private String password;

    @Bean
    @Primary
    public DataSource dataSource() {
        HikariConfig config = new HikariConfig();
        config.setDriverClassName("org.postgresql.Driver");

        Map<String, String> dotEnv = loadDotEnv();

        String rawUrl = springDatasourceUrl;
        if (rawUrl == null || rawUrl.isBlank()) {
            rawUrl = databaseUrl;
        }
        if (rawUrl == null || rawUrl.isBlank()) {
            rawUrl = dotEnv.get("DATABASE_URL");
        }

        if (rawUrl != null && !rawUrl.isBlank()) {
            String raw = rawUrl.trim();
            if (raw.startsWith("\"") && raw.endsWith("\"")) raw = raw.substring(1, raw.length() - 1);
            if (raw.startsWith("'") && raw.endsWith("'")) raw = raw.substring(1, raw.length() - 1);

            if (raw.startsWith("postgresql://") || raw.startsWith("postgres://") || raw.startsWith("jdbc:postgresql://")) {
                String clean = raw.replaceFirst("^jdbc:", "").replaceFirst("^postgres(ql)?://", "");
                int atIdx = clean.indexOf('@');
                if (atIdx > 0) {
                    String userPass = clean.substring(0, atIdx);
                    clean = clean.substring(atIdx + 1);
                    int colon = userPass.indexOf(':');
                    if (colon > 0) {
                        config.setUsername(userPass.substring(0, colon));
                        config.setPassword(userPass.substring(colon + 1));
                    } else {
                        config.setUsername(userPass);
                    }
                }

                // Strip channel_binding if present
                clean = clean.replace("channel_binding=require&", "")
                             .replace("&channel_binding=require", "")
                             .replace("?channel_binding=require", "?");
                if (clean.endsWith("?")) {
                    clean = clean.substring(0, clean.length() - 1);
                }

                String finalJdbcUrl = "jdbc:postgresql://" + clean;
                config.setJdbcUrl(finalJdbcUrl);
                log.info("Configured JDBC URL successfully");
            } else {
                config.setJdbcUrl(raw);
            }
        } else {
            log.warn("No database URL provided, falling back to localhost:5432");
            config.setJdbcUrl("jdbc:postgresql://localhost:5432/sketchflow_db");
        }

        if (username != null && !username.isBlank()) {
            config.setUsername(username);
        }
        if (password != null && !password.isBlank()) {
            config.setPassword(password);
        }

        config.setMaximumPoolSize(10);
        config.setMinimumIdle(2);
        config.setIdleTimeout(300000);
        config.setConnectionTimeout(20000);

        return new HikariDataSource(config);
    }

    private Map<String, String> loadDotEnv() {
        Map<String, String> map = new HashMap<>();
        Path[] candidates = new Path[]{
                Paths.get(".env.local"),
                Paths.get(".env"),
                Paths.get("..", ".env.local"),
                Paths.get("..", ".env")
        };

        for (Path p : candidates) {
            if (Files.exists(p)) {
                try (BufferedReader reader = Files.newBufferedReader(p)) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        line = line.trim();
                        if (line.isEmpty() || line.startsWith("#")) continue;
                        int idx = line.indexOf('=');
                        if (idx > 0) {
                            String k = line.substring(0, idx).trim();
                            String v = line.substring(idx + 1).trim();
                            map.put(k, v);
                        }
                    }
                    log.info("Loaded {} variables from {}", map.size(), p.toAbsolutePath());
                    break;
                } catch (Exception e) {
                    log.warn("Could not read {}: {}", p, e.getMessage());
                }
            }
        }
        return map;
    }
}
