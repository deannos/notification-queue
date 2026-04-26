# Deployment

This page covers running NotifyQ in production — hardening, reverse proxy configuration, Docker Compose, and Kubernetes.

---

## Production checklist

Before exposing NotifyQ to the internet, complete every item in this checklist.

- [ ] `ENV=production` set
- [ ] `JWT_SECRET` is a random 32+ byte value (`openssl rand -hex 32`)
- [ ] `DEFAULT_ADMIN_PASS` changed from `admin`
- [ ] `ALLOW_REGISTRATION=false` unless open sign-up is intended
- [ ] `ALLOWED_ORIGINS` set to your actual frontend origin (not `*`)
- [ ] TLS terminated at a reverse proxy (Nginx, Caddy, Traefik)
- [ ] SQLite file is on a persistent volume
- [ ] Container restart policy set to `unless-stopped` or `always`
- [ ] Firewall blocks direct access to port `8080` (only reverse proxy port exposed)

---

## Docker Compose (single host)

```yaml
# docker-compose.yml
services:
  notifyq:
    image: notifyq
    build: .
    restart: unless-stopped
    ports:
      - "127.0.0.1:8080:8080"   # bind to loopback only — Nginx terminates TLS
    volumes:
      - notifyq-data:/data
    environment:
      ENV: production
      LISTEN_ADDR: ":8080"
      DATABASE_PATH: /data/notifications.db
      JWT_SECRET: ${JWT_SECRET}
      JWT_EXPIRY_HOURS: "24"
      DEFAULT_ADMIN_USER: admin
      DEFAULT_ADMIN_PASS: ${ADMIN_PASS}
      ALLOW_REGISTRATION: "false"
      RETENTION_DAYS: "30"
      ALLOWED_ORIGINS: ${ALLOWED_ORIGINS}
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:8080/health"]
      interval: 30s
      timeout: 5s
      retries: 3

volumes:
  notifyq-data:
```

```bash
# .env
JWT_SECRET=$(openssl rand -hex 32)
ADMIN_PASS=strongpassword
ALLOWED_ORIGINS=https://notify.example.com
```

```bash
docker compose up -d
docker compose logs -f notifyq
```

---

## Reverse proxy

### Nginx

```nginx
server {
    listen 443 ssl http2;
    server_name notify.example.com;

    ssl_certificate     /etc/ssl/certs/notify.example.com.crt;
    ssl_certificate_key /etc/ssl/private/notify.example.com.key;

    location / {
        proxy_pass         http://127.0.0.1:8080;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }

    # WebSocket upgrade
    location /ws {
        proxy_pass         http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade    $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host       $host;
        proxy_read_timeout 86400s;    # keep WS connections alive
    }
}

server {
    listen 80;
    server_name notify.example.com;
    return 301 https://$host$request_uri;
}
```

### Caddy

```caddy
notify.example.com {
    reverse_proxy localhost:8080

    @websocket {
        header Connection *Upgrade*
        header Upgrade websocket
    }
    reverse_proxy @websocket localhost:8080
}
```

Caddy provisions TLS automatically via Let's Encrypt.

---

## Backup and restore

The entire state of NotifyQ lives in a single SQLite file (`DATABASE_PATH`).

**Backup** (safe while the server is running — WAL mode enables consistent reads):

```bash
sqlite3 /data/notifications.db ".backup /backup/notifications-$(date +%Y%m%d).db"
```

**Restore:**

```bash
docker compose stop notifyq
cp /backup/notifications-20260401.db /data/notifications.db
docker compose start notifyq
```

Automate backups with a cron job or a sidecar container that mounts the same volume.

---

## Kubernetes (Phase 6+)

> Kubernetes deployment becomes practical after the Postgres and Redis phases of the roadmap, which enable horizontal scaling. The configuration below is a starting point.

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: notifyq
spec:
  replicas: 1           # increase to 3+ after Postgres/Redis are wired
  selector:
    matchLabels:
      app: notifyq
  template:
    metadata:
      labels:
        app: notifyq
    spec:
      containers:
        - name: notifyq
          image: ghcr.io/deannos/notification-queue:latest
          ports:
            - containerPort: 8080
          envFrom:
            - secretRef:
                name: notifyq-secrets
            - configMapRef:
                name: notifyq-config
          volumeMounts:
            - name: data
              mountPath: /data
          livenessProbe:
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 30
      volumes:
        - name: data
          persistentVolumeClaim:
            claimName: notifyq-data
---
apiVersion: v1
kind: Service
metadata:
  name: notifyq
spec:
  selector:
    app: notifyq
  ports:
    - port: 80
      targetPort: 8080
```

```yaml
# secrets.yaml  (store with Sealed Secrets or Vault in practice)
apiVersion: v1
kind: Secret
metadata:
  name: notifyq-secrets
stringData:
  JWT_SECRET: "<random value>"
  DEFAULT_ADMIN_PASS: "<strong password>"
```

---

## Logging

In `production` mode, all log lines are newline-delimited JSON compatible with Loki, Datadog, and CloudWatch.

Example log line:

```json
{
  "level": "info",
  "ts": "2026-03-31T17:00:00.123Z",
  "logger": "request",
  "msg": "request",
  "request_id": "01HXYZ...",
  "method": "POST",
  "path": "/message",
  "status": 200,
  "latency": "1.23ms",
  "client_ip": "10.0.0.1"
}
```

Pipe logs to your aggregator:

```bash
docker compose logs -f notifyq | your-log-shipper
```
