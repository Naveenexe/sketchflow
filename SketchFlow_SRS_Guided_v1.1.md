---
date: 9 November 2026
status: Living document --- implementation baseline
subtitle: Product requirements and guided implementation plan
title: SketchFlow --- Software Requirements Specification
version: 1.1
---

# SketchFlow

**A collaborative online whiteboard built with React, Excalidraw and
Java Spring Boot.**

> **How to use this document**
>
> This document is both the product SRS and the step-by-step
> implementation guide. Follow it in order. At each stage, explain what
> is being done, provide exact commands and file paths, and verify the
> result before moving on. If an external account or service is needed,
> first explain why it is needed and guide the user through
> creating/configuring it. Ask the user to confirm when they have
> completed that step. Never ask the user to paste passwords, API
> secrets, database connection strings, access tokens, recovery codes,
> or other credentials into chat. Show them how to enter secrets locally
> or in the provider's environment-variable settings.

## 1. Product overview

### 1.1 Purpose

SketchFlow is a browser-based collaborative whiteboard. Users can create
visual boards, draw diagrams, explain technical concepts, brainstorm,
and collaborate with other people on the same canvas in real time.

SketchFlow will use the open-source Excalidraw editor as its drawing
foundation. The SketchFlow team will build its own product identity,
dashboard, accounts, board management, persistence, permissions,
sharing, and collaboration services.

### 1.2 Product goals

-   Provide a useful whiteboard that people can access through a public
    website.
-   Allow users to create, save, reopen, and share boards.
-   Allow multiple authorized users to collaborate on one board in real
    time.
-   Support developers, trainers, educators, students, and small teams.
-   Deploy the frontend, backend, and database online.
-   Keep development and deployment steps understandable and
    reproducible.
-   Start with free or free-tier services where practical, while
    documenting their limitations.

### 1.3 Product principles

1.  **Useful before complex:** deliver a reliable editor and board
    saving before advanced features.
2.  **Cloud-first:** use a hosted PostgreSQL database for development
    and deployment; local database installation is not required.
3.  **Secure by default:** never expose credentials in source code or
    chat.
4.  **Own product identity:** do not copy Excalidraw branding or imply
    that SketchFlow is an official Excalidraw product.
5.  **Incremental delivery:** implement, run, test, and verify one
    milestone at a time.

### 1.4 Out of scope for the initial MVP

-   Native iOS/Android applications.
-   Audio/video conferencing.
-   Enterprise SSO and SCIM.
-   Billing and subscriptions.
-   Guaranteed offline multi-device synchronization.
-   Advanced CRDT-based conflict-free editing unless required after MVP
    testing.
-   Enterprise-grade availability guarantees on free hosting tiers.

## 2. Users and roles

  -----------------------------------------------------------------------
  Role                                Permissions
  ----------------------------------- -----------------------------------
  Visitor                             View public landing page; open a
                                      valid public read-only board link
                                      if enabled

  Registered user                     Create boards; manage own profile;
                                      access boards shared with them

  Owner                               Rename, duplicate, archive, delete,
                                      share board, manage members

  Editor                              View and edit a board

  Viewer                              View a board but cannot edit

  Administrator                       Future operational/support role;
                                      not required for MVP
  -----------------------------------------------------------------------

## 3. Functional requirements

### 3.1 Accounts and authentication

-   **FR-AUTH-01:** Users can register using email and password.
-   **FR-AUTH-02:** Users can log in and log out.
-   **FR-AUTH-03:** Passwords are stored only as secure one-way hashes.
-   **FR-AUTH-04:** Authenticated API requests are protected by a secure
    authentication mechanism.
-   **FR-AUTH-05:** Users can view and update basic profile information.
-   **FR-AUTH-06:** The application provides clear validation and error
    messages.

### 3.2 Board management

-   **FR-BOARD-01:** A signed-in user can create a board with a title.
-   **FR-BOARD-02:** An owner can rename, duplicate, archive, and delete
    a board.
-   **FR-BOARD-03:** A user can see boards they own or have permission
    to access.
-   **FR-BOARD-04:** The application saves a board scene and restores it
    when reopened.
-   **FR-BOARD-05:** Board records contain creation and update
    timestamps.
-   **FR-BOARD-06:** Autosave provides a visible state such as Saving,
    Saved, or Offline/Retrying.
-   **FR-BOARD-07:** The client protects unsaved work during temporary
    network interruptions.

