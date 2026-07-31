from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from server.auth import get_current_user
from server.database import get_db
from server.models import Device, User

router = APIRouter()


class DeviceRegisterRequest(BaseModel):
    fcm_token: str
    platform: Literal["android", "ios", "web"]


@router.post("/devices/register", status_code=status.HTTP_204_NO_CONTENT)
async def register_device(
    body: DeviceRegisterRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Device).where(
            Device.user_id == current_user.id,
            Device.platform == body.platform,
        )
    )
    device = result.scalar_one_or_none()
    now = datetime.now(timezone.utc)
    if device:
        device.fcm_token = body.fcm_token
        device.last_seen = now
    else:
        db.add(Device(
            user_id=current_user.id,
            platform=body.platform,
            fcm_token=body.fcm_token,
            last_seen=now,
        ))
    await db.commit()
