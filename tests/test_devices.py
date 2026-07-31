import pytest
from httpx import AsyncClient
from sqlalchemy import select

from server.models import Device


class TestRegisterDevice:

    async def test_register_android(self, client: AsyncClient, user1, auth_headers1, db):
        res = await client.post("/devices/register", headers=auth_headers1, json={
            "fcm_token": "android-token-abc123",
            "platform": "android",
        })
        assert res.status_code == 204

        result = await db.execute(select(Device).where(Device.user_id == user1.id))
        device = result.scalar_one()
        assert device.fcm_token == "android-token-abc123"
        assert device.platform == "android"
        assert device.last_seen is not None

    async def test_register_ios(self, client: AsyncClient, user1, auth_headers1):
        res = await client.post("/devices/register", headers=auth_headers1, json={
            "fcm_token": "ios-token-xyz789",
            "platform": "ios",
        })
        assert res.status_code == 204

    async def test_register_web(self, client: AsyncClient, user1, auth_headers1):
        res = await client.post("/devices/register", headers=auth_headers1, json={
            "fcm_token": "web-token-def456",
            "platform": "web",
        })
        assert res.status_code == 204

    async def test_register_updates_existing_token(
        self, client: AsyncClient, user1, auth_headers1, db
    ):
        await client.post("/devices/register", headers=auth_headers1, json={
            "fcm_token": "old-token",
            "platform": "android",
        })
        await client.post("/devices/register", headers=auth_headers1, json={
            "fcm_token": "new-token",
            "platform": "android",
        })

        result = await db.execute(
            select(Device).where(Device.user_id == user1.id, Device.platform == "android")
        )
        devices = result.scalars().all()
        assert len(devices) == 1          # no duplicate row
        assert devices[0].fcm_token == "new-token"

    async def test_register_multiple_platforms(
        self, client: AsyncClient, user1, auth_headers1, db
    ):
        await client.post("/devices/register", headers=auth_headers1, json={
            "fcm_token": "android-token", "platform": "android"
        })
        await client.post("/devices/register", headers=auth_headers1, json={
            "fcm_token": "web-token", "platform": "web"
        })

        result = await db.execute(select(Device).where(Device.user_id == user1.id))
        devices = result.scalars().all()
        assert len(devices) == 2

    async def test_register_invalid_platform(self, client: AsyncClient, user1, auth_headers1):
        res = await client.post("/devices/register", headers=auth_headers1, json={
            "fcm_token": "token",
            "platform": "windows",        # not allowed
        })
        assert res.status_code == 422

    async def test_register_requires_auth(self, client: AsyncClient, user1):
        res = await client.post("/devices/register", json={
            "fcm_token": "token", "platform": "android"
        })
        assert res.status_code == 403
