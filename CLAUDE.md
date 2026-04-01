# NotifyQ — Claude Code Guide

## Project Overview

NotifyQ is a self-hosted push notification server (Gotify-like) written in Go. It provides real-time notifications via WebSockets, a REST API, JWT-based user auth, per-app token auth, and an embedded web UI.

**Module:** `github.com/deannos/notification-queue`  
**Go Version:** 1.23 (CGO required for SQLite)

## Build & Run

```bash
# Run in development
make run          # CGO_ENABLED=1 go run .

# Build binary
make build        # outputs ./notifyq

# Clean build artifacts and database
make clean

# Docker
docker build -t notifyq .
docker run -p 8080:8080 -v notifyq-data:/data notifyq
```

CGO must be enabled (`CGO_ENABLED=1`) because the SQLite driver requires it.

## Configuration

All configuration is via environment variables. Copy `.env.example` to `.env`:

| Variable | Default | Description |
|---|---|---|
| `LISTEN_ADDR` | `:8080` | HTTP listen address |
| `DATABASE_PATH` | `notifications.db` | SQLite file path |
| `JWT_SECRET` | — | Must be set in production |
| `JWT_EXPIRY_HOURS` | `24` | JWT lifetime |
| `DEFAULT_ADMIN_USER` | `admin` | Auto-created admin username |
| `DEFAULT_ADMIN_PASS` | `admin` | Auto-created admin password |
| `ALLOW_REGISTRATION` | `true` | Allow open user registration |

## Architecture

```
main.go          → wires config, db, hub, router, HTTP server
config/          → env-var loading
db/              → GORM + SQLite init, WAL mode, migrations
models/          → User, App, Notification (GORM structs)
auth/            → JWT generation/parsing, app token generation
middleware/      → JWT Bearer auth, admin guard, X-App-Token auth
handlers/        → HTTP handlers (auth, notifications, apps, users, WebSocket)
hub/             → per-user WebSocket broadcast hub
router/          → Gin route registration
web/             → embedded static assets (HTML/JS/CSS)
```

## API Endpoints

| Auth | Endpoint | Description |
|---|---|---|
| Public | `POST /auth/login` | Get JWT |
| Public | `POST /auth/register` | Register (if enabled) |
| Public | `GET /health` | Health check |
| App token | `POST /message` | Send notification |
| JWT | `GET /api/v1/notification` | List notifications |
| JWT | `GET/DELETE /api/v1/notification/:id` | Get/delete notification |
| JWT | `PUT /api/v1/notification/:id/read` | Mark read |
| JWT | `GET /api/v1/app` | List apps |
| JWT | `POST /api/v1/app` | Create app |
| JWT | `PUT/DELETE /api/v1/app/:id` | Update/delete app |
| JWT | `PUT /api/v1/app/:id/token` | Rotate app token |
| Admin JWT | `GET/POST /api/v1/user` | List/create users |
| Admin JWT | `PUT/DELETE /api/v1/user/:id` | Update/delete user |
| JWT (query) | `GET /ws?token=<jwt>` | WebSocket stream |

## Key Implementation Details

- **Database:** SQLite with WAL mode and foreign keys enabled. Schema is auto-migrated on startup.
- **App tokens:** 64-character hex strings (32 random bytes). Sent via `X-App-Token` header or `?token=` query param.
- **JWT:** Bearer token in `Authorization` header. WebSocket uses `?token=` query param since headers aren't available.
- **WebSocket hub:** per-user broadcast channels; 256-entry per-client queue; 1024-entry broadcast queue; ping/pong keep-alive (54s ping, 60s pong timeout).

## Testing

No tests exist yet. When adding tests:
- Use `testing` + `httptest` for handler tests
- Use in-memory SQLite (`:memory:`) for DB tests
- Run with `go test ./...`
