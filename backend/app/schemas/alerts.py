import uuid
from datetime import datetime

from app.models.enums import AlertType, DeliveryChannel, DeliveryStatus
from app.schemas.common import CamelModel, RequestModel


class DeliveryOut(CamelModel):
    channel: DeliveryChannel
    status: DeliveryStatus
    attempts: int
    sent_at: datetime | None
    error_code: str | None
    error_message: str | None


class AlertOut(CamelModel):
    id: uuid.UUID
    type: AlertType
    title: str
    detail: str | None
    payload: dict
    saved_search_id: uuid.UUID | None
    saved_search_name: str | None
    company_id: uuid.UUID | None
    created_at: datetime
    is_read: bool
    read_at: datetime | None
    # Pausing applies to the alert's saved search, so only those alerts can be paused (decision D2.3).
    can_pause: bool
    is_paused: bool
    channels: list[DeliveryOut]
    is_demo: bool


class AlertUpdate(RequestModel):
    read: bool | None = None
    paused: bool | None = None


class UnreadCount(CamelModel):
    count: int


class UpdatedCount(CamelModel):
    updated: int
