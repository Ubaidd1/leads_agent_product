"""Alerts and in-app notifications.

An Alert is stored once per workspace; each member gets an AlertRecipient row holding their own
read/dismissed state. NotificationDelivery records every channel attempt and is never marked
``sent`` unless the delivery really happened (in-app: the recipient row was written).
"""

import math
import uuid

from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.context import RequestContext
from app.core.exceptions import NotFound, ValidationFailed
from app.models import Alert, AlertRecipient, NotificationDelivery, SavedSearch, SavedSearchRun, WorkspaceMembership
from app.models.enums import AlertType, DeliveryChannel, DeliveryStatus
from app.schemas.alerts import AlertOut, DeliveryOut
from app.schemas.common import Page
from app.utils.time import utcnow

settings = get_settings()

LEAD_IDS_IN_PAYLOAD = 20


def email_configured() -> bool:
    # The console adapter only logs messages; it does not deliver them.
    return settings.email_backend != "console"


def _plural(n: int, word: str) -> str:
    return f"{n} {word}{'' if n == 1 else 's'}"


def create_alert(
    db: Session,
    *,
    workspace_id: uuid.UUID,
    alert_type: AlertType,
    dedupe_key: str,
    title: str,
    detail: str | None = None,
    payload: dict | None = None,
    saved_search_id: uuid.UUID | None = None,
    company_id: uuid.UUID | None = None,
    in_app: bool = True,
    email: bool = False,
    is_demo: bool = False,
) -> Alert | None:
    """Creates an alert for every current member (decision D2.2). Returns None if the dedupe key already exists."""
    alert_id = db.scalar(
        insert(Alert)
        .values(
            id=uuid.uuid4(),
            workspace_id=workspace_id,
            alert_type=alert_type,
            saved_search_id=saved_search_id,
            company_id=company_id,
            title=title,
            detail=detail,
            payload=payload,
            dedupe_key=dedupe_key,
            is_demo=is_demo,
        )
        .on_conflict_do_nothing(index_elements=["workspace_id", "dedupe_key"])
        .returning(Alert.id)
    )
    if alert_id is None:
        return None
    now = utcnow()
    member_ids = list(
        db.scalars(select(WorkspaceMembership.user_id).where(WorkspaceMembership.workspace_id == workspace_id))
    )
    deliveries = []
    for user_id in member_ids:
        if in_app:
            db.add(AlertRecipient(alert_id=alert_id, user_id=user_id))
            deliveries.append((user_id, DeliveryChannel.IN_APP, DeliveryStatus.SENT, None, now))
        if email:
            if email_configured():
                deliveries.append((user_id, DeliveryChannel.EMAIL, DeliveryStatus.PENDING, None, None))
            else:
                deliveries.append(
                    (user_id, DeliveryChannel.EMAIL, DeliveryStatus.SKIPPED, "EMAIL_NOT_CONFIGURED", None)
                )
    for user_id, channel, status, error_code, sent_at in deliveries:
        db.add(
            NotificationDelivery(
                alert_id=alert_id,
                user_id=user_id,
                channel=channel,
                status=status,
                attempts=1 if status == DeliveryStatus.SENT else 0,
                last_attempt_at=sent_at,
                sent_at=sent_at,
                error_code=error_code,
                error_message="No email provider is configured." if error_code else None,
                idempotency_key=f"{alert_id}:{user_id}:{channel.value}",
            )
        )
    db.flush()
    return db.get(Alert, alert_id)


def alert_for_search_run(db: Session, search: SavedSearch, run: SavedSearchRun, new_lead_ids: list[uuid.UUID]) -> None:
    """Called inside a saved-search run when it found new matches."""
    if search.notifications_paused or not (search.notify_in_app or search.notify_email):
        return
    count = len(new_lead_ids)
    create_alert(
        db,
        workspace_id=search.workspace_id,
        alert_type=AlertType.SAVED_SEARCH_MATCHES,
        dedupe_key=f"search:{search.id}:run:{run.id}",
        title=f"{_plural(count, 'new lead')} matched “{search.name}”",
        detail=search.name,
        payload={
            "runId": str(run.id),
            "newCount": count,
            "leadIds": [str(i) for i in new_lead_ids[:LEAD_IDS_IN_PAYLOAD]],
        },
        saved_search_id=search.id,
        in_app=search.notify_in_app,
        email=search.notify_email,
    )


# --- reads and per-user state --------------------------------------------------------


def _mine(ctx: RequestContext):
    return (
        select(Alert, AlertRecipient, SavedSearch)
        .join(AlertRecipient, AlertRecipient.alert_id == Alert.id)
        .outerjoin(SavedSearch, SavedSearch.id == Alert.saved_search_id)
        .where(
            Alert.workspace_id == ctx.workspace.id,
            AlertRecipient.user_id == ctx.user.id,
            AlertRecipient.dismissed_at.is_(None),
        )
    )