### 3.3 Whiteboard editor

The embedded Excalidraw editor should provide the supported editor
capabilities, including:

-   Freehand drawing.
-   Text.
-   Rectangles, ellipses, diamonds, lines, and arrows.
-   Selection, movement, resizing, duplication, and deletion.
-   Zoom and pan.
-   Undo and redo.
-   Keyboard shortcuts.
-   Export to PNG, SVG, and portable scene JSON where supported by the
    selected package version.

SketchFlow adds its own navigation shell, board title, save state,
participant list, sharing controls, and account menu.

### 3.4 Sharing and permissions

-   **FR-SHARE-01:** Owners can invite registered users to a board.
-   **FR-SHARE-02:** Owners can grant Editor or Viewer access.
-   **FR-SHARE-03:** Owners can revoke a member's access.
-   **FR-SHARE-04:** Owners can create and revoke share links.
-   **FR-SHARE-05:** Share links use unguessable tokens and may have
    expiry dates.
-   **FR-SHARE-06:** Every REST and WebSocket operation is authorized by
    the backend.
-   **FR-SHARE-07:** A viewer cannot submit editing operations.

### 3.5 Real-time collaboration

-   **FR-COLLAB-01:** Authorized participants can join a board room.
-   **FR-COLLAB-02:** Scene changes are delivered to other authorized
    participants.
-   **FR-COLLAB-03:** Participants can see other participants' cursors
    and presence.
-   **FR-COLLAB-04:** Events include board ID, user ID, event ID, and
    timestamp.
-   **FR-COLLAB-05:** Clients reconnect after temporary network loss and
    resynchronize.
-   **FR-COLLAB-06:** Viewer connections are read-only.
-   **FR-COLLAB-07:** High-frequency cursor and drawing events are
    throttled, debounced, or batched as appropriate.
-   **FR-COLLAB-08:** The synchronization design defines ordering,
    duplicate handling, conflict recovery, and snapshot restoration.
-   **FR-COLLAB-09:** The system displays connection and participant
    status.

**Important engineering constraint:** Embedding the Excalidraw editor
does not automatically provide a complete hosted multiplayer backend.
SketchFlow must implement its own authenticated collaboration transport
and synchronization strategy. Do not claim conflict-free simultaneous
editing until the chosen algorithm has been implemented and tested.

### 3.6 Export and import

-   Users can export boards as PNG and SVG where supported.
-   Users can export a portable JSON scene backup.
-   Imported JSON is validated for size and expected structure before
    loading.
-   Export and import must not bypass board permissions.

### 3.7 Future features

Possible post-MVP features:

-   Comments and annotations.
-   Board templates.
-   Presentation mode.
-   Version history and restore.
-   Team workspaces.
-   AI-assisted diagram generation.
-   Developer-oriented templates such as flowcharts, class diagrams, and
    architecture diagrams.

## 4. Non-functional requirements

### 4.1 Performance

-   Drawing interactions remain responsive and do not wait for a server
    round trip.
-   Under ordinary conditions, collaboration updates should normally
    reach connected peers within approximately 500 ms.
-   Dashboard API requests should normally complete within approximately
    one second, excluding cold starts and network conditions.
-   Large scene payloads are size-limited and updates are batched.

### 4.2 Reliability

-   The client handles temporary REST and WebSocket disconnections.
-   The UI clearly indicates saving and connection state.
-   Unsaved changes are retained locally until persistence is confirmed.
-   Reconnection triggers a safe synchronization/recovery process.

### 4.3 Security

-   Production traffic uses HTTPS and WSS.
-   Passwords use a modern password hashing algorithm such as BCrypt or
    Argon2.
-   Secrets are stored in environment variables or provider secret
    settings, never committed to Git.
-   Board ownership and roles are checked server-side for every
    operation.
-   Validate input and limit request, upload, scene, and WebSocket
    message sizes.
-   Configure CORS with explicit allowed origins.
-   Add rate limits to authentication and sensitive endpoints.
-   Never log passwords, access tokens, refresh tokens, share-link
    secrets, or private board contents.

### 4.4 Maintainability

-   Backend uses controller, service, repository, entity, and DTO
    layers.
-   Frontend uses reusable components, typed API contracts, and clear
    state boundaries.
-   Database changes use migrations (Flyway or Liquibase).
-   Editor integration, collaboration synchronization, and persistence
    remain separate modules.
