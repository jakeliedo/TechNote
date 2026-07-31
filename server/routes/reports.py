import uuid as uuid_lib
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from server.auth import get_current_user
from server.database import get_db
from server.models import Report, ReportRead, User
from server import fcm
from server.ws import manager as ws_manager

router = APIRouter()


# ── Schemas ──────────────────────────────────────────────────────────────────

class ReportCreate(BaseModel):
    body: str = Field(min_length=1)
    client_uuid: uuid_lib.UUID | None = None


class AuthorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    display_name: str
    badge_color: str


class ReportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int
    body: str
    created_at: datetime
    client_uuid: uuid_lib.UUID | None
    user: AuthorOut


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _load_report(db: AsyncSession, report_id: int) -> Report:
    result = await db.execute(
        select(Report).options(selectinload(Report.user)).where(Report.id == report_id)
    )
    report = result.scalar_one_or_none()
    if report is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    return report


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/reports", response_model=ReportOut, status_code=status.HTTP_201_CREATED)
async def create_report(
    body: ReportCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Idempotent retry: return existing report if client_uuid already seen
    if body.client_uuid:
        result = await db.execute(
            select(Report)
            .options(selectinload(Report.user))
            .where(Report.client_uuid == body.client_uuid)
        )
        existing = result.scalar_one_or_none()
        if existing:
            return existing

    report = Report(user_id=current_user.id, body=body.body.strip(), client_uuid=body.client_uuid)
    db.add(report)
    await db.commit()

    report = await _load_report(db, report.id)
    report_data = ReportOut.model_validate(report).model_dump(mode="json")

    # Run FCM + WebSocket in background so they never block the response
    background_tasks.add_task(
        fcm.broadcast,
        exclude_user_id=current_user.id,
        sender=current_user.display_name,
        body=body.body.strip(),
    )
    background_tasks.add_task(ws_manager.broadcast, report_data)

    return report


@router.get("/reports", response_model=list[ReportOut])
async def list_reports(
    from_dt: datetime | None = Query(None, alias="from"),
    to_dt: datetime | None = Query(None, alias="to"),
    mine: bool = Query(False),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = (
        select(Report)
        .options(selectinload(Report.user))
        .order_by(Report.created_at.desc())
    )
    if from_dt:
        q = q.where(Report.created_at >= from_dt)
    if to_dt:
        q = q.where(Report.created_at <= to_dt)
    if mine:
        q = q.where(Report.user_id == current_user.id)
    q = q.limit(limit).offset(offset)

    result = await db.execute(q)
    return result.scalars().all()


@router.get("/reports/unread", response_model=list[ReportOut])
async def unread_reports(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    already_read = select(ReportRead.report_id).where(ReportRead.user_id == current_user.id)
    q = (
        select(Report)
        .options(selectinload(Report.user))
        .where(Report.id.not_in(already_read))
        .order_by(Report.created_at.asc())
    )
    result = await db.execute(q)
    return result.scalars().all()


@router.post("/reports/{report_id}/read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_read(
    report_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Report).where(Report.id == report_id))
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")

    existing = await db.execute(
        select(ReportRead).where(
            ReportRead.report_id == report_id,
            ReportRead.user_id == current_user.id,
        )
    )
    if existing.scalar_one_or_none() is None:
        db.add(ReportRead(report_id=report_id, user_id=current_user.id))
        await db.commit()
