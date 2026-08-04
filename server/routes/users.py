import re

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import or_, and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from server.auth import create_access_token, get_current_user, verify_password
from server.database import get_db
from server.models import User

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    nickname: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    display_name: str
    username: str | None
    email: str
    phone: str | None
    is_active: bool
    badge_color: str


class UserPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    display_name: str
    username: str | None
    badge_color: str


class UpdateProfileRequest(BaseModel):
    display_name: str = Field(min_length=1, max_length=80)
    badge_color: str = Field(max_length=200)

    @field_validator('badge_color')
    @classmethod
    def validate_color(cls, v: str) -> str:
        if re.match(r'^#[0-9A-Fa-f]{6}$', v) or v.startswith('linear-gradient('):
            return v
        raise ValueError('Invalid color format')


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/auth/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User).where(
            or_(User.username == body.nickname, User.display_name == body.nickname),
            User.is_active.is_(True),
        )
    )
    user = result.scalar_one_or_none()
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    user.token_version += 1
    await db.commit()
    return TokenResponse(access_token=create_access_token(user.id, user.token_version))


@router.get("/users/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.get("/users", response_model=list[UserPublic])
async def list_users(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User).where(User.is_active.is_(True)).order_by(User.display_name)
    )
    return result.scalars().all()


@router.put("/users/me", response_model=UserOut)
async def update_profile(
    body: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    fixed = current_user.username or current_user.display_name
    if body.display_name != fixed and not body.display_name.startswith(fixed + " | "):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Display name must start with '{fixed}' or '{fixed} | <suffix>'",
        )
    current_user.display_name = body.display_name
    current_user.badge_color = body.badge_color
    await db.commit()
    await db.refresh(current_user)
    return current_user