-   Automated tests cover critical authorization and persistence
    behavior.

### 4.5 Browser support

Target current versions of Chrome, Edge, Firefox, and Safari where
practical. The initial editing experience is desktop-first but should
remain usable on tablets and mobile browsers for viewing and basic
interaction.

## 5. Technical architecture

### 5.1 Technology choices

  --------------------------------------------------------------------------
  Layer                   Technology                 Responsibility
  ----------------------- -------------------------- -----------------------
  Frontend                React + TypeScript + Vite  Web application

  Drawing engine          `@excalidraw/excalidraw`   Canvas and drawing
                                                     interactions

  Styling                 Tailwind CSS or a          SketchFlow visual
                          consistent component       identity
                          system                     

  Client state            Zustand (if needed)        UI and application
                                                     state

  Routing                 React Router               Page navigation

  HTTP                    Axios or fetch             REST API

  Backend                 Java + Spring Boot         API, business rules,
                                                     authorization

  Persistence             Spring Data JPA /          Database access
                          Hibernate                  

  Database                Hosted PostgreSQL          Users, boards,
                                                     permissions, snapshots

  Realtime                Spring WebSocket           Collaboration and
                                                     presence

  Authentication          Spring Security            Identity and
                                                     authorization

  Migrations              Flyway                     Database schema
                                                     evolution

  Frontend hosting        Cloudflare Pages           Static frontend
                                                     deployment

  Backend hosting         Koyeb or another suitable  Spring Boot deployment
                          host                       

  Database hosting        Neon PostgreSQL            Managed online database

  Source control          GitHub                     Repository and
                                                     deployment integration
  --------------------------------------------------------------------------

Pin the Excalidraw package version and verify its current public APIs
and licence terms before implementation. Preserve required copyright and
licence notices. SketchFlow must use its own branding.

### 5.2 Logical architecture

``` text
Browser
  |
  +-- React + TypeScript
  |     |
  |     +-- SketchFlow dashboard and navigation
  |     +-- Excalidraw editor
  |     +-- API client and application state
  |     +-- Collaboration client
  |
  +-- HTTPS REST ----------------------+
  |                                    |
  +-- WSS WebSocket -------------------+
                                       |
                              Spring Boot backend
                                       |
                    +------------------+------------------+
                    |                  |                  |
                 Security          Board API         WebSocket
                    |                  |                  |
                    +------------------+------------------+
                                       |
                               Service layer
                                       |
                                Repositories
                                       |
                               Neon PostgreSQL
```

### 5.3 Initial REST API contract

Base path: `/api/v1`

  Method   Endpoint                               Purpose
  -------- -------------------------------------- ------------------------
  POST     `/auth/register`                       Register account
  POST     `/auth/login`                          Log in
  POST     `/auth/refresh`                        Refresh authentication
  POST     `/auth/logout`                         Log out
  GET      `/users/me`                            Current user
  GET      `/boards`                              List accessible boards
  POST     `/boards`                              Create board
  GET      `/boards/{boardId}`                    Get board metadata
  PATCH    `/boards/{boardId}`                    Update board metadata
  DELETE   `/boards/{boardId}`                    Delete board
  GET      `/boards/{boardId}/scene`              Load board scene
  PUT      `/boards/{boardId}/scene`              Persist board scene
  GET      `/boards/{boardId}/members`            List members
  POST     `/boards/{boardId}/members`            Add/invite member
  DELETE   `/boards/{boardId}/members/{userId}`   Remove member
  POST     `/boards/{boardId}/share-links`        Create share link
  DELETE   `/share-links/{linkId}`                Revoke share link

Exact request/response payloads, status codes, validation rules, and
OpenAPI documentation are finalized during implementation.

### 5.4 WebSocket event contract

Use a secure WebSocket endpoint, initially `/ws`.

Conceptual client events:

-   `JOIN_BOARD`
-   `LEAVE_BOARD`
-   `SCENE_UPDATE`
-   `CURSOR_UPDATE`
-   `PRESENCE_PING`
-   `REQUEST_SYNC`

Conceptual server events:

-   `BOARD_STATE`
-   `SCENE_UPDATE`
-   `CURSOR_UPDATE`
-   `PRESENCE_UPDATE`
-   `SYNC_REQUIRED`
-   `ERROR`

Every board event must be authenticated and permission-checked. Cursor
and presence events are ephemeral. Durable scene changes are persisted
on a controlled cadence.

