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
| Server exposure | ngrok free static domain (office PC, no static IP) |
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

### Badge color — auto-assign
- 20 colors available: 10 solid hex + 10 CSS linear-gradient values
- On login (`showApp`), `GET /users` → find first color not used by any other active user → `PUT /users/me` to assign it
- Color picker in Settings only shows colors not taken by others (taken = dimmed + ✕, not selectable)

### Display name — fixed prefix + editable suffix
- Each user has a `username` column (seeded = original display_name, immutable via API)
- `display_name` can be updated to either exactly `username` or `"username | <suffix>"`
- Login accepts both `username` and `display_name` (OR query)
- Settings UI: fixed prefix label + separate suffix input field

### Single-device user lock
- On login success, `device_owner` is stored in `localStorage`
- Login blocked if `device_owner` exists and doesn't match the nickname being entered
- Cleared on logout

---

## Database Schema

```sql
users (
  id            SERIAL PRIMARY KEY,
  display_name  TEXT NOT NULL UNIQUE,  -- editable: "username" or "username | suffix"
  username      TEXT UNIQUE,           -- fixed login name (seeded from display_name)
  email         TEXT UNIQUE NOT NULL,
  phone         TEXT,
  password_hash TEXT NOT NULL,
  is_active     BOOLEAN DEFAULT true,
  badge_color   TEXT NOT NULL,         -- hex "#RRGGBB" or "linear-gradient(...)"
  token_version INT DEFAULT 1          -- incremented on each login to invalidate old JWT
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
  client_uuid UUID UNIQUE,  -- deduplication on retry
  image_path  TEXT          -- filename in media/ dir, nullable
)

report_reads (
  report_id   INT REFERENCES reports(id),
  user_id     INT REFERENCES users(id),
  read_at     TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (report_id, user_id)
)

report_checks (
  report_id   INT REFERENCES reports(id),
  user_id     INT REFERENCES users(id),
  checked_at  TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (report_id, user_id)
  -- "seen" indicator; users cannot check their own report
)

report_reactions (
  report_id   INT REFERENCES reports(id),
  user_id     INT REFERENCES users(id),
  reaction    TEXT NOT NULL,  -- 'smile' | 'surprise' | 'question'
  PRIMARY KEY (report_id, user_id)  -- one reaction per user per report
)
```

**Data rules**: append-only log — no UPDATE or DELETE on reports.
Timezone: store UTC, display in Asia/Ho_Chi_Minh.
Image files stored on disk in `media/`, served via FastAPI StaticFiles at `/media/`.

---

## API Endpoints

```
POST /auth/login          nickname (username or display_name) + password → JWT
GET  /users/me            current user profile
PUT  /users/me            update display_name (suffix only) + badge_color
GET  /users               list all active users (id, display_name, username, badge_color)
POST /devices/register    register FCM token

POST /reports             create report — multipart/form-data: body + client_uuid + image (optional)
GET  /reports             history — supports ?from=&to=&limit=&offset=&mine=
GET  /reports/unread      unread reports for current user (sorted newest first)
POST /reports/{id}/read   mark as read
POST /reports/{id}/check  toggle "seen" check (cannot check own report); broadcasts WS "check" event
POST /reports/{id}/react  toggle emoji reaction (smile/surprise/question); broadcasts WS "reaction" event

WS   /ws?token=<jwt>      WebSocket — real-time push to connected clients
                           message types: report (new note), check (seen update), reaction (emoji update)
```

---

## PWA Screens

