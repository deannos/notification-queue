# NotifyQ Wiki

Welcome to the NotifyQ wiki. NotifyQ is a self-hosted push notification server — send notifications from any service via a simple HTTP API and receive them in real time over WebSockets or the built-in web dashboard.

**Module:** `github.com/deannos/notification-queue`  
**Language:** Go 1.25 · CGO required (SQLite driver)  
**License:** MIT

---

## Navigation

| Page | What you will find |
| ---- | ------------------ |
| [Installation](Installation) | Local build, Docker, Docker Compose — step by step |
| [Configuration](Configuration) | Every environment variable with defaults and examples |
| [API Reference](API-Reference) | All endpoints, request/response schemas, error codes |
| [Deployment](Deployment) | Production hardening, reverse proxy, Kubernetes |
| [Development Guide](Development-Guide) | Local dev setup, architecture, contribution workflow |
| [Roadmap](Roadmap) | Phased plan from SQLite monolith to distributed stack |

---

## At a Glance

```
Any service
    │
    │  POST /message
    │  X-App-Token: <token>
    ▼
┌─────────────────────────────────────────┐
│              NotifyQ server              │
│                                         │
│  REST API ──► Notification store        │
│  (Gin + GORM/SQLite)                    │
│                   │                     │
│                   ▼                     │
│           WebSocket Hub                 │
│         (per-user broadcast)            │
└────────────────────┬────────────────────┘
                     │  real-time push
          ┌──────────┴──────────┐
       Browser              Any WS client
     (web dashboard)
```

### Key concepts

- **Applications** — logical senders. Each app gets a unique 64-char hex token used to authenticate `POST /message` calls.
- **Notifications** — messages with a title, body, and priority (1–10). Stored in SQLite and pushed live over WebSocket.
- **Users** — human accounts that own apps and receive notifications. Admin users can manage all users.
- **JWT tokens** — issued on login; used for all read/manage API calls and WebSocket connections.
- **WS tickets** — short-lived (30 s) opaque tokens that replace JWTs in WebSocket URLs to avoid token leakage in logs.

---

## Quick links

- [Source repository](https://github.com/deannos/notification-queue)
- [Open an issue](https://github.com/deannos/notification-queue/issues)
- [Architecture document](https://github.com/deannos/notification-queue/blob/main/docs/architecture.md)
- [Enhancement plan](https://github.com/deannos/notification-queue/blob/main/docs/enhancementv1.md)