## 6. Data model

Initial entities:

### User

-   `id`
-   `email` (unique)
-   `password_hash`
-   `display_name`
-   `avatar_url` (optional)
-   `created_at`
-   `updated_at`

### Board

-   `id`
-   `owner_id`
-   `title`
-   `scene_json`
-   `thumbnail_url` (optional)
-   `version`
-   `created_at`
-   `updated_at`

### BoardMember

-   `id`
-   `board_id`
-   `user_id`
-   `role` (OWNER, EDITOR, VIEWER)
-   `joined_at`

### ShareLink

-   `id`
-   `board_id`
-   `token_hash`
-   `permission`
-   `expires_at`
-   `revoked_at`
-   `created_by`

### BoardSnapshot

-   `id`
-   `board_id`
-   `version`
-   `scene_json`
-   `created_at`
-   `created_by`

Relationships:

-   One user can own many boards.
-   One board has one owner.
-   A board can have many members.
-   BoardMember connects users and boards with a role.
-   A board can have many share links and snapshots.

Use PostgreSQL JSONB or an equivalently validated representation for the
serialized scene. Add indexes for board ownership, membership lookup,
and board loading. Use migrations for schema changes.

## 7. Cloud-first development and deployment

### 7.1 Recommended initial topology

  Component           Initial provider   Intended use
  ------------------- ------------------ -------------------------------
  Source repository   GitHub             Code and version control
  React frontend      Cloudflare Pages   Public web application
  Java backend        Koyeb              Spring Boot API and WebSocket
  PostgreSQL          Neon               Hosted database

Provider free tiers, regions, limits, and availability can change.
Confirm current terms during setup. Free tiers may sleep, restart,
enforce quotas, or provide limited backup guarantees. This setup is
appropriate for learning, testing, and a small demo, not a promise of
production-grade uptime.

### 7.2 Development and production configuration

The application should use environment-specific configuration.

Frontend variables:

-   `VITE_API_BASE_URL`
-   `VITE_WS_URL`

Backend variables:

-   `SPRING_DATASOURCE_URL`
-   `SPRING_DATASOURCE_USERNAME`
-   `SPRING_DATASOURCE_PASSWORD`
-   `JWT_SECRET` (if JWT is selected)
-   `APP_CORS_ALLOWED_ORIGINS`
-   `SERVER_PORT`

Never put backend secrets in frontend variables. Anything prefixed with
`VITE_` is exposed to the browser.

Use separate development and production database environments when the
application begins storing real user data. Do not test destructive
migrations against production.

### 7.3 Database safety

-   Use a managed PostgreSQL database.
-   Keep credentials only in local environment files excluded from Git
    and in the hosting provider's secret settings.
-   Use a least-privilege database role where supported.
-   Enable backups or scheduled exports before storing important data.
-   Provide JSON board export so users can retain portable copies.
-   Verify connection pooling and idle connection behavior for the
    selected provider.

## 8. Testing and acceptance criteria

### 8.1 Unit tests

Test authentication, board ownership, role checks, scene validation, and
collaboration authorization. Use JUnit 5 and Mockito for Java. Use
Vitest and React Testing Library for frontend logic.

### 8.2 Integration tests

Test REST endpoints with a test database. Test WebSocket room joining,
updates, presence, viewer restrictions, reconnect, and snapshot
recovery. Test database migrations from a clean schema.

### 8.3 End-to-end tests

Verify:

1.  A user can register and log in.
2.  The user can create a board.
3.  The user can draw and save.
4.  The board can be reopened from another browser.
5.  The owner can invite a friend.
6.  An editor can draw and the change reaches another connected editor.
7.  A viewer cannot edit.
8.  A disconnected client can reconnect and recover the latest persisted
    scene.
9.  A revoked member or share link no longer grants access.
10. PNG, SVG, and JSON export work as supported.

### 8.4 MVP acceptance criteria

The MVP is ready for a small public demo when all ten end-to-end checks
above pass, critical security checks pass, and the application is
deployed over HTTPS with a working hosted database.

