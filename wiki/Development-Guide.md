# Development Guide

Everything you need to set up a local development environment, understand the codebase, and contribute changes.

---

## Prerequisites

| Tool | Version | Purpose |
| ---- | ------- | ------- |
| Go | 1.25+ | Backend |
| gcc / clang | any | CGO (SQLite) |
| Node.js | 18+ | Frontend (Vite + React) |
| pnpm / npm | any | Frontend package manager |
| make | any | Build shortcuts |
| git | any | |

---

## Local setup

```bash
git clone https://github.com/deannos/notification-queue.git
cd notification-queue

# Backend — runs with hot-reload via Air (optional) or just go run
cp .env.example .env
make run          # builds UI once, then starts the Go server

# Frontend — live reload with HMR (proxies API calls to the running Go server)
make ui-dev
```

`make run` and `make ui-dev` can run simultaneously. The Vite dev server (`:5173`) proxies `/api`, `/auth`, `/message`, `/ws`, and `/health` to the Go server (`:8080`).

---

## Makefile targets

| Target | What it does |
| ------ | ------------ |
| `make run` | Build UI (`ui/`) → embed into `web/static/` → `go run .` |
| `make build` | Build UI → `go build -o notifyq .` |
| `make ui-dev` | `cd ui && pnpm dev` (Vite HMR dev server) |
| `make clean` | Remove `./notifyq`, `notifications.db`, and `ui/dist/` |

---

## Project layout

```
notification-queue/
├── main.go                    ← composition root: wire deps, start server
├── config/config.go           ← env-var loading + Validate()
├── models/                    ← GORM struct definitions (no logic)
│   ├── user.go
│   ├── app.go
│   └── notification.go
├── storage/
│   ├── port.go                ← repository interfaces (the seam)
│   └── sqlite/                ← GORM implementations
│       ├── user.go
│       ├── app.go
│       └── notification.go
├── auth/
│   ├── jwt.go                 ← JWT generation + parsing (HS256)
│   └── token.go               ← app token generation + SHA-256 hashing
├── db/
│   ├── db.go                  ← SQLite open, WAL mode, AutoMigrate
│   └── retention.go           ← background notification purge worker
├── hub/
│   ├── hub.go                 ← WebSocket hub event loop
│   └── ticket.go              ← 30 s WS auth tickets
├── middleware/
│   ├── jwt_auth.go
│   ├── app_token_auth.go
│   ├── rate_limit.go
│   └── logger.go
├── handlers/
│   ├── auth_handler.go
│   ├── user_handler.go
│   ├── app_handler.go
│   ├── notification_handler.go
│   └── ws_handler.go
├── router/router.go           ← Gin route registration
├── logger/logger.go           ← Zap singleton (dev: console, prod: JSON)
├── ui/                        ← React + TypeScript + Vite (source)
├── web/embed.go               ← embeds ui/dist/ into the binary
└── docs/
    ├── architecture.md
    └── enhancementv1.md
```

### The key dependency rule

`handlers/` and `middleware/` import `storage/port.go` (interfaces) **only**. They never import `storage/sqlite/`, `gorm`, or any concrete driver. This is enforced by the Go build system — adding a direct GORM import to a handler is a compile error.

---

## Adding a new API endpoint

1. **Add a repository method** (if the handler needs data): extend the relevant interface in `storage/port.go`, implement it in `storage/sqlite/<entity>.go`.
2. **Write the handler** in `handlers/<entity>_handler.go`. Accept the repository interface as a constructor argument — never `*gorm.DB`.
3. **Register the route** in `router/router.go` with the appropriate middleware chain.
4. **Test** with `curl` or the web dashboard.

### Example — adding `GET /api/v1/notification/:id/raw`

```go
// storage/port.go — add to NotificationRepository interface
GetRaw(ctx context.Context, id uint, userID uint) (*models.Notification, error)

// storage/sqlite/notification.go — implement it
func (r *NotificationRepo) GetRaw(ctx context.Context, id, userID uint) (*models.Notification, error) {
    var n models.Notification
    err := r.db.WithContext(ctx).Unscoped().
        Joins("JOIN apps ON apps.id = notifications.app_id").
        Where("notifications.id = ? AND apps.user_id = ?", id, userID).
        First(&n).Error
    return &n, err
}

// handlers/notification_handler.go — add handler
func GetRawNotification(repo storage.NotificationRepository) gin.HandlerFunc {
    return func(c *gin.Context) {
        // ...
    }
}

// router/router.go — register
api.GET("/notification/:id/raw", handlers.GetRawNotification(notifs))
```

---

## Testing

No automated tests exist yet. When adding them:

```bash
go test ./...                        # run all tests
go test ./handlers/... -v            # verbose handler tests
go test ./storage/sqlite/... -run DB # storage tests
```

**Conventions:**
- Handler tests: use `net/http/httptest` with a real in-memory SQLite (`:memory:`).
- Repository tests: open `gorm.Open(sqlite.Open(":memory:"))`, run `AutoMigrate`, exercise the repo.
- No mocking of the database — the SQLite in-memory driver is fast and accurate.

---

## Commit style

Follow the existing commit history format:

```
<type>(<scope>): <short description>

<optional body>
```

Types: `feat`, `fix`, `refactor`, `docs`, `chore`, `test`, `perf`

Examples:
```
feat(hub): bounded eviction queue replaces inline goroutines
fix(auth): reject expired tickets with 401 instead of 500
docs(wiki): add deployment page
```

---

## Pull request workflow

1. Fork and create a branch: `git checkout -b feat/your-feature`
2. Make changes — keep the PR focused on one thing.
3. Verify `make build` succeeds.
4. Open a PR against `main` with a description of what and why.

For significant changes (new packages, API changes, schema changes), open an issue first to align on the approach.

---

## Further reading

- [Architecture document](https://github.com/deannos/notification-queue/blob/main/docs/architecture.md) — deep dive into every layer
- [Enhancement plan](https://github.com/deannos/notification-queue/blob/main/docs/enhancementv1.md) — known issues and planned fixes
- [Roadmap](Roadmap) — phased plan to v2
