import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDPrimaryKey
from app.models.enums import AlertType, DeliveryChannel, DeliveryStatus, str_enum


class Alert(UUIDPrimaryKey, Base):
    """An alert event, stored once per workspace. Each member's read/dismissed state is in AlertRecipient."""

    __tablename__ = "alerts"
    __table_args__ = (
        UniqueConstraint("workspace_id", "dedupe_key"),
        Index("ix_alerts_workspace_created", "workspace_id", "created_at"),
    )

    workspace_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"))
    alert_type: Mapped[AlertType] = mapped_column(str_enum(AlertType, "alert_type"))
    saved_search_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("saved_searches.id", ondelete="SET NULL"), index=True
    )
    company_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("companies.id", ondelete="SET NULL"))
    title: Mapped[str] = mapped_column(String(300))
    detail: Mapped[str | None] = mapped_column(Text)
    # e.g. {"runId": ..., "newCount": 3, "leadIds": [...first 20]}
    payload: Mapped[dict | None] = mapped_column(JSONB)
    dedupe_key: Mapped[str] = mapped_column(String(200))
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AlertRecipient(Base):
    __tablename__ = "alert_recipients"
    __table_args__ = (Index("ix_alert_recipients_user_state", "user_id", "dismissed_at", "read_at"),)

    alert_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("alerts.id", ondelete="CASCADE"), primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    dismissed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class NotificationDelivery(UUIDPrimaryKey, Base):
    """One delivery of an alert to one user over one channel. Never marked sent unless it really was."""

    __tablename__ = "notification_deliveries"
    __table_args__ = (Index("ix_notification_deliveries_status", "status", "channel"),)

    alert_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("alerts.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    channel: Mapped[DeliveryChannel] = mapped_column(str_enum(DeliveryChannel, "delivery_channel"))
    status: Mapped[DeliveryStatus] = mapped_column(str_enum(DeliveryStatus, "delivery_status"))
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    last_attempt_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    error_code: Mapped[str | None] = mapped_column(String(50))
    error_message: Mapped[str | None] = mapped_column(String(500))
    # alert:user:channel — makes delivery creation idempotent.
    idempotency_key: Mapped[str] = mapped_column(String(200), unique=True)