## 9. Risks and mitigations

  -----------------------------------------------------------------------
  Risk                                Mitigation
  ----------------------------------- -----------------------------------
  Concurrent edits overwrite each     Define event ordering,
  other                               deduplication, versioning,
                                      batching, and recovery; test
                                      multiple clients

  Free hosting cold starts            Show loading/retry states; tune JVM
                                      memory; upgrade if needed

  Excalidraw package API changes      Pin versions; use an adapter;
                                      review release notes

  Database data loss                  Enable backups/exports; retain
                                      portable board JSON

  Unauthorized board access           Enforce permissions on every REST
                                      and WebSocket operation

  Large board payloads                Validate and cap scene size; batch
                                      updates

  WebSocket reconnect duplicates      Add event IDs and idempotent
                                      processing
  -----------------------------------------------------------------------

## 10. Step-by-step implementation guide

**Guidance rule:** Do not skip ahead. Complete the current milestone,
run the verification steps, and ask the user to confirm before
proceeding. If a command fails, diagnose that failure before adding more
features. Prefer small, testable changes over generating the entire
application at once.

### Milestone 0 --- Confirm development environment

1.  Ask which editor/IDE the user will use (Antigravity, VS Code,
    IntelliJ IDEA, or another).
2.  Ask whether Node.js, npm, Java 21+, and Git are installed.
3.  Provide commands to check versions:
    -   `node -v`
    -   `npm -v`
    -   `java -version`
    -   `git --version`
4.  If anything is missing, guide the user to the official installation
    page and ask them to confirm installation.
5.  Do not ask for any account credentials.

**Complete when:** tools are installed and version checks succeed.

### Milestone 1 --- Create the repository and React editor

1.  Create a GitHub repository named `sketchflow` only after explaining
    why GitHub is needed and asking whether the user already has an
    account.
2.  If the user has no GitHub account, guide them to create one; ask
    them to confirm before continuing.
3.  Create a Vite React + TypeScript frontend.
4.  Install and pin `@excalidraw/excalidraw`.
5.  Embed the editor in the React application.
6.  Add a minimal SketchFlow application shell and brand identity.
7.  Run the frontend locally and verify drawing, selection, undo/redo,
    and export.
8.  Commit the working baseline to Git.

**Complete when:** the editor works locally and the code is committed.

### Milestone 2 --- Create the hosted PostgreSQL database

1.  Explain that Neon provides the hosted PostgreSQL database so a local
    PostgreSQL installation is unnecessary.
2.  Ask whether the user already has a Neon account.
3.  If not, guide the user to the official Neon signup page and ask them
    to confirm account/project creation.
4.  Guide the user through creating a project named `sketchflow` and a
    database named `sketchflow_db`.
5.  Choose a region reasonably close to the intended users, if
    available.
6.  Show the user where Neon displays connection details.
7.  Never ask the user to paste the connection string or password into
    chat.
8.  Guide the user to store the connection values in a local backend
    environment file excluded from Git, and later in the backend host's
    secret settings.
9.  Verify connectivity with a small Spring Boot health/database check.

**Complete when:** Spring Boot can connect to the hosted PostgreSQL
database without exposing secrets.

### Milestone 3 --- Build and deploy the Spring Boot backend

1.  Ask whether the user already has a GitHub account/repository if not
    completed in Milestone 1.
2.  Generate the Spring Boot Maven project with Web, Security, Data JPA,
    PostgreSQL, Validation, WebSocket, and Flyway dependencies.
3.  Configure environment-based database settings.
4.  Add health endpoint and database connectivity check.
5.  Add entities, repositories, services, DTOs, and migrations.
6.  Run tests and verify API locally.
7.  Ask whether the user has a Koyeb account.
8.  If not, guide the user through creating one and ask them to confirm.
9.  Deploy the backend from GitHub or a Docker image.
10. Configure secrets in the provider dashboard; do not request secrets
    in chat.
11. Verify public health endpoint and database connectivity.

**Complete when:** deployed backend is reachable and can read/write the
hosted database.

### Milestone 4 --- Deploy the React frontend

1.  Ask whether the user has a Cloudflare account.
2.  If not, guide them to create one and ask them to confirm.
3.  Connect the GitHub repository to Cloudflare Pages.
4.  Configure the frontend build command and output directory
    (`npm run build`, `dist`).
5.  Set `VITE_API_BASE_URL` and `VITE_WS_URL` to the deployed backend
    URLs.
6.  Configure backend CORS to allow the deployed frontend origin.
7.  Deploy and verify the public site.

**Complete when:** the public website loads and can call the deployed
backend over HTTPS.

### Milestone 5 --- Authentication and board persistence

