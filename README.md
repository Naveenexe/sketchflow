# SketchFlow

**SketchFlow** is a browser-based collaborative online whiteboard built with **React**, **TypeScript**, **Excalidraw**, **Java Spring Boot**, and **Neon PostgreSQL**.

Live Demo: **[https://sketchflow.watarenaveen.workers.dev/](https://sketchflow.watarenaveen.workers.dev/)**

---

## Features

- **Accounts & Security:** Email/password registration and login with BCrypt hashing, stateless JWT authentication, rate limiting on sensitive endpoints, and strict server-side authorization.
- **Workspace Dashboard:** Create, rename, duplicate, archive/restore, and delete boards.
- **Whiteboard Canvas:** Powered by `@excalidraw/excalidraw` with freehand drawing, shapes, arrows, text, undo/redo, zoom/pan, and dark/light theme support.
- **Cloud Autosave & Offline Recovery:** Debounced scene persistence to PostgreSQL JSONB with live status (`Saved`, `Saving...`, `Offline / Retrying`) and local recovery backup.
- **Real-Time Collaboration:** Authenticated WebSocket rooms (`/ws`) with live collaborator cursors, active participant presence, throttled scene broadcasting, deterministic element merging, and reconnect resynchronization.
- **Sharing & Permissions:** Invite registered collaborators as `EDITOR` or `VIEWER`, or generate unguessable, revocable share links with optional expiry dates.
- **Export & Backup:** Export boards as PNG, SVG, or portable JSON backups, plus validated JSON import.

---

## Architecture

| Layer | Technology | Hosting |
| :--- | :--- | :--- |
| Frontend | React 19, TypeScript, Vite, Zustand, `@excalidraw/excalidraw` | Cloudflare Workers / Pages |
| Backend | Java 21+, Spring Boot 3.4, Spring Security, Spring WebSocket, Flyway | Render (Docker) |
| Database | PostgreSQL 18 (JSONB scene persistence) | Neon |

---

## Project Structure

```text
sketchflow/
├── frontend/                 # React + TypeScript + Vite + Excalidraw
│   ├── src/
│   │   ├── components/       # ShareModal, ExportModal, CloudStatusBadge
│   │   ├── hooks/            # useCollaboration (WebSocket sync & cursors)
│   │   ├── pages/            # AuthPage, DashboardPage, BoardEditorPage, SharedBoardPage
│   │   ├── services/         # Typed Axios REST API clients
│   │   ├── store/            # Zustand auth store
│   │   └── types/            # Shared TypeScript interfaces
│   └── package.json
├── backend/                  # Spring Boot REST API & WebSocket Server
│   ├── src/main/java/com/sketchflow/
│   │   ├── config/           # DataSource, Security, CORS, WebSocket config
│   │   ├── controller/       # Auth, User, Board, ShareLink, Health controllers
│   │   ├── dto/              # Request/Response DTOs
│   │   ├── entity/           # JPA Entities (User, Board, BoardMember, ShareLink, BoardSnapshot)
│   │   ├── repository/       # Spring Data JPA repositories
│   │   ├── security/         # JWT service, auth filter, IP rate limiter
│   │   ├── service/          # Business rules & authorization checks
│   │   └── websocket/        # Authenticated room handler & handshake interceptor
│   ├── src/main/resources/db/migration/ # Flyway SQL migrations
│   └── Dockerfile
├── docs/
│   └── SketchFlow-SRS.md     # Software Requirements Specification
└── README.md
```

---

## Local Development

### Prerequisites
- Node.js 18+ and npm
- Java 21+
- Hosted PostgreSQL database (e.g., [Neon](https://neon.tech))

### 1. Environment Variables
Never commit secrets or `.env.local` to Git.

**Backend (`.env.local` in root or environment variables):**
```env
DATABASE_URL=postgresql://<user>:<password>@<neon-host>/sketchflow_db?sslmode=require
JWT_SECRET=<your-64-char-random-secret>
APP_CORS_ALLOWED_ORIGINS=http://localhost:5173
SERVER_PORT=8080
```

**Frontend (`frontend/.env.local`):**
```env
VITE_API_BASE_URL=http://localhost:8080/api/v1
VITE_WS_URL=ws://localhost:8080/ws
```

### 2. Run Backend & Tests
```bash
cd backend
./mvnw test
./mvnw spring-boot:run
```

### 3. Run Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## Deployment Guide

1. **Database (Neon):** Create a Neon project and database (`sketchflow_db`). Use the pooled connection string (`-pooler`) for application traffic.
2. **Backend (Render / Docker):** Connect the GitHub repo with Root Directory `backend` and Runtime `Docker`. Configure `DATABASE_URL`, `JWT_SECRET`, and `APP_CORS_ALLOWED_ORIGINS` (set to your exact frontend origin, e.g., `https://sketchflow.watarenaveen.workers.dev`) in Render's Environment tab.
3. **Frontend (Cloudflare Pages / Workers):** Connect the GitHub repo with Root Directory `frontend`, Build command `npm run build`, Output directory `dist`, and set `VITE_API_BASE_URL` and `VITE_WS_URL` to your deployed backend URL.

---

## Database Backup & Restore Procedure

- **Board-Level Portable Backups:** Users can export any board as `.sketchflow.json` via the **Export → Portable JSON Backup** button and restore it via **Import JSON Backup**.
- **Point-in-Time Recovery (Neon):** Neon automatically retains WAL history for instant branching and point-in-time recovery from the Neon Console.
- **Logical SQL Backup / Restore (`pg_dump` / `psql`):** Use the **direct (unpooled)** Neon connection string (`DATABASE_URL_UNPOOLED`) for backups and restores:
  ```bash
  # Export full schema and data
  pg_dump "$DATABASE_URL_UNPOOLED" -Fc -f sketchflow_backup.dump

  # Restore to a target Neon branch or database
  pg_restore --clean --if-exists -d "$TARGET_DATABASE_URL_UNPOOLED" sketchflow_backup.dump
  ```
