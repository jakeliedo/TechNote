import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from jose import JWTError, jwt
from sqlalchemy import select

from server.auth import JWT_ALGORITHM, JWT_SECRET
from server.database import AsyncSessionLocal, create_tables, run_migrations
from server.models import User
from server.routes import devices, reports, users
from server.ws import manager


@asynccontextmanager
async def lifespan(_: FastAPI):
    os.makedirs("media", exist_ok=True)
    await create_tables()
    await run_migrations()
    yield


app = FastAPI(title="TechNote", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router)
app.include_router(devices.router)
app.include_router(reports.router)


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket, token: str = ""):
    # Validate JWT before accepting the connection
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        await ws.accept()
        await ws.close(code=4001)
        return

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(User).where(User.id == user_id, User.is_active.is_(True))
        )
        user = result.scalar_one_or_none()

    if user is None:
        await ws.accept()
        await ws.close(code=4001)
        return

    await manager.connect(ws)
    try:
        while True:
            # Discard any client messages — this connection is receive-only for the client
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(ws)


# Serve uploaded images — must be before frontend catch-all
os.makedirs("media", exist_ok=True)
app.mount("/media", StaticFiles(directory="media"), name="media")

# Serve PWA frontend — must be mounted last so API routes take precedence
if os.path.isdir("frontend"):
    app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")
