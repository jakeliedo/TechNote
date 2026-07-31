# TechNote — Project Brief

## Purpose
Internal real-time report logging app for Club V e-Gaming technical team (~10 users).
Staff submit instant notes ("fixing machine #30 — card reader not accepting cards") → push immediately to all team members.
**No status tracking. No task completion. This is an event log, not a task manager.**

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI + PostgreSQL + WebSocket |
| Push | Firebase Cloud Messaging (FCM) |
| Frontend | PWA (vanilla HTML/JS/CSS) — single codebase for mobile + desktop |
| Server exposure | Cloudflare Tunnel (office PC, no static IP) |
| Offline queue | LocalStorage → auto-sync on reconnect |

No Flutter. No Electron. No Tauri. No AI extraction. No App Store or Play Store.

---

## Distribution

- **Android**: share APK directly via Zalo/Telegram, install manually
- **iOS**: install PWA via Safari → Share → "Add to Home Screen"
- No Apple Developer Account needed (no badge count required)

---

## Business Logic

### Sending a report
- App opens directly to text input screen (no splash, no menu)
- User types note → taps SEND → immediate response
- App generates `client_uuid` before sending → server uses it to deduplicate retries

### Receiving notifications
- FCM push notification — works even when app is fully closed
- iOS PWA: push requires iOS 16.4+, Safari only
- **No badge count on icon** — replaced by "away log" screen

### "Away 2h" logic
```
On app open:
  - Compare current time with last_opened (stored in LocalStorage)
  - If > 2 hours → show "You were away X hours — N new reports"
                    + full list of unread reports in chronological order
  - If ≤ 2 hours  → go directly to input screen
  - Update last_opened = now()
```

### Read tracking
Uses `report_reads` table. Never modifies original report.
Unread count = COUNT of reports with no matching row in report_reads for that user.

---

## Database Schema

```sql
users (
  id            SERIAL PRIMARY KEY,
  display_name  TEXT NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  phone         TEXT,
  is_active     BOOLEAN DEFAULT true
)

devices (
  id          SERIAL PRIMARY KEY,
  user_id     INT REFERENCES users(id),
  platform    TEXT,           -- 'android' | 'ios' | 'web'
  fcm_token   TEXT,
  last_seen   TIMESTAMPTZ
)

reports (
  id          SERIAL PRIMARY KEY,
  user_id     INT REFERENCES users(id),
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  client_uuid UUID UNIQUE   -- deduplication on retry
)

report_reads (
  report_id   INT REFERENCES reports(id),
  user_id     INT REFERENCES users(id),
  read_at     TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (report_id, user_id)
)
```

**Data rules**: append-only log — no UPDATE or DELETE on reports.
Timezone: store UTC, display in Asia/Ho_Chi_Minh.

---

## API Endpoints

```
POST /auth/login          email + password → JWT token
GET  /users/me            current user profile
POST /devices/register    register FCM token

POST /reports             create report (triggers FCM push to all other users)
GET  /reports             history — supports ?from=&to=&limit=&offset=
GET  /reports/unread      unread reports for current user
POST /reports/{id}/read   mark as read

WS   /ws                  WebSocket — real-time push to desktop clients
```

---

## PWA Screens

1. **Login** — email + password, store JWT in LocalStorage
2. **Home** — full-screen text input + SEND button, primary screen
3. **Away log** — shown when reopening after 2h, lists unread reports
4. **History** — chronological feed, filterable by day / month / quarter / year
5. **Settings** — change password, logout only

Minimal UI. Speed of input is the top priority. No "who is doing what" screen.

---

## Project Structure

```
technote/
├── CLAUDE.md               ← this file
├── server/
│   ├── main.py
│   ├── database.py
│   ├── models.py
│   ├── auth.py
│   ├── fcm.py
│   └── routes/
│       ├── reports.py
│       ├── users.py
│       └── devices.py
├── frontend/
│   ├── index.html
│   ├── app.js
│   ├── sw.js              ← Service Worker (offline + PWA install)
│   ├── manifest.json
│   └── styles.css
├── docker-compose.yml
├── requirements.txt
└── .env.example
```

---

## Environment Variables

```env
DATABASE_URL=postgresql://user:pass@localhost/technote
JWT_SECRET=
FCM_SERVER_KEY=
CLOUDFLARE_TUNNEL_TOKEN=
```

---

## Build Status

- [x] Project scaffold (folders + empty files)
- [x] Database layer (database.py + models.py)
- [x] Auth (auth.py — JWT HS256, bcrypt, get_current_user dependency)
- [x] API routes — users (login, me), devices (register), reports (CRUD + unread + read)
- [x] FCM push (fcm.py — HTTP v1, Service Account, async broadcast)
- [x] main.py + WebSocket (FastAPI app entry, routers, /ws JWT auth, CORS, lifespan startup)
- [x] Frontend PWA (login, home, feed, activity, history, settings, away-log, offline queue, WebSocket)
- [x] Integration testing — 45/45 pytest tests pass (auth, devices, reports, users)
- [ ] FCM configuration (Firebase service account JSON + project ID)
- [ ] Cloudflare Tunnel setup
- [ ] Production smoke test on mobile devices

## Dev Setup

```bash
# Python 3.12 required (asyncpg has no wheel for 3.14 on Windows)
py -3.12 -m venv .venv
.venv/Scripts/pip install -r requirements.txt

# Start DB
docker-compose up -d db

# Seed 10 users (idempotent)
.venv/Scripts/python -m server.seed

# Run server
.venv/Scripts/uvicorn server.main:app --host 0.0.0.0 --port 8000

# Run tests
.venv/Scripts/pytest tests/
```

## Known Fixes Applied

- `bcrypt==4.0.1` pinned — passlib 1.7.4 not compatible with bcrypt 5.x
- `badge_color` uses Python-level `default=` not `server_default=` (prevents DDL quoting bug)
- pytest.ini: `asyncio_default_fixture_loop_scope=session` + `asyncio_default_test_loop_scope=session` required for pytest-asyncio 1.4+ with asyncpg