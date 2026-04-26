# Installation

This page covers every supported way to run NotifyQ.

---

## Prerequisites

### Local build

| Requirement | Version | Notes |
| ----------- | ------- | ----- |
| Go | 1.25+ | |
| C toolchain | any | `gcc` on Linux/Windows, `clang` on macOS (Xcode CLI tools) |
| `git` | any | |

CGO must be enabled because the SQLite driver (`mattn/go-sqlite3`) compiles a C library.

**macOS:**
```bash
xcode-select --install
```

**Ubuntu / Debian:**
```bash
sudo apt-get install -y build-essential
```

**Alpine Linux:**
```bash
apk add --no-cache gcc musl-dev
```

### Docker

- Docker Engine 20.10+ (no local Go toolchain needed)

---

## Option 1 — Build from source

```bash
# Clone
git clone https://github.com/deannos/notification-queue.git
cd notification-queue

# Configure
cp .env.example .env
# Edit .env — at minimum set JWT_SECRET

# Run (builds UI + starts server)
make run
```

The server listens on `http://localhost:8080` by default.

To compile a standalone binary:

```bash
make build        # outputs ./notifyq
./notifyq
```

> `make build` requires the Vite toolchain to build the embedded UI. If you only want the Go binary without rebuilding the UI, run:
> ```bash
> CGO_ENABLED=1 go build -o notifyq .
> ```

---

## Option 2 — Docker

```bash
# Build the image
docker build -t notifyq .

# Run
docker run -d \
  --name notifyq \
  -p 8080:8080 \
  -v notifyq-data:/data \
  -e JWT_SECRET=your-random-secret \
  -e DEFAULT_ADMIN_PASS=changeme \
  -e ENV=production \
  notifyq
```

The SQLite database is written to `/data/notifications.db` inside the container. The named volume `notifyq-data` persists it across container restarts.

---

## Option 3 — Docker Compose

Create a `docker-compose.yml`:

```yaml
services:
  notifyq:
    image: notifyq          # or build: . to build locally
    restart: unless-stopped
    ports:
      - "8080:8080"
    volumes:
      - notifyq-data:/data
    environment:
      ENV: production
      JWT_SECRET: ${JWT_SECRET}
      DEFAULT_ADMIN_USER: admin
      DEFAULT_ADMIN_PASS: ${ADMIN_PASS}
      ALLOW_REGISTRATION: "false"
      RETENTION_DAYS: "30"

volumes:
  notifyq-data:
```

```bash
# Create a .env file with secrets
echo "JWT_SECRET=$(openssl rand -hex 32)" >> .env
echo "ADMIN_PASS=strongpassword" >> .env

docker compose up -d
```

---

## First run

On startup NotifyQ will:

1. Open (or create) the SQLite database at `DATABASE_PATH`.
2. Run schema migrations automatically.
3. Create the admin user defined by `DEFAULT_ADMIN_USER` / `DEFAULT_ADMIN_PASS` if no users exist.

Open `http://localhost:8080` and log in:

| Username | Password |
| -------- | -------- |
| `admin`  | *(value of `DEFAULT_ADMIN_PASS`)* |

**Change the admin password immediately in any internet-facing deployment.**

---

## Verifying the installation

```bash
curl http://localhost:8080/health
# {"status":"ok"}
```

---

## Next steps

- [Configuration](Configuration) — tune every environment variable
- [Deployment](Deployment) — production hardening and reverse proxy setup