1. **Login** — nickname + password, store JWT in LocalStorage; blocks second user on same device
2. **Home** — full-screen text input + SEND button + camera button (attach 1 image per note)
3. **Feed** — unread notes, newest first; tap card or image → auto-mark seen; emoji reactions (long-press)
4. **Activity** — own notes from last 48h; seen count (✓ N, always visible even at 0)
5. **Away log** — shown when reopening after 2h, lists unread reports
6. **History** — all notes from last 5 days, grouped by date ("August 8th 2026" format, English ordinal)
7. **Settings** — edit display name suffix, pick badge color (free colors only), logout

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
├── media/                 ← uploaded images (auto-created, excluded from git)
├── deploy/
│   ├── package.ps1        ← builds technote-deploy.zip (excludes .env, secrets, .venv)
│   ├── install.bat        ← first-time server setup (NSSM services)
│   └── update.bat         ← update running server from ZIP
├── docker-compose.yml
├── requirements.txt
└── .env.example
```

---

## Environment Variables

```env
DATABASE_URL=postgresql+asyncpg://user:pass@localhost/technote
JWT_SECRET=<long_random_secret>
GOOGLE_APPLICATION_CREDENTIALS=server/firebase-service-account.json
FCM_PROJECT_ID=<firebase_project_id>
PUBLIC_URL=https://<your-ngrok-domain>.ngrok-free.app
VAPID_PUBLIC_KEY=<vapid_key_from_firebase_console>
```

---

## Build Status

- [x] Project scaffold (folders + empty files)
- [x] Database layer (database.py + models.py)
- [x] Auth (auth.py — JWT HS256, bcrypt, get_current_user dependency)
- [x] API routes — users (login, me, list), devices (register), reports (CRUD + unread + read)
- [x] FCM push (fcm.py — HTTP v1, Service Account, async broadcast as BackgroundTask)
- [x] main.py + WebSocket (FastAPI app entry, routers, /ws JWT auth, CORS, lifespan startup)
- [x] Frontend PWA (login, home, feed, activity, history, settings, away-log, offline queue, WebSocket)
- [x] Integration testing — 45/45 pytest tests pass (auth, devices, reports, users)
- [x] FCM configured (Firebase project `technote-clubv`, service account JSON, VAPID key)
- [x] ngrok static domain (`snugly-gory-goofiness.ngrok-free.dev`) — replaces Cloudflare Tunnel
- [x] Production smoke tested — push notifications working on iPhone + desktop Chrome
- [x] Single-device user lock (device_owner in localStorage)
- [x] Single-session login (token_version incremented on login)
- [x] DB idle connection fix (pool_pre_ping + pool_recycle)
- [x] Auto-assign unique badge color on login (20 colors: 10 solid + 10 gradient)
- [x] Square badge dots + square color swatches
- [x] English ordinal date format ("August 8th 2026") in History
- [x] Display name = fixed username + optional " | suffix" (enforced server + client)
- [x] `username` column added via runtime migration (ALTER TABLE ... ADD COLUMN IF NOT EXISTS)
- [x] Emoji reactions (smile 😊 / surprise 😮 / question 🤔) — long-press picker, compact badge display
- [x] "Seen" check feature — tap note to auto-seen; ✓ count shown to sender; cannot check own note
- [x] Image upload — 1 image per note; client-side Canvas resize to ≤2MB JPEG; stored in `media/`; thumbnail + lightbox; IntersectionObserver lazy load; iOS-safe auto-seen on image tap
- [x] Timestamp format: "28 Th5 2026 09:05" (Vietnamese month abbreviation, custom MONTH_SHORT array)
- [x] Feed sorted newest-first (GET /reports/unread → ORDER BY created_at DESC)
- [x] Seen indicator always visible on own notes (✓ 0 grey → ✓ N green)
- [x] deploy/ scripts: package.ps1 (ZIP builder) + install.bat + update.bat

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
- `crypto.randomUUID()` — must call as method (not destructured); iOS Safari detaches `this` otherwise
- `pool_pre_ping=True, pool_recycle=1800` on `create_async_engine` — prevents idle PostgreSQL connection timeout after hours of inactivity
- FCM + WebSocket broadcasts moved to `BackgroundTask` — prevents POST /reports from blocking on push delivery
- `requests==2.32.3` added to requirements — Google auth library dependency for FCM HTTP v1
- Double notification fix: `onBackgroundMessage` left empty — Firebase SDK auto-shows notification from `notification` field; manual `showNotification` caused duplicates
- `ngrok upgrade` required — version 3.3.1 too old for static domains; use `winget upgrade ngrok.ngrok`
- `python-multipart==0.0.32` required for FastAPI multipart/form-data (image upload); not installed by default
- `/media` StaticFiles mount must come BEFORE frontend `/` catch-all mount in `main.py`
- `bindCardImages` uses `e.stopPropagation()` + explicit `autoSeenNote` call — iOS Safari event bubble from `.card-image` to card is unreliable; cannot depend on bubble for seen tracking
- Feed sort was ASC (oldest first) — fixed to DESC in `GET /reports/unread` query