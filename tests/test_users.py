import pytest
from httpx import AsyncClient


class TestGetMe:

    async def test_get_me_success(self, client: AsyncClient, user1, auth_headers1):
        res = await client.get("/users/me", headers=auth_headers1)
        assert res.status_code == 200
        body = res.json()
        assert body["display_name"] == "Liem"
        assert body["email"] == "liem@clubvegaming.com"
        assert body["badge_color"] == "#5BA4CF"
        assert body["is_active"] is True
        assert "password_hash" not in body

    async def test_get_me_no_token(self, client: AsyncClient, user1):
        res = await client.get("/users/me")
        assert res.status_code == 403    # HTTPBearer returns 403 when no token

    async def test_get_me_invalid_token(self, client: AsyncClient, user1):
        res = await client.get("/users/me", headers={"Authorization": "Bearer invalid.token.here"})
        assert res.status_code == 401


class TestUpdateProfile:

    async def test_update_display_name(self, client: AsyncClient, user1, auth_headers1):
        res = await client.put("/users/me", headers=auth_headers1, json={
            "display_name": "Liem Updated",
            "badge_color": "#5BA4CF",
        })
        assert res.status_code == 200
        assert res.json()["display_name"] == "Liem Updated"

    async def test_update_badge_color(self, client: AsyncClient, user1, auth_headers1):
        res = await client.put("/users/me", headers=auth_headers1, json={
            "display_name": "Liem",
            "badge_color": "#E53E3E",
        })
        assert res.status_code == 200
        assert res.json()["badge_color"] == "#E53E3E"

    async def test_update_persists(self, client: AsyncClient, user1, auth_headers1):
        await client.put("/users/me", headers=auth_headers1, json={
            "display_name": "Liem New",
            "badge_color": "#38A169",
        })
        res = await client.get("/users/me", headers=auth_headers1)
        assert res.json()["display_name"] == "Liem New"
        assert res.json()["badge_color"] == "#38A169"

    async def test_update_invalid_color_format(self, client: AsyncClient, user1, auth_headers1):
        res = await client.put("/users/me", headers=auth_headers1, json={
            "display_name": "Liem",
            "badge_color": "blue",        # not a hex color
        })
        assert res.status_code == 422

    async def test_update_empty_name(self, client: AsyncClient, user1, auth_headers1):
        res = await client.put("/users/me", headers=auth_headers1, json={
            "display_name": "",
            "badge_color": "#5BA4CF",
        })
        assert res.status_code == 422

    async def test_update_requires_auth(self, client: AsyncClient, user1):
        res = await client.put("/users/me", json={
            "display_name": "Liem",
            "badge_color": "#5BA4CF",
        })
        assert res.status_code == 403