1.  Implement registration and login.
2.  Implement secure authentication and logout.
3.  Implement board CRUD.
4.  Implement board scene save/load.
5.  Implement autosave and visible save state.
6.  Add authorization tests for owner/editor/viewer.
7.  Verify a board persists after browser refresh and from a second
    device/browser.

**Complete when:** users can securely create, save, reopen, and manage
boards.

### Milestone 6 --- Real-time collaboration

1.  Define the collaboration event schema.
2.  Implement authenticated WebSocket connections.
3.  Implement board rooms and membership authorization.
4.  Implement participant presence and live cursors.
5.  Implement scene update broadcasting.
6.  Add event IDs, ordering/version checks, batching, and duplicate
    handling.
7.  Implement reconnect and full-scene resynchronization.
8.  Test with at least two separate browsers and two user accounts.
9.  Verify viewers cannot send edits.
10. Do not mark collaboration complete until simultaneous editing and
    recovery tests pass.

**Complete when:** two authorized editors can collaborate on the same
board and recover after a disconnect.

### Milestone 7 --- Sharing, export, security, and release

1.  Add invitations, viewer/editor roles, and revocable share links.
2.  Verify board exports and JSON backup/import validation.
3.  Add rate limiting, CORS restrictions, request limits, and secure
    headers.
4.  Review logs for accidental secret or private-content exposure.
5.  Run unit, integration, and end-to-end tests.
6.  Verify database backup/export and restore procedure.
7.  Write a user-facing README and deployment guide.
8.  Publish the MVP URL and invite a small test group.

**Complete when:** MVP acceptance criteria pass and the public demo is
safe for a small group to use.

## 11. External accounts and user confirmation policy

The implementation may require these accounts:

  -----------------------------------------------------------------------
  Account/service         Why it is needed        Ask the user when
  ----------------------- ----------------------- -----------------------
  GitHub                  Source code,            Before repository
                          repository, deployment  creation
                          integration             

  Neon                    Hosted PostgreSQL       Before creating cloud
                                                  database

  Koyeb                   Host Java backend       Before backend
                                                  deployment

  Cloudflare              Host React frontend     Before frontend
                                                  deployment
  -----------------------------------------------------------------------

Optional services such as a custom domain, email delivery, object
storage, monitoring, or AI APIs are not required for the first MVP. Ask
about them only when a feature actually needs them.

**For every account-dependent step:**

1.  State the service and purpose.
2.  Provide the official signup/login link.
3.  Explain exactly which project/settings to create.
4.  Ask the user to complete the step and confirm.
5.  Continue only after confirmation.
6.  Never ask the user to disclose credentials or secret values in chat.
7.  If a paid plan or payment method is required, stop and explain the
    cost/alternative before proceeding.

## 12. Initial setup commands

Use these commands only after confirming the user's development
environment.

### Create the project and React frontend

``` bash
mkdir sketchflow
cd sketchflow

npm create vite@latest frontend -- --template react-ts

cd frontend
npm install
npm install @excalidraw/excalidraw
npm install react-router-dom zustand axios lucide-react
npm run dev
```

### Suggested repository layout

``` text
sketchflow/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── store/
│   │   ├── types/
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── package.json
├── backend/
│   └── src/
│       ├── main/
│       │   ├── java/com/sketchflow/
│       │   │   ├── config/
│       │   │   ├── controller/
│       │   │   ├── service/
│       │   │   ├── repository/
│       │   │   ├── entity/
│       │   │   ├── dto/
│       │   │   ├── security/
│       │   │   └── websocket/
│       │   └── resources/
│       └── test/
├── docs/
│   └── SketchFlow-SRS.md
├── .gitignore
└── README.md
```

### Frontend editor integration starting point

The exact editor props and APIs must be checked against the installed,
pinned Excalidraw package version.

``` tsx
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";

export default function App() {
  return (
    <main style={{ width: "100%", height: "100vh" }}>
      <Excalidraw />
    </main>
  );
}
```

## 13. Immediate next action

Start with **Milestone 0**, not cloud account creation. First establish
the editor/IDE and verify the local development tools. Then proceed to
GitHub, Neon, Koyeb, and Cloudflare only when each milestone needs them.

**The assistant's next response when this guide is used should ask only
the most useful first question:**\
"Which editor will you use for SketchFlow: Antigravity, VS Code,
IntelliJ IDEA, or something else?"

After the user answers, guide them through checking the installed tools.
Do not ask for all service accounts at once.
