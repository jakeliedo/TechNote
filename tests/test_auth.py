import pytest
from httpx import AsyncClient


class TestLogin:

    async def test_login_success(self, client: AsyncClient, user1):
        res = await client.post("/auth/login", json={
            "nickname": "Liem", "password": "Clubv@482"
        })
        assert res.status_code == 200
        body = res.json()
        assert "access_token" in body
        assert body["token_type"] == "bearer"
        assert len(body["access_token"]) > 20

    async def test_login_wrong_password(self, client: AsyncClient, user1):
        res = await client.post("/auth/login", json={
            "nickname": "Liem", "password": "wrongpassword"
        })
        assert res.status_code == 401

    async def test_login_wrong_nickname(self, client: AsyncClient, user1):
        res = await client.post("/auth/login", json={
            "nickname": "NonExistent", "password": "Clubv@482"
        })
        assert res.status_code == 401

    async def test_login_inactive_user(self, client: AsyncClient, db, user1):
        user1.is_active = False
        await db.commit()
        res = await client.post("/auth/login", json={
            "nickname": "Liem", "password": "Clubv@482"
        })
        assert res.status_code == 401

    async def test_login_missing_fields(self, client: AsyncClient):
        res = await client.post("/auth/login", json={"nickname": "Liem"})
        assert res.status_code == 422

    async def test_login_case_sensitive_nickname(self, client: AsyncClient, user1):
        res = await client.post("/auth/login", json={
            "nickname": "liem", "password": "Clubv@482"   # lowercase
        })
        assert res.status_code == 401
