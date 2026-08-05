import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from server.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    display_name: Mapped[str] = mapped_column(Text, unique=True, nullable=False, index=True)
    email: Mapped[str] = mapped_column(Text, unique=True, nullable=False, index=True)
    phone: Mapped[str | None] = mapped_column(Text, nullable=True)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    username: Mapped[str | None] = mapped_column(Text, unique=True, nullable=True, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, server_default="true", nullable=False)
    badge_color: Mapped[str] = mapped_column(Text, nullable=False, default="#5BA4CF")
    token_version: Mapped[int] = mapped_column(Integer, server_default="1", nullable=False)

    devices: Mapped[list["Device"]] = relationship("Device", back_populates="user")
    reports: Mapped[list["Report"]] = relationship("Report", back_populates="user")
    reads: Mapped[list["ReportRead"]] = relationship("ReportRead", back_populates="user")
    checks: Mapped[list["ReportCheck"]] = relationship("ReportCheck", back_populates="user")


class Device(Base):
    __tablename__ = "devices"
    __table_args__ = (
        UniqueConstraint("user_id", "platform", name="uq_device_user_platform"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    platform: Mapped[str | None] = mapped_column(Text, nullable=True)  # 'android' | 'ios' | 'web'
    fcm_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_seen: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="devices")


class Report(Base):
    __tablename__ = "reports"
    __table_args__ = (
        Index("ix_reports_created_at", "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    client_uuid: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), unique=True, nullable=True
    )
    image_path: Mapped[str | None] = mapped_column(Text, nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="reports")
    reads: Mapped[list["ReportRead"]] = relationship("ReportRead", back_populates="report")
    checks: Mapped[list["ReportCheck"]] = relationship("ReportCheck", back_populates="report")


class ReportRead(Base):
    __tablename__ = "report_reads"
    __table_args__ = (
        Index("ix_report_reads_user_id", "user_id"),
    )

    report_id: Mapped[int] = mapped_column(ForeignKey("reports.id"), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    read_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    report: Mapped["Report"] = relationship("Report", back_populates="reads")
    user: Mapped["User"] = relationship("User", back_populates="reads")


class ReportReaction(Base):
    __tablename__ = "report_reactions"
    __table_args__ = (
        Index("ix_report_reactions_user_id", "user_id"),
    )

    report_id: Mapped[int] = mapped_column(ForeignKey("reports.id"), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    reaction: Mapped[str] = mapped_column(Text, nullable=False)
    reacted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    report: Mapped["Report"] = relationship("Report")
    user: Mapped["User"] = relationship("User")


class ReportCheck(Base):
    __tablename__ = "report_checks"
    __table_args__ = (
        Index("ix_report_checks_user_id", "user_id"),
    )

    report_id: Mapped[int] = mapped_column(ForeignKey("reports.id"), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    checked_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    report: Mapped["Report"] = relationship("Report", back_populates="checks")
    user: Mapped["User"] = relationship("User", back_populates="checks")