def _to_out(alert: Alert, recipient: AlertRecipient, search: SavedSearch | None, deliveries: list) -> AlertOut:
    return AlertOut(
        id=alert.id,
        type=alert.alert_type,
        title=alert.title,
        detail=alert.detail,
        payload=alert.payload or {},
        saved_search_id=alert.saved_search_id,
        saved_search_name=search.name if search else None,
        company_id=alert.company_id,
        created_at=alert.created_at,
        is_read=recipient.read_at is not None,
        read_at=recipient.read_at,
        can_pause=search is not None,
        is_paused=bool(search and search.notifications_paused),
        channels=[DeliveryOut.model_validate(d) for d in deliveries],
        is_demo=alert.is_demo,
    )


def list_alerts(
    db: Session,
    ctx: RequestContext,
    *,
    unread: bool | None,
    alert_type: AlertType | None,
    saved_search_id: uuid.UUID | None,
    page: int,
    page_size: int,
) -> Page[AlertOut]:
    stmt = _mine(ctx)
    if unread is True:
        stmt = stmt.where(AlertRecipient.read_at.is_(None))
    elif unread is False:
        stmt = stmt.where(AlertRecipient.read_at.is_not(None))
    if alert_type:
        stmt = stmt.where(Alert.alert_type == alert_type)
    if saved_search_id:
        stmt = stmt.where(Alert.saved_search_id == saved_search_id)
    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = db.execute(
        stmt.order_by(Alert.created_at.desc(), Alert.id.desc()).limit(page_size).offset((page - 1) * page_size)
    ).all()
    deliveries: dict[uuid.UUID, list] = {}
    if rows:
        for delivery in db.scalars(
            select(NotificationDelivery)
            .where(
                NotificationDelivery.alert_id.in_([row[0].id for row in rows]),
                NotificationDelivery.user_id == ctx.user.id,
            )
            .order_by(NotificationDelivery.channel)
        ):
            deliveries.setdefault(delivery.alert_id, []).append(delivery)
    items = [_to_out(alert, recipient, search, deliveries.get(alert.id, [])) for alert, recipient, search in rows]
    return Page(items=items, total=total, page=page, page_size=page_size, total_pages=math.ceil(total / page_size))


def unread_count(db: Session, ctx: RequestContext) -> int:
    return db.scalar(
        select(func.count())
        .select_from(AlertRecipient)
        .join(Alert, Alert.id == AlertRecipient.alert_id)
        .where(
            AlertRecipient.user_id == ctx.user.id,
            AlertRecipient.read_at.is_(None),
            AlertRecipient.dismissed_at.is_(None),
            Alert.workspace_id == ctx.workspace.id,
        )
    )


def _get_mine(db: Session, ctx: RequestContext, alert_id: uuid.UUID):
    row = db.execute(_mine(ctx).where(Alert.id == alert_id)).first()
    if row is None:
        raise NotFound()
    return row


def update_alert(
    db: Session, ctx: RequestContext, alert_id: uuid.UUID, *, read: bool | None, paused: bool | None
) -> AlertOut:
    from app.services import saved_searches as search_service  # local import: saved_searches imports this module

    alert, recipient, search = _get_mine(db, ctx, alert_id)
    if read is not None:
        recipient.read_at = (recipient.read_at or utcnow()) if read else None
    if paused is not None:
        if search is None:
            raise ValidationFailed("Only alerts from a saved search can be paused.", code="ALERT_NOT_PAUSABLE")
        search_service.require_edit(ctx, search)
        search.notifications_paused = paused
    db.commit()
    deliveries = list(
        db.scalars(
            select(NotificationDelivery).where(
                NotificationDelivery.alert_id == alert.id, NotificationDelivery.user_id == ctx.user.id
            )
        )
    )
    return _to_out(alert, recipient, search, deliveries)


def mark_all_read(db: Session, ctx: RequestContext) -> int:
    alert_ids = select(Alert.id).where(Alert.workspace_id == ctx.workspace.id)
    result = db.execute(
        update(AlertRecipient)
        .where(
            AlertRecipient.user_id == ctx.user.id,
            AlertRecipient.read_at.is_(None),
            AlertRecipient.dismissed_at.is_(None),
            AlertRecipient.alert_id.in_(alert_ids),
        )
        .values(read_at=utcnow())
    )
    db.commit()
    return result.rowcount


def dismiss_alert(db: Session, ctx: RequestContext, alert_id: uuid.UUID) -> None:
    """Hides the alert for the caller only. Idempotent: dismissing twice is a no-op."""
    recipient = db.scalar(
        select(AlertRecipient)
        .join(Alert, Alert.id == AlertRecipient.alert_id)
        .where(
            AlertRecipient.alert_id == alert_id,
            AlertRecipient.user_id == ctx.user.id,
            Alert.workspace_id == ctx.workspace.id,
        )
    )
    if recipient is None:
        raise NotFound()
    if recipient.dismissed_at is None:
        recipient.dismissed_at = utcnow()
        db.commit()
