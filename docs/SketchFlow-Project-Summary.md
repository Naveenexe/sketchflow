# SketchFlow — Project Architecture & Implementation Summary

**Date:** 10 November 2026  
**Repository:** `https://github.com/Naveenexe/sketchflow`  
**Status:** MVP Complete (Milestones 0–7 implemented, tested, and deployed)

---

## 1. Product Overview

**SketchFlow** is a browser-based collaborative online whiteboard built around `@excalidraw/excalidraw`. It provides user authentication, a personal/shared workspace dashboard, cloud board persistence, real-time multiplayer collaboration (live cursors, presence, element syncing), role-based access control (`OWNER`, `EDITOR`, `VIEWER`), revocable share links, and PNG/SVG/JSON export & import.

---

## 2. Technology Stack

### Frontend (`frontend/`)
- **Framework:** React `^19.3.1`, TypeScript `~7.0.2`, Vite `^8.3.6`
- **Whiteboard Engine:** `@excalidraw/excalidraw` (pinned at `0.18.1`)
- **Routing:** `react-router-dom` `^7.18.5` (`HashRouter`)
- **State Management:** `zustand` `^5.1.0`
- **HTTP Client:** `axios` `^1.21.1`
- **Icons:** `lucide-react` `^1.70.0`
- **Styling:** Custom CSS (`frontend/src/index.css`) — no CSS framework (no Tailwind currently installed)
- **Hosting:** Cloudflare Workers (Static Assets)

### Backend (`backend/`)
- **Language & Runtime:** Java 21 (`pom.xml` target), Spring Boot `3.4.2`
- **Web & Realtime:** `spring-boot-starter-web`, `spring-boot-starter-websocket` (raw Spring `TextWebSocketHandler`)
- **Security:** `spring-boot-starter-security`, BCrypt password hashing, stateless JWT via `io.jsonwebtoken:jjwt-*` (`0.12.6`)
- **Persistence:** `spring-boot-starter-data-jpa`, Hibernate 6 (`@JdbcTypeCode(SqlTypes.JSON)` for JSONB), HikariCP
- **Migrations:** Flyway (`flyway-core`, `flyway-database-postgresql`)
- **Validation:** `spring-boot-starter-validation`
- **Hosting:** Render (Docker multi-stage build with extracted JAR layers)

### Database
- **Engine:** Hosted PostgreSQL 18.6 on **Neon** (serverless Postgres with `-pooler` connection for runtime queries)

---

## 3. Database Schema (Flyway Migrations `V1` & `V2`)

1. **`users`**: `id` (UUID PK), `email` (unique), `password_hash`, `display_name`, `avatar_url`, `created_at`, `updated_at`
2. **`boards`**: `id` (UUID PK), `owner_id` (FK → `users`), `title`, `scene_json` (`JSONB`), `thumbnail_url`, `version` (int), `archived` (boolean), `created_at`, `updated_at`
3. **`board_members`**: `id` (UUID PK), `board_id` (FK → `boards`), `user_id` (FK → `users`), `role` (`OWNER` | `EDITOR` | `VIEWER`), `joined_at` (unique `(board_id, user_id)`)
4. **`share_links`**: `id` (UUID PK), `board_id` (FK → `boards`), `token_hash` (SHA-256 hex, unique), `permission` (`EDITOR` | `VIEWER`), `expires_at`, `revoked_at`, `created_by`, `created_at`
5. **`board_snapshots`**: `id` (UUID PK), `board_id` (FK → `boards`), `version`, `scene_json` (`JSONB`), `created_by`, `created_at` (auto-captured every 5th board save)

---

## 4. Implemented Backend APIs & WebSocket Protocol

### REST Endpoints (`/api/v1`)
- **Health:**
  - `GET /api/v1/health` — Public health check + live PostgreSQL connectivity check
- **Authentication & Users:**
  - `POST /api/v1/auth/register` — Account creation + JWT issuance
  - `POST /api/v1/auth/login` — Email/password login + JWT issuance
  - `POST /api/v1/auth/logout` — Stateless logout endpoint
  - `GET /api/v1/users/me` — Current user profile
- **Boards:**
  - `GET /api/v1/boards` — List all owned & shared boards for authenticated user
  - `POST /api/v1/boards` — Create board
  - `GET /api/v1/boards/{boardId}` — Fetch board metadata & scene (role-checked)
  - `PATCH /api/v1/boards/{boardId}` — Rename or archive/restore board (`OWNER` only)
  - `POST /api/v1/boards/{boardId}/duplicate` — Duplicate board (`OWNER` only)
  - `DELETE /api/v1/boards/{boardId}` — Delete board (`OWNER` only)
  - `GET /api/v1/boards/{boardId}/scene` — Fetch serialized Excalidraw scene
  - `PUT /api/v1/boards/{boardId}/scene` — Persist scene JSONB (enforces 5 MB limit; `OWNER`/`EDITOR` only, blocks `VIEWER`)
