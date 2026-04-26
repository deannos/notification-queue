# API Reference

Base URL: `http://localhost:8080` (or your configured `LISTEN_ADDR`)

---

## Authentication schemes

| Scheme | Used by | How to send |
| ------ | ------- | ----------- |
| **JWT Bearer** | All `/api/v1/*` endpoints and `/auth/register` | `Authorization: Bearer <token>` |
| **App token** | `POST /message` | `X-App-Token: <token>` header or `?token=<token>` query param |
| **WS ticket** | `GET /ws` | `?ticket=<ticket>` query param (preferred) |
| None | `/auth/login`, `/auth/register`, `/health` | — |

---

## Error format

All error responses share the same JSON shape:

```json
{ "error": "human-readable message" }
```

Common HTTP status codes:

| Code | Meaning |
| ---- | ------- |
| `400` | Bad request — malformed JSON or invalid field |
| `401` | Unauthorized — missing or invalid credentials |
| `403` | Forbidden — valid JWT but insufficient permissions |
| `404` | Not found |
| `409` | Conflict — e.g. username already exists |
| `429` | Rate limit exceeded |
| `500` | Internal server error |

---

## Public endpoints

### `GET /health`

Liveness check. Pings the database.

**Response `200`:**
```json
{ "status": "ok" }
```

---

### `POST /auth/login`

Exchange credentials for a JWT.

**Request:**
```json
{ "username": "admin", "password": "admin" }
```

**Response `200`:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": 86400
}
```

**Errors:** `400` invalid body · `401` wrong credentials

---

### `POST /auth/register`

Register a new user. Disabled when `ALLOW_REGISTRATION=false`.

**Request:**
```json
{ "username": "alice", "password": "s3cur3pass" }
```

**Response `201`:**
```json
{ "id": "1", "username": "alice", "is_admin": false }
```

**Errors:** `400` invalid body · `409` username taken · `403` registration disabled

---

## Notifications

All endpoints require `Authorization: Bearer <jwt>`.

### `GET /api/v1/notification`

List notifications for the authenticated user.

**Query parameters:**

| Parameter | Type | Default | Description |
| --------- | ---- | ------- | ----------- |
| `limit` | integer 1–100 | `20` | Page size |
| `offset` | integer | `0` | Page offset |
| `app_id` | string | — | Filter by application ID |
| `read` | `true` / `false` | — | Filter by read status |
| `priority` | integer 0–10 | — | Filter by exact priority |
| `q` | string | — | Full-text LIKE search on title and message |

**Response `200`:**
```json
{
  "notifications": [
    {
      "id": "42",
      "title": "Deploy successful",
      "message": "v1.2.3 is live on production",
      "priority": 7,
      "read": false,
      "created_at": "2026-03-31T17:00:00Z",
      "app": { "id": "3", "name": "CI Pipeline" }
    }
  ],
  "total": 142,
  "limit": 20,
  "offset": 0
}
```

---

### `GET /api/v1/notification/:id`

Get a single notification by ID.

**Response `200`:** same object shape as the array element above.

**Errors:** `404` not found · `403` belongs to another user

---

### `PUT /api/v1/notification/:id/read`

Mark a notification as read.

**Response `200`:**
```json
{ "message": "notification marked as read" }
```

---

### `DELETE /api/v1/notification/:id`

Soft-delete a single notification.

**Response `200`:**
```json
{ "message": "notification deleted" }
```

---

### `DELETE /api/v1/notification`

Soft-delete all notifications belonging to the authenticated user.

**Response `200`:**
```json
{ "message": "all notifications deleted" }
```

---

## Applications

All endpoints require `Authorization: Bearer <jwt>`.

### `GET /api/v1/application`

List applications owned by the authenticated user.

**Response `200`:**
```json
{
  "applications": [
    {
      "id": "3",
      "name": "CI Pipeline",
      "description": "GitHub Actions notifications",
      "webhook_url": "https://hooks.example.com/notify",
      "created_at": "2026-03-01T10:00:00Z"
    }
  ]
}
```

---

### `POST /api/v1/application`

Create a new application. The plaintext app token is returned **once** — store it securely.

**Request:**
```json
{
  "name": "CI Pipeline",
  "description": "GitHub Actions notifications",
  "webhook_url": "https://hooks.example.com/notify"
}
```

**Response `201`:**
```json
{
  "id": "3",
  "name": "CI Pipeline",
  "token": "a3f8c2...64 hex chars...e9b1d0"
}
```

**Errors:** `400` invalid body

---

### `PUT /api/v1/application/:id`

Update the name, description, or webhook URL of an application.

**Request** (all fields optional):
```json
{
  "name": "CI Pipeline v2",
  "description": "Updated description",
  "webhook_url": "https://hooks.example.com/v2"
}
```

**Response `200`:** updated application object (without token)

---

### `DELETE /api/v1/application/:id`

Delete an application and all its notifications.

**Response `200`:**
```json
{ "message": "application deleted" }
```

---

### `POST /api/v1/application/:id/token`

Rotate the app token. The old token is immediately invalidated.

**Response `200`:**
```json
{ "token": "new-64-char-hex-token" }
```

---

## Sending notifications

### `POST /message`

Send a notification. Authenticated via app token.

**Headers:**
```
X-App-Token: <your-app-token>
Content-Type: application/json
```

**Request:**
```json
{
  "title": "Deploy successful",
  "message": "v1.2.3 is live on production",
  "priority": 7
}
```

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `title` | string | Yes | Notification title |
| `message` | string | Yes | Notification body |
| `priority` | integer 1–10 | No | Default `5` |

**Response `200`:**
```json
{
  "id": "42",
  "title": "Deploy successful",
  "message": "v1.2.3 is live on production",
  "priority": 7,
  "read": false,
  "created_at": "2026-03-31T17:00:00Z"
}
```

**Errors:** `401` invalid or missing app token · `400` invalid body · `429` rate limit

**curl example:**
```bash
curl -s -X POST http://localhost:8080/message \
  -H "X-App-Token: your-app-token" \
  -H "Content-Type: application/json" \
  -d '{"title":"Hello","message":"World","priority":5}' | jq
