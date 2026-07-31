import asyncio
import logging
import os

import httpx
from google.oauth2 import service_account
from sqlalchemy import select

from server.database import AsyncSessionLocal
from server.models import Device

log = logging.getLogger(__name__)

_PROJECT_ID = os.environ.get("FCM_PROJECT_ID", "")
_CREDENTIALS_PATH = os.environ.get(
    "GOOGLE_APPLICATION_CREDENTIALS", "server/firebase-service-account.json"
)
_FCM_URL = f"https://fcm.googleapis.com/v1/projects/{_PROJECT_ID}/messages:send"
_FCM_SCOPES = ["https://www.googleapis.com/auth/firebase.messaging"]

_credentials: service_account.Credentials | None = None


# ── Credential management ────────────────────────────────────────────────────

def _load_credentials() -> service_account.Credentials:
    global _credentials
    if _credentials is None:
        _credentials = service_account.Credentials.from_service_account_file(
            _CREDENTIALS_PATH, scopes=_FCM_SCOPES
        )
    return _credentials


def _sync_refresh_token() -> str:
    """Blocking token refresh — always called via run_in_executor."""
    import google.auth.transport.requests

    creds = _load_credentials()
    if not creds.valid:
        creds.refresh(google.auth.transport.requests.Request())
    return creds.token


async def _get_access_token() -> str:
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, _sync_refresh_token)


# ── Send one message ─────────────────────────────────────────────────────────

async def _send_one(
    client: httpx.AsyncClient,
    token: str,
    title: str,
    body: str,
    access_token: str,
) -> None:
    payload = {
        "message": {
            "token": token,
            "notification": {"title": title, "body": body},
            "android": {"priority": "high"},
            "apns": {"headers": {"apns-priority": "10"}},
        }
    }
    try:
        resp = await client.post(
            _FCM_URL,
            json=payload,
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if resp.status_code != 200:
            log.warning(
                "FCM rejected token %s…: %s %s",
                token[:16], resp.status_code, resp.text[:200],
            )
    except Exception as exc:
        log.warning("FCM request error for token %s…: %s", token[:16], exc)


# ── Public API ───────────────────────────────────────────────────────────────

async def broadcast(exclude_user_id: int, sender: str, body: str) -> None:
    """Push a notification to every registered device except the sender's."""
    if not _PROJECT_ID or _PROJECT_ID == "your-firebase-project-id":
        log.warning("FCM_PROJECT_ID not configured — push skipped")
        return

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Device.fcm_token).where(
                Device.user_id != exclude_user_id,
                Device.fcm_token.is_not(None),
            )
        )
        tokens = [t for t in result.scalars().all() if t]

    if not tokens:
        return

    try:
        access_token = await _get_access_token()
    except Exception as exc:
        log.error("FCM credential error — push skipped: %s", exc)
        return

    async with httpx.AsyncClient(timeout=10.0) as client:
        await asyncio.gather(
            *(_send_one(client, t, sender, body, access_token) for t in tokens),
            return_exceptions=True,
        )
