# TechNote

Real-time internal report logging PWA for technical teams. Staff submit instant notes that are immediately pushed to all team members via WebSocket and Firebase Cloud Messaging.

> Built for Club V e-Gaming technical team (~10 users).

---

## Features

- **Instant reporting** — type a note, tap Send, delivered to everyone in real-time
- **Push notifications** — FCM push when app is closed (iOS 16.4+ PWA, Android, desktop)
- **WebSocket live feed** — real-time updates when app is open
- **Offline queue** — notes saved locally and auto-synced on reconnect
- **Away log** — reopening after 2h shows a summary of missed reports
- **Single-session login** — new login automatically invalidates previous session
- **Single-device lock** — a device stays bound to one user account (prevents sharing)
- **Auto badge color** — each user gets a unique color on login (20 options: solid + gradient); color picker blocks already-taken colors
- **Display name suffix** — fixed login name + optional personal suffix ("Liem | on-duty")
- **PWA installable** — works as native-like app on iOS (Safari → Add to Home Screen) and Android

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI + PostgreSQL + WebSocket |
| Push | Firebase Cloud Messaging (FCM HTTP v1) |
| Frontend | PWA — vanilla HTML/CSS/JS |
| Tunnel | ngrok (free static domain) |
| Auth | JWT HS256 + bcrypt |

---

## Project Structure

```
technote/
├── server/
│   ├── main.py              # FastAPI app, WebSocket endpoint, CORS
│   ├── database.py          # SQLAlchemy async engine
│   ├── models.py            # ORM models
│   ├── auth.py              # JWT + bcrypt helpers
│   ├── fcm.py               # Firebase Cloud Messaging broadcast
│   ├── ws.py                # WebSocket connection manager
│   ├── seed.py              # Seed 10 users (idempotent)
│   └── routes/
│       ├── users.py         # /auth/login, /users/me
│       ├── devices.py       # /devices/register
│       └── reports.py       # /reports CRUD + /reports/unread
├── frontend/
│   ├── index.html
│   ├── app.js               # Single-page app logic
│   ├── sw.js                # Service Worker (offline + FCM background push)
│   ├── manifest.json        # PWA manifest
│   ├── styles.css
│   └── icons/
│       ├── icon-192.png
│       └── icon-512.png
├── tests/                   # pytest — 45 tests
├── docker-compose.yml       # PostgreSQL
├── Dockerfile
├── requirements.txt
└── .env.example
```

---

## API Endpoints

```
POST /auth/login          nickname (username or display_name) + password → JWT
GET  /users/me            current user profile
PUT  /users/me            update display_name suffix + badge_color
GET  /users               list all active users with badge colors
POST /devices/register    register FCM token

POST /reports             create report (FCM + WebSocket broadcast)
GET  /reports             history — ?from=&to=&limit=&offset=&mine=
GET  /reports/unread      unread reports for current user
POST /reports/{id}/read   mark as read

WS   /ws?token=<jwt>      real-time push to connected clients
```

---

## Database Schema

```sql
users        (id, display_name, username, email, phone, password_hash, is_active, badge_color, token_version)
devices      (id, user_id, platform, fcm_token, last_seen)
reports      (id, user_id, body, created_at, client_uuid)
report_reads (report_id, user_id, read_at)
```

- `username` — fixed login name (immutable); `display_name` = `username` or `username | suffix`
- `client_uuid` — deduplication on retry
- `token_version` — single-session enforcement (new login invalidates old JWT)
- `badge_color` — hex or CSS `linear-gradient(...)`, auto-assigned unique per user
- Timezone: stored UTC, displayed in Asia/Ho_Chi_Minh

---

## Setup

### Requirements

- Python 3.12
- Docker (for PostgreSQL)
- ngrok account (free static domain)
- Firebase project (FCM)

### Environment Variables

Copy `.env.example` to `.env` and fill in:

```env
DATABASE_URL=postgresql+asyncpg://technote:technote@localhost/technote
JWT_SECRET=<long_random_secret>
GOOGLE_APPLICATION_CREDENTIALS=server/firebase-service-account.json
FCM_PROJECT_ID=<firebase_project_id>
PUBLIC_URL=https://<your-ngrok-domain>.ngrok-free.app
VAPID_PUBLIC_KEY=<vapid_key_from_firebase>
```

Place Firebase service account JSON at `server/firebase-service-account.json`.

### Run Locally

```bash
# Create virtualenv (Python 3.12 required)
py -3.12 -m venv .venv
.venv\Scripts\pip install -r requirements.txt

# Start PostgreSQL
docker-compose up -d db

# Seed 10 users
.venv\Scripts\python -m server.seed

# Run server
.venv\Scripts\uvicorn server.main:app --host 0.0.0.0 --port 8000

# Run ngrok (separate terminal)
ngrok http --domain=<your-static-domain>.ngrok-free.app 8000
```

### Run Tests

```bash
.venv\Scripts\pytest tests/
```

45 tests covering auth, users, devices, reports.

---

## PWA Installation

**iOS:** Safari → Share → "Add to Home Screen" (requires iOS 16.4+ for push notifications)

**Android:** Chrome → menu → "Add to Home Screen" or "Install app"

---

## Deployment Notes

- Server runs on an office PC exposed via ngrok free static domain
- ngrok must stay running alongside the server
- All data stored in PostgreSQL (Docker volume — persists across restarts)
- Firebase service account JSON is required for push notifications (excluded from git)
