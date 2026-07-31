# TechNote — UI Design Brief

> Feed this file to Claude Code alongside CLAUDE.md before writing any frontend code.
> Implement exactly as specified. Do not add features not listed here.

---

## User Accounts

| Nickname | Password | Email |
|---|---|---|
| Liem | Clubv@482  | liem@clubvegaming.com |
| Nghia | Clubv@716 | nghia@clubvegaming.com |
| Dong | Clubv@953 | dong@clubvegaming.com |
| Noah | Clubv@241 | noah@clubvegaming.com |
| Vinh | Clubv@867 | vinh@clubvegaming.com |
| Hau | Clubv@394 | hau@clubvegaming.com |
| Tan | Clubv@528 | tan@clubvegaming.com |
| Linh | Clubv@173 | linh@clubvegaming.com |
| Nghiait | Clubv@649 | nghiait@clubvegaming.com |
| Huy | Clubv@835 | huy@clubvegaming.com |

> Accounts are created once by admin via `python -m server.seed`. No self-registration.

---

## Design System

| Property | Value |
|---|---|
| Theme | Light — white/off-white backgrounds |
| Style | Minimal, clean, rounded corners (border-radius: 12–16px for cards, 8px for inputs) |
| Accent color | Ice blue / pastel blue — suggested `#5BA4CF` or `#7EC8E3` |
| Background | `#F8F9FA` (page), `#FFFFFF` (cards) |
| Text primary | `#1A1A2E` |
| Text secondary | `#6B7280` |
| Border / divider | `#E5E7EB` |
| Shadow | Soft — `box-shadow: 0 1px 4px rgba(0,0,0,0.08)` |
| Font | System font stack: `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif` |
| Font size base | 15px body, 13px meta/timestamp, 17px input |

---

## Screen 0 — Login

First screen shown when no JWT is found in LocalStorage (or token has expired).

```
┌─────────────────────────────────────────┐
│                                         │
│                                         │
│              TechNote                   │  ← app name, centered, bold, 24px
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  Nickname                       │   │  ← text input
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │  Mật khẩu                       │   │  ← password input
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │           ĐĂNG NHẬP             │   │  ← accent color button
│  └─────────────────────────────────┘   │
│                                         │
│                                         │
└─────────────────────────────────────────┘
```

**Specifications:**
- No registration link, no forgot password link
- Error message inline below button: "Nickname hoặc mật khẩu không đúng"
- Button shows spinner while request is in-flight, disabled to prevent double-submit
- On success: store JWT in LocalStorage, route to Home tab
- If JWT already valid in LocalStorage on app open: skip login, go straight to app

---

## Navigation — Bottom Tab Bar

Fixed bottom bar, 4 tabs, always visible:

| Tab | Icon | Label | Screen |
|---|---|---|---|
| 1 | ✏️ or 📝 | **Home** | Text input + SEND |
| 2 | 🔔 | **Feed** | Unread notes for current user |
| 3 | 📋 | **Activity** | Notes sent by current user (last 48h) |
| 4 | 🕐 | **History** | All notes from all users (last 5 days) |

- Active tab: accent color icon + label
- Inactive tab: gray icon + label
- Badge count on Feed tab when there are unread items
- Settings accessible via small gear icon in top-right header (not a tab)

---

## Report Card — Shared Component

Used in Feed, Activity, and History screens.

```
┌─────────────────────────────────────────┐
│ ● Nghĩa                        14:32   │  ← badge dot (user color) + nickname + time
│                                         │
│  Đang sửa máy số 30, lỗi card reader   │  ← note content
│  không nhận thẻ                         │
└─────────────────────────────────────────┘
```

**Specifications:**
- **Badge**: filled circle dot (12px), color chosen by user in Settings
- **Nickname**: short display name set by user, bold, 14px
- **Time**: absolute format — `HH:mm` (e.g. `14:32`), right-aligned, secondary color
- **Content**: full note text, wraps naturally, 15px, primary color
- **Card**: white background, 12px border-radius, soft shadow, 12px padding
- **Spacing**: 8px gap between cards
- Unread cards in Feed: left border accent (3px solid accent color) to distinguish

---

## Screen 1 — Home (HIGHEST PRIORITY)

This is the first screen users see. Design must be clean and fast.

