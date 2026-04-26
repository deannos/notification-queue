# Configuration

NotifyQ is configured entirely via environment variables. No config file is required — copy `.env.example` to `.env` for local development.

---

## All variables

### Server

| Variable | Default | Required in production | Description |
| -------- | ------- | ---------------------- | ----------- |
| `ENV` | `development` | Recommended | `development` enables colored console logs. `production` switches to JSON logs and activates startup validation. |
| `LISTEN_ADDR` | `:8080` | No | TCP address the HTTP server binds to. Use `0.0.0.0:8080` to bind all interfaces explicitly. |
| `ALLOWED_ORIGINS` | `*` | Yes | Comma-separated list of allowed CORS origins. Set to your frontend URL in production (e.g. `https://notify.example.com`). `*` allows all origins. |

### Database

| Variable | Default | Required in production | Description |
| -------- | ------- | ---------------------- | ----------- |
| `DATABASE_PATH` | `notifications.db` | No | Path to the SQLite file. Use an absolute path or a Docker volume mount (e.g. `/data/notifications.db`). |
| `RETENTION_DAYS` | `30` | No | Notifications older than this many days are deleted by a background worker. Set to `0` to disable retention. |

### Authentication

| Variable | Default | Required in production | Description |
| -------- | ------- | ---------------------- | ----------- |
| `JWT_SECRET` | `change-me-in-production-please` | **Yes** | HMAC-SHA256 key used to sign and verify JWT tokens. Must be set to a unique random value in production — the server refuses to start in `production` mode if this is the default. |
| `JWT_EXPIRY_HOURS` | `24` | No | How long a JWT remains valid, in hours. |

### Admin and registration

| Variable | Default | Required in production | Description |
| -------- | ------- | ---------------------- | ----------- |
| `DEFAULT_ADMIN_USER` | `admin` | No | Username of the admin account created on first run (only if no users exist). |
| `DEFAULT_ADMIN_PASS` | `admin` | **Yes** | Password of the auto-created admin. Change this before first startup in production. |
| `ALLOW_REGISTRATION` | `true` | No | Set to `false` to disable the `POST /auth/register` endpoint and prevent self-sign-up. |

---

## Example `.env` files

### Development

```dotenv
ENV=development
LISTEN_ADDR=:8080
DATABASE_PATH=notifications.db
JWT_SECRET=dev-only-secret
JWT_EXPIRY_HOURS=720
DEFAULT_ADMIN_USER=admin
DEFAULT_ADMIN_PASS=admin
ALLOW_REGISTRATION=true
RETENTION_DAYS=0
ALLOWED_ORIGINS=*
```

### Production (single host)

```dotenv
ENV=production
LISTEN_ADDR=:8080
DATABASE_PATH=/data/notifications.db
JWT_SECRET=<output of: openssl rand -hex 32>
JWT_EXPIRY_HOURS=24
DEFAULT_ADMIN_USER=admin
DEFAULT_ADMIN_PASS=<strong random password>
ALLOW_REGISTRATION=false
RETENTION_DAYS=30
ALLOWED_ORIGINS=https://notify.example.com
```

---

## Generating a secure JWT secret

```bash
# Linux / macOS
openssl rand -hex 32

# Go
go run -e 'package main; import ("crypto/rand"; "encoding/hex"; "fmt"); func main() { b := make([]byte,32); rand.Read(b); fmt.Println(hex.EncodeToString(b)) }'
```

---

## Startup validation

When `ENV=production`, `config.Validate()` is called before the server starts. It will exit with a non-zero status if:

- `JWT_SECRET` equals the default placeholder value.
- `LISTEN_ADDR` is empty.

This prevents accidentally launching a production instance with insecure defaults.

---

## Next steps

- [Deployment](Deployment) — production hardening, TLS, reverse proxy
- [API Reference](API-Reference) — using the configured server
