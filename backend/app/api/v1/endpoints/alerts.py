import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from app.api.deps import DB, Ctx, Paging
from app.models.enums import AlertType
from app.schemas.alerts import AlertOut, AlertUpdate, UnreadCount, UpdatedCount
from app.schemas.common import Page
from app.services import alerts as service

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("", response_model=Page[AlertOut])
def list_alerts(
    db: DB,
    ctx: Ctx,
    paging: Annotated[Paging, Depends()],
    unread: bool | None = None,
    alert_type: Annotated[AlertType | None, Query(alias="type")] = None,
    saved_search_id: Annotated[uuid.UUID | None, Query(alias="savedSearchId")] = None,
):
    return service.list_alerts(
        db,
        ctx,
        unread=unread,
        alert_type=alert_type,
        saved_search_id=saved_search_id,
        page=paging.page,
        page_size=paging.page_size,
    )


@router.get("/unread-count", response_model=UnreadCount)
def unread_count(db: DB, ctx: Ctx):
    return UnreadCount(count=service.unread_count(db, ctx))


@router.post("/mark-all-read", response_model=UpdatedCount)
def mark_all_read(db: DB, ctx: Ctx):
    return UpdatedCount(updated=service.mark_all_read(db, ctx))


@router.patch("/{alert_id}", response_model=AlertOut)
def update_alert(alert_id: uuid.UUID, body: AlertUpdate, db: DB, ctx: Ctx):
    return service.update_alert(db, ctx, alert_id, read=body.read, paused=body.paused)


@router.delete("/{alert_id}", status_code=status.HTTP_204_NO_CONTENT)
def dismiss_alert(alert_id: uuid.UUID, db: DB, ctx: Ctx):
    service.dismiss_alert(db, ctx, alert_id)
