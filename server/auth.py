import os
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from server.database import get_db
from server.models import User

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_DAYS = 30

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
_bearer = HTTPBearer()


def hash_password(password: str) -> str:
    return _pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return _pwd_context.verify(plain, hashed)


def create_access_token(user_id: int, token_version: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRE_DAYS)
    payload = {"sub": str(user_id), "tv": token_version, "exp": expire}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    invalid = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = int(payload["sub"])
        token_version = int(payload.get("tv", -1))
    except (JWTError, KeyError, ValueError):
        raise invalid

    result = await db.execute(select(User).where(User.id == user_id, User.is_active.is_(True)))
    user = result.scalar_one_or_none()
    if user is None or user.token_version != token_version:
        raise invalid
    return user