```

---

## WebSocket stream

### `GET /api/v1/ws/ticket`

Issue a short-lived WebSocket authentication ticket (requires valid JWT).

**Response `200`:**
```json
{ "ticket": "32-byte-hex-string" }
```

Tickets expire after **30 seconds**. Consume immediately.

---

### `GET /ws`

Open a WebSocket connection. Accepts either a ticket (recommended) or a JWT directly.

```
GET /ws?ticket=<ticket>    ← preferred: no long-lived token in URL
GET /ws?token=<jwt>        ← fallback
```

**Incoming message format:**

```json
{
  "event": "notification",
  "notification": {
    "id": "42",
    "title": "Deploy successful",
    "message": "v1.2.3 is live on production",
    "priority": 7,
    "read": false,
    "created_at": "2026-03-31T17:00:00Z",
    "app": { "id": "3", "name": "CI Pipeline" }
  }
}
```

**JavaScript example:**
```js
async function connect(jwtToken) {
  const { ticket } = await fetch('/api/v1/ws/ticket', {
    headers: { Authorization: `Bearer ${jwtToken}` },
  }).then(r => r.json());

  const ws = new WebSocket(`ws://localhost:8080/ws?ticket=${ticket}`);

  ws.onopen = () => console.log('connected');
  ws.onmessage = (e) => {
    const { event, notification } = JSON.parse(e.data);
    if (event === 'notification') {
      console.log(`[${notification.priority}] ${notification.title}`);
    }
  };
  ws.onclose = () => console.log('disconnected');
}
```

**Connection limits:** 54 s ping / 60 s pong timeout. The server closes the connection if a pong is not received within 60 seconds.

---

## Users (admin only)

All endpoints require `Authorization: Bearer <jwt>` with `is_admin: true`.

### `GET /api/v1/user`

List all users.

**Response `200`:**
```json
{
  "users": [
    { "id": "1", "username": "admin", "is_admin": true, "created_at": "..." },
    { "id": "2", "username": "alice", "is_admin": false, "created_at": "..." }
  ]
}
```

---

### `POST /api/v1/user`

Create a user.

**Request:**
```json
{ "username": "bob", "password": "s3cur3", "is_admin": false }
```

**Response `201`:** user object (no password field)

---

### `DELETE /api/v1/user/:id`

Delete a user and cascade-delete all their applications and notifications.

**Response `200`:**
```json
{ "message": "user deleted" }
```

---

### `PUT /api/v1/user/:id/password`

Reset a user's password.

**Request:**
```json
{ "password": "newpassword" }
```

**Response `200`:**
```json
{ "message": "password updated" }
```