```
┌─────────────────────────────────────────┐
│  TechNote                          ⚙️  │  ← header: app name + settings icon
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────┐   │
│  │                                 │   │
│  │  Nhập báo cáo tại đây...        │   │  ← textarea, large, rounded
│  │                                 │   │
│  │                                 │   │
│  │                                 │   │
│  └─────────────────────────────────┘   │
│                                         │
│       ┌──────────────────────┐          │
│       │        SEND          │          │  ← accent color button, full width
│       └──────────────────────┘          │
│                                         │
├─────────────────────────────────────────┤
│  🏠 Home  🔔 Feed  📋 Activity  🕐 Hist │  ← bottom tabs
└─────────────────────────────────────────┘
```

**Specifications:**
- Textarea: min-height 180px, expands with content, placeholder "Nhập báo cáo tại đây..."
- Textarea: no resize handle, border `1px solid #E5E7EB`, focus border accent color
- SEND button: full width, height 52px, accent color background, white text, bold, 16px
- SEND button: border-radius 12px, no shadow, active state slightly darker
- SEND button: disabled + spinner when request is in-flight
- After successful SEND: clear textarea, brief green checkmark flash on button
- Offline indicator: small yellow banner below header "📡 Offline — note sẽ gửi khi có mạng"

---

## Screen 2 — Feed (Unread notifications)

Shows notes not yet viewed by the current user, newest first.

**Specifications:**
- Header: "Feed" + unread count badge (e.g. "Feed  •  3")
- Empty state: centered icon + text "Không có báo cáo mới"
- Each card: uses shared Report Card component with accent left-border
- Tap card → mark as read → left border disappears, card stays in list
- "Mark all as read" button at top right when list is non-empty
- Pull-to-refresh supported

---

## Screen 3 — Activity (My notes, last 48h)

Shows only notes sent by the currently logged-in user, last 48 hours.

**Specifications:**
- Header: "Activity (48h)"
- Uses shared Report Card component, no unread styling
- Empty state: "Bạn chưa gửi báo cáo nào trong 48 giờ qua"
- Sorted: newest first

---

## Screen 4 — History (All notes, last 5 days)

Shows all notes from all team members, last 5 days.

**Specifications:**
- Header: "History"
- Grouped by date — sticky date separator between days:
  ```
  ──── Hôm nay, 31/07 ────
  [cards]
  ──── Hôm qua, 30/07 ────
  [cards]
  ```
- Sorted: newest first within each day
- Date separator: centered text, secondary color, thin divider lines
- Empty state: "Không có báo cáo trong 5 ngày qua"

---

## Screen 5 — Settings (overlay / modal, not a tab)

Accessed via ⚙️ gear icon in top-right of **Home screen header only** (other tabs do not show the gear icon).

**Specifications:**
- Slide-up modal or separate screen
- Fields:
  - **Display name** (nickname): text input, editable
  - **Badge color**: color picker — show a row of 10 preset colors to choose from
    - Suggested palette: red, orange, amber, green, teal, blue, indigo, purple, pink, gray
    - Selected color shows checkmark inside the circle
  - **Logout**: red text button at bottom
- Save button: "Lưu thay đổi" — accent color, full width
- No change password feature — passwords are assigned by admin and fixed

---

## Away-log overlay (not a tab — triggered by 2h logic)

Shown automatically when user reopens app after >2 hours away.

**Specifications:**
- Full-screen overlay on top of Home tab
- Header: "Bạn đã vắng mặt X giờ" (e.g. "Bạn đã vắng mặt 3 giờ")
- Subheader: "Có N báo cáo mới trong lúc bạn vắng"
- List: shared Report Card components, all unread notes since last open
- Bottom: large button "Đã xem — Đóng" → dismisses overlay, marks all as read, goes to Home
- If no unread notes: skip overlay entirely, go straight to Home

---

## Responsive behavior

| Breakpoint | Behavior |
|---|---|
| Mobile < 768px | Full-width layout, all screens as designed above |
| Desktop ≥ 768px | Max-width 480px centered, subtle drop shadow on sides, rest of page is `#F0F2F5` |

Desktop does not need a completely different layout — the mobile layout centered at 480px is sufficient and intentional.

---

## Micro-interactions

- SEND button: press → slight scale-down (transform: scale(0.97)) → release
- Tab switch: instant, no transition animation needed
- Card tap (Feed): smooth fade of left accent border on read
- Toast notifications (bottom of screen, above tab bar):
  - Success: green background "✓ Đã gửi"
  - Error: red background "✗ Gửi thất bại, thử lại"
  - Duration: 2 seconds, auto-dismiss

---

## What NOT to include

- No dark mode toggle (light only)
- No search bar
- No avatars or profile photos
- No emoji picker in input
- No message threading or replies
- No read receipts shown to sender
- No online/offline status indicators per user
