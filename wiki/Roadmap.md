# Roadmap

NotifyQ is currently a single-binary SQLite application. This roadmap tracks the phased evolution to a distributed, horizontally scalable notification platform. Each phase is independent and builds on the previous one.

For the detailed technical design behind each phase, see [docs/architecture.md](https://github.com/deannos/notification-queue/blob/main/docs/architecture.md).

---

## Current state (v1)

- Single Go binary, zero external dependencies
- SQLite with WAL mode
- WebSocket hub in-process
- Per-IP in-memory rate limiting
- Repository / port-adapter pattern in place
- Webhook delivery via raw goroutines (unbounded)

---

## Phase 1 — Service layer and dependency injection

**Goal:** Extract business logic out of HTTP handlers into typed service structs. Handlers become pure transport adapters.

```
service/
  notification.go   ← NotificationService{repo, publisher, apps}
  app.go            ← AppService{repo}
  user.go           ← UserService{repo}
  auth.go           ← AuthService{users, cfg}
```

**Benefits:**
- Business logic is unit-testable without HTTP or a database
- Logger injected as a constructor argument (removes the global singleton)
- Clear boundary for adding new features

**Status:** Planned

---

## Phase 2 — Concurrency and reliability

**Goal:** Eliminate unbounded goroutine creation under load.

### Bounded hub eviction

Replace `go func() { h.unregister <- c }()` (spawns one goroutine per slow client per broadcast) with a single eviction worker draining a bounded channel.

### Bounded webhook worker pool

Replace `go fireWebhook(...)` (one goroutine per notification) with a configurable worker pool:

```
WEBHOOK_WORKERS=4
WEBHOOK_QUEUE_DEPTH=256
WEBHOOK_TIMEOUT=10s
```

**Status:** Planned

---

## Phase 3 — Auth hardening

**Goal:** Define auth interfaces so any auth backend can be swapped without touching handlers.

```go
// auth/port.go
type TokenIssuer  interface { Issue(userID uint, isAdmin bool) (string, error) }
type TokenVerifier interface { Verify(token string) (*Claims, error) }
```

**Planned additions:**
- JWT refresh tokens (short-lived access + long-lived refresh pair)
- Token blacklist via Redis (logout / revocation)
- OIDC / OAuth2 verifier adapter
- API key scopes (read-only, write-only per app)
- Webhook HMAC-SHA256 signatures on outbound calls

**Status:** Planned

---

## Phase 4 — Postgres

**Goal:** Production-grade relational database with connection pooling and proper migrations.

- New `storage/postgres/` package implementing all repo interfaces
- Driver selection via `DATABASE_DRIVER=postgres` env var — no handler changes required
- Replace `AutoMigrate` with `golang-migrate` or Atlas for schema migrations
- Connection pool configuration: `DATABASE_MAX_OPEN_CONNS`, `DATABASE_MAX_IDLE_CONNS`

**Status:** Planned

---

## Phase 5 — Redis

**Goal:** Shared state across multiple server replicas.

**Part A — Distributed rate limiting:** replace in-process per-IP limiter with a Redis-backed counter so limits work correctly behind a load balancer.

**Part B — Notification cache:** read-through / write-through cache wrapping `NotificationRepository`, with key-level invalidation on write operations.

New config: `REDIS_ADDR`, `REDIS_PASSWORD`, `REDIS_DB`, `REDIS_CACHE_TTL`

**Status:** Planned

---

## Phase 6 — Kafka

**Goal:** Durable, replayable, multi-consumer event stream for notifications.

```
POST /message
  → NotificationService.Send()
  → storage/postgres: persist
  → kafka/publisher: Publish()          ← async, durable
        │
        ├─ Consumer group A → Hub → WebSocket clients
        └─ Consumer group B → WebhookDispatcher
```

**Benefits:**
- Notifications survive server restarts (Kafka retains messages)
- Multiple independent consumer types (WebSocket, webhook, mobile push, email)
- Natural back-pressure and replay

New config: `KAFKA_BROKERS`, `KAFKA_TOPIC`, `KAFKA_GROUP_ID_WS`, `KAFKA_GROUP_ID_WEBHOOK`

**Status:** Planned

---

## Phase 7 — Observability

**Goal:** Production-grade metrics, tracing, and error tracking.

| Tool | Purpose |
| ---- | ------- |
| Prometheus | Request latency, notification throughput, WS connection count |
| OpenTelemetry | Distributed tracing across send → persist → deliver |
| Grafana | Dashboards for latency, error rate, queue depth |
| Sentry / Rollbar | Error capture and alerting |

Structured log fields already in place: `request_id`, `method`, `path`, `status`, `latency`, `client_ip`.

**Status:** Planned

---

## Phase 8 — Multi-tenancy and enterprise

**Goal:** Support multiple isolated organisations in a single deployment.

- `tenant_id` column on all models; all queries scoped by tenant
- Tenant-scoped rate limiting and notification quotas
- SSO / SAML adapter satisfying `TokenVerifier`
- Audit log (immutable append-only table for all admin actions)
- Notification categories and channels (per-app channel types; per-user subscriptions)
- Mobile push via APNs / FCM adapter implementing `NotificationPublisher`
- Notification templates stored per application

**Status:** Future

---

## Target architecture (v2)

```
                    ┌──────────────────────────────────────┐
                    │         NotifyQ Instances (N)         │
                    │                                      │
                    │  Gin handlers → Service layer        │
                    │              → storage/port.go       │
                    └────────┬──────────┬──────────┬───────┘
                             │          │           │
                    ┌────────▼──┐  ┌────▼──────┐  ┌▼──────────────┐
                    │  Postgres  │  │   Redis   │  │     Kafka      │
                    │ (primary + │  │ (cache +  │  │ (notification  │
                    │  replicas) │  │  limits)  │  │  event stream) │
                    └────────────┘  └───────────┘  └───────┬────────┘
                                                           │
                                         ┌─────────────────┴──────────────┐
                                         │         Kafka consumers          │
                                         ├─ WS fan-out                      │
                                         ├─ Webhook dispatcher              │
                                         └─ Mobile push (APNs / FCM)        │
                                         └────────────────────────────────┘
```

---

## Contributing to the roadmap

Have a use case that isn't covered? Open an issue on [GitHub](https://github.com/deannos/notification-queue/issues) with the label `roadmap` and describe the problem you are trying to solve.