- **Members & Share Links:**
  - `GET /api/v1/boards/{boardId}/members` — List board members
  - `POST /api/v1/boards/{boardId}/members` — Invite/update registered user role (`OWNER` only)
  - `DELETE /api/v1/boards/{boardId}/members/{userId}` — Remove collaborator (`OWNER` only)
  - `GET /api/v1/boards/{boardId}/share-links` — List active share links (`OWNER` only)
  - `POST /api/v1/boards/{boardId}/share-links` — Generate 32-byte `SecureRandom` token, store SHA-256 hash, return raw token once (`OWNER` only)
  - `DELETE /api/v1/share-links/{linkId}` — Revoke share link (`OWNER` only)
  - `GET /api/v1/share-links/{token}` — Public/authenticated token resolution (validates expiry & revocation; unauthenticated visitors allowed for `VIEWER` links only)

### Real-Time WebSocket (`/ws`)
- **Handshake Security:** `JwtHandshakeInterceptor` validates JWT via `?token=` query parameter or `Authorization` header.
- **Room & Sync Engine (`CollabWebSocketHandler`):**
  - Client events: `JOIN_BOARD`, `LEAVE_BOARD`, `SCENE_UPDATE`, `CURSOR_UPDATE`, `PRESENCE_PING`, `REQUEST_SYNC`
  - Server events: `BOARD_STATE`, `SCENE_UPDATE`, `CURSOR_UPDATE`, `PRESENCE_UPDATE`, `ERROR`
  - Includes per-room monotonic sequence numbers, bounded `eventId` deduplication (1,000 events), and server-side blocking of `SCENE_UPDATE` from `VIEWER` sessions.

---

## 5. Implemented Frontend Modules (`frontend/src/`)

- **`pages/AuthPage.tsx`**: Login & Registration UI with client/server validation and cold-start indicator.
- **`pages/DashboardPage.tsx`**: Workspace dashboard with board creation, Active/Archived tabs, inline rename, duplicate, archive/restore, delete, and role badges.
- **`pages/BoardEditorPage.tsx`**:
  - Top application shell (back button, SketchFlow brand, editable board title, autosave status pill, live collaborator avatars, WebSocket sync badge, Export modal trigger, Share modal trigger).
  - Embedded `<Excalidraw />` canvas with `viewModeEnabled` enforced for `VIEWER`.
  - Debounced autosave (1.2s) + immediate `localStorage` backup (`sketchflow_unsaved_<boardId>`) and online auto-retry.
  - Deterministic element merging (`version` + `versionNonce`) for concurrent collaboration.
- **`pages/SharedBoardPage.tsx`**: Public read-only view at `/#/share/:token` (redirects signed-in users on `EDITOR` links to the live collaborative editor).
- **`hooks/useCollaboration.ts`**: WebSocket lifecycle, 80ms throttled scene batching, 50ms throttled cursor broadcasting, 25s heartbeat pings, exponential-backoff reconnect, and automatic state resync.
- **`components/ShareModal.tsx`**: Two-tab modal for inviting collaborators by email and creating/revoking share links.
- **`components/ExportModal.tsx`**: PNG export (`exportToBlob`), SVG export (`exportToSvg`), `.sketchflow.json` backup export, and validated JSON backup import (5 MB cap, hidden for `VIEWER`).
- **`components/CloudStatusBadge.tsx`**: Live backend/database health indicator with one-click retry.

---

## 6. Security & Reliability Measures

- Passwords hashed with BCrypt; JWTs signed with HMAC-SHA.
- `RateLimitFilter`: IP-based sliding window limits on `/api/v1/auth/**` (25 req/min) and `/api/v1/share-links/**` (40 req/min).
- Security HTTP headers: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`.
- Size caps: 5 MB max `sceneJson` on REST saves and JSON imports; 1 MB max WebSocket message buffer.
- Share-link secrets stored only as SHA-256 hashes; audited logs contain zero secrets or scene contents.

---

## 7. Automated Tests Currently Passing

- `BoardServiceTest` (5/5 passing): Owner, Editor, Viewer, and Outsider authorization + board creation.
- `ShareLinkServiceTest` (4/4 passing): Token hashing, valid viewer resolution, revoked/expired rejection, owner-only creation.
- `CollabWebSocketHandlerTest` (3/3 passing): Editor broadcast + `eventId` deduplication, Viewer `SCENE_UPDATE` rejection, unauthorized room join rejection.
- Frontend production TypeScript check + Vite build (`tsc -b && vite build`): passing.

---

## 8. Current MVP Boundaries (Good Candidates for Future Enhancements)

- **UI/UX:** Currently uses hand-written CSS in `index.css`; no dark mode shell styling outside Excalidraw's canvas, no landing page/marketing hero, no board thumbnail previews on dashboard cards, no search/sort/folders on the dashboard.
- **Collaboration & Social:** Single-instance in-memory WebSocket rooms (no Redis pub/sub yet); no board comments/threads, no follow-user viewport mode, no live participant cursor labels toggle.
- **Productivity Features:** No board templates (architecture diagrams, flowcharts, wireframes), no version history UI (even though `board_snapshots` are already saved in Postgres every 5 versions!), no presentation mode, no profile/avatar settings page.
- **Infrastructure:** Hosted on free tiers (Render cold-starts after 15 mins idle; Cloudflare Workers static assets subdomain includes the account subdomain unless using Cloudflare Pages or a custom domain).
