import os

# Must set env vars before any server import
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://technote:technote@localhost:5432/technote")
os.environ.setdefault("JWT_SECRET", "test-secret-for-pytest")
os.environ.setdefault("FCM_PROJECT_ID", "")                      # disables FCM in tests
os.environ.setdefault("GOOGLE_APPLICATION_CREDENTIALS", "")

import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from server.auth import hash_password
from server.database import Base, get_db
from server.main import app
from server.models import User

TEST_DB_URL = os.environ["DATABASE_URL"]
test_engine = create_async_engine(TEST_DB_URL, echo=False)
TestSession = async_sessionmaker(bind=test_engine, expire_on_commit=False)


# ── DB lifecycle ──────────────────────────────────────────────────────────────

@pytest.fixture(scope="session", autouse=True)
async def setup_db():
    """Create all tables once; wipe existing data before tests begin."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with TestSession() as db:
        for tbl in reversed(Base.metadata.sorted_tables):
            await db.execute(tbl.delete())
        await db.commit()
    yield
    await test_engine.dispose()


@pytest.fixture(autouse=True)
async def clean_db():
    """Wipe all rows after each test so tests are isolated."""
    yield
    async with TestSession() as db:
        for tbl in reversed(Base.metadata.sorted_tables):
            await db.execute(tbl.delete())
        await db.commit()


# ── Override get_db dependency ────────────────────────────────────────────────

async def _test_get_db():
    async with TestSession() as session:
        yield session

app.dependency_overrides[get_db] = _test_get_db


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
async def client() -> AsyncClient:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest.fixture
async def db() -> AsyncSession:
    async with TestSession() as session:
        yield session


@pytest.fixture
async def user1(db: AsyncSession) -> User:
    u = User(
        display_name="Liem",
        email="liem@clubvegaming.com",
        password_hash=hash_password("Clubv@482"),
        badge_color="#5BA4CF",
    )
    db.add(u)
    await db.commit()
    await db.refresh(u)
    return u


@pytest.fixture
async def user2(db: AsyncSession) -> User:
    u = User(
        display_name="Nghia",
        email="nghia@clubvegaming.com",
        password_hash=hash_password("Clubv@716"),
        badge_color="#E53E3E",
    )
    db.add(u)
    await db.commit()
    await db.refresh(u)
    return u


@pytest.fixture
async def token1(client: AsyncClient, user1: User) -> str:
    res = await client.post("/auth/login", json={"nickname": "Liem", "password": "Clubv@482"})
    assert res.status_code == 200
    return res.json()["access_token"]


@pytest.fixture
async def token2(client: AsyncClient, user2: User) -> str:
    res = await client.post("/auth/login", json={"nickname": "Nghia", "password": "Clubv@716"})
    assert res.status_code == 200
    return res.json()["access_token"]


@pytest.fixture
def auth_headers1(token1: str) -> dict:
    return {"Authorization": f"Bearer {token1}"}


@pytest.fixture
def auth_headers2(token2: str) -> dict:
    return {"Authorization": f"Bearer {token2}"}
