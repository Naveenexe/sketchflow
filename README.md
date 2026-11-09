# SketchFlow

SketchFlow is a collaborative online whiteboard built with React, Excalidraw, and Java Spring Boot.

## Architecture

- **Frontend:** React + TypeScript + Vite, `@excalidraw/excalidraw`, Lucide Icons, Zustand
- **Backend:** Java Spring Boot, Spring Security, Spring WebSocket, Spring Data JPA, Flyway
- **Database:** Hosted PostgreSQL (Neon)
- **Deployment:** Cloudflare Pages (Frontend), Koyeb (Backend)

## Project Structure

```text
sketchflow/
├── frontend/     # React + TypeScript + Vite + Excalidraw
├── backend/      # Spring Boot REST API & WebSocket server
├── docs/         # Specifications and documentation
├── .gitignore
└── README.md
```

## Getting Started

### Prerequisites
- Node.js 18+ (tested with v24)
- npm 9+
- Java 21+ (tested with JDK 26)
- Git

### Running the Frontend
```bash
cd frontend
npm install
npm run dev
```

