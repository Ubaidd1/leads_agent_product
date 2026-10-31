"""Saved searches: CRUD, duplicate, and runs that record which matches are new.

Every lookup is scoped to ``ctx.workspace.id``; a search in another workspace is a 404.
Edit rights (decision D2.1): the search's creator, or a workspace admin/owner.
"""

import logging
import math
import uuid

from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.context import RequestContext
from app.core.exceptions import Conflict, NotFound, PermissionDenied
from app.core.permissions import Permission
from app.models import Lead, SavedSearch, SavedSearchMatch, SavedSearchRun
from app.models.enums import LastRunStatus, Role, RunStatus, RunTrigger
from app.repositories import catalog as repo
from app.schemas.common import Page
from app.schemas.search import (
    SavedSearchCreate,
    SavedSearchDetail,
    SavedSearchOut,
    SavedSearchResult,
    SavedSearchRunOut,
    SavedSearchUpdate,
    SchedulingState,
    SearchCriteria,
)
from app.services import alerts as alert_service
from app.services import audit
from app.services.catalog import lead_summary
from app.utils.time import utcnow

logger = logging.getLogger(__name__)

MAX_MATCHES_PER_RUN = 10_000
SORTS = {"updatedAt": SavedSearch.updated_at, "name": SavedSearch.name, "lastRunAt": SavedSearch.last_run_at}
# Flipped on in Phase 3 once the scheduler runs saved searches automatically.
SCHEDULING_ENABLED = False


class RunInProgress(Conflict):
    code = "RUN_IN_PROGRESS"
    message = "This saved search is already running."


def _page(items, total, page, page_size) -> Page:
    return Page(items=items, total=total, page=page, page_size=page_size, total_pages=math.ceil(total / page_size))


def can_edit(ctx: RequestContext, search: SavedSearch) -> bool:
    return search.created_by_user_id == ctx.user.id or ctx.role in (Role.ADMIN, Role.OWNER)


def require_edit(ctx: RequestContext, search: SavedSearch) -> None:
    ctx.require(Permission.SAVED_SEARCHES_WRITE)
    if not can_edit(ctx, search):
        raise PermissionDenied("Only the person who created this search or a workspace admin can change it.")


def criteria_of(search: SavedSearch) -> SearchCriteria:
    return SearchCriteria.model_validate(search.criteria)


def to_out(ctx: RequestContext, search: SavedSearch) -> SavedSearchOut:
    return SavedSearchOut(
        **{field: getattr(search, field) for field in SavedSearchOut.model_fields if hasattr(search, field)},
        scheduling=SchedulingState(enabled=SCHEDULING_ENABLED),
        can_edit=can_edit(ctx, search),
    )


def get_search(db: Session, ctx: RequestContext, search_id: uuid.UUID) -> SavedSearch:
    search = db.scalar(
        select(SavedSearch).where(SavedSearch.id == search_id, SavedSearch.workspace_id == ctx.workspace.id)
    )
    if search is None:
        raise NotFound()
    return search


def _name_taken(db: Session, workspace_id: uuid.UUID, name: str, exclude: uuid.UUID | None = None) -> bool:
    stmt = select(SavedSearch.id).where(SavedSearch.workspace_id == workspace_id, SavedSearch.name == name)
    if exclude:
        stmt = stmt.where(SavedSearch.id != exclude)
    return db.scalar(stmt) is not None


def _commit_unique(db: Session) -> None:
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise Conflict("A saved search with this name already exists.", code="CONFLICT") from exc


def list_searches(
    db: Session, ctx: RequestContext, *, active: bool | None, sort: str, page: int, page_size: int
) -> Page[SavedSearchOut]:
    stmt = select(SavedSearch).where(SavedSearch.workspace_id == ctx.workspace.id)
    if active is not None:
        stmt = stmt.where(SavedSearch.is_active.is_(active))
    column = SORTS[sort]
    order = column.asc() if sort == "name" else column.desc().nulls_last()
    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = db.scalars(stmt.order_by(order, SavedSearch.id).limit(page_size).offset((page - 1) * page_size))
    return _page([to_out(ctx, row) for row in rows], total, page, page_size)


def create_search(db: Session, ctx: RequestContext, body: SavedSearchCreate) -> SavedSearchOut:
    ctx.require(Permission.SAVED_SEARCHES_WRITE)
    if _name_taken(db, ctx.workspace.id, body.name):
        raise Conflict("A saved search with this name already exists.")
    search = SavedSearch(
        workspace_id=ctx.workspace.id,
        created_by_user_id=ctx.user.id,
        name=body.name,
        criteria=body.criteria.stored(),
        frequency=body.frequency,
        is_active=body.is_active,
        notify_in_app=body.notify_in_app,
        notify_email=body.notify_email,
    )
    db.add(search)
    db.flush()
    audit.record(
        db,
        "saved_search.created",
        actor_user_id=ctx.user.id,
        workspace_id=ctx.workspace.id,
        target_type="saved_search",
        target_id=search.id,
    )
    _commit_unique(db)
    return to_out(ctx, search)


def get_detail(db: Session, ctx: RequestContext, search_id: uuid.UUID) -> SavedSearchDetail:
    search = get_search(db, ctx, search_id)
    latest = db.scalar(
        select(SavedSearchRun)
        .where(SavedSearchRun.saved_search_id == search.id)
        .order_by(SavedSearchRun.started_at.desc(), SavedSearchRun.id.desc())
        .limit(1)
    )
    return SavedSearchDetail(
        **to_out(ctx, search).model_dump(),
        latest_run=SavedSearchRunOut.model_validate(latest) if latest else None,
    )


def update_search(db: Session, ctx: RequestContext, search_id: uuid.UUID, body: SavedSearchUpdate) -> SavedSearchOut:
    search = get_search(db, ctx, search_id)
    require_edit(ctx, search)
    changes = body.model_dump(exclude_unset=True, exclude={"criteria"})
    if changes.get("name") and _name_taken(db, ctx.workspace.id, changes["name"], exclude=search.id):
        raise Conflict("A saved search with this name already exists.")
    for field, value in changes.items():
        if value is not None:
            setattr(search, field, value)
    if body.criteria is not None and body.criteria.stored() != search.criteria:
        # "New" is relative to the criteria, so changing them starts the match history over.
        search.criteria = body.criteria.stored()
        db.execute(delete(SavedSearchMatch).where(SavedSearchMatch.saved_search_id == search.id))
        search.last_result_count = None
        search.last_new_count = None
        search.last_run_status = LastRunStatus.NEVER
        search.last_run_id = None
        changes["criteria"] = "changed"
    audit.record(
        db,
        "saved_search.updated",
        actor_user_id=ctx.user.id,
        workspace_id=ctx.workspace.id,
        target_type="saved_search",
        target_id=search.id,
        details={"fields": sorted(changes)},
    )
    _commit_unique(db)
    db.refresh(search)
    return to_out(ctx, search)


def delete_search(db: Session, ctx: RequestContext, search_id: uuid.UUID) -> None:
    search = get_search(db, ctx, search_id)
    require_edit(ctx, search)
    db.delete(search)
    audit.record(
        db,
        "saved_search.deleted",
        actor_user_id=ctx.user.id,
        workspace_id=ctx.workspace.id,
        target_type="saved_search",
        target_id=search_id,
        details={"name": search.name},
    )
    db.commit()


def duplicate_search(db: Session, ctx: RequestContext, search_id: uuid.UUID) -> SavedSearchOut:
    ctx.require(Permission.SAVED_SEARCHES_WRITE)
    source = get_search(db, ctx, search_id)
    base = f"{source.name[:190]} (copy)"
    name, n = base, 2
    while _name_taken(db, ctx.workspace.id, name):
        name, n = f"{source.name[:186]} (copy {n})", n + 1
    copy = SavedSearch(
        workspace_id=ctx.workspace.id,
        created_by_user_id=ctx.user.id,
        name=name,
        criteria=dict(source.criteria),
        frequency=source.frequency,
        is_active=source.is_active,
        notify_in_app=source.notify_in_app,
        notify_email=source.notify_email,
    )
    db.add(copy)
    db.flush()
    audit.record(
        db,
        "saved_search.created",
        actor_user_id=ctx.user.id,
        workspace_id=ctx.workspace.id,
        target_type="saved_search",
        target_id=copy.id,
        details={"duplicatedFrom": str(source.id)},
    )
    _commit_unique(db)
    return to_out(ctx, copy)


# --- runs -------------------------------------------------------------------------


def execute_run(db: Session, search: SavedSearch, trigger: RunTrigger) -> SavedSearchRun:
    """Runs a search whose row the caller has locked. Commits; also used by the scheduler (Phase 3)."""
    run = SavedSearchRun(
        saved_search_id=search.id, workspace_id=search.workspace_id, trigger=trigger, status=RunStatus.RUNNING
    )
    db.add(run)
    db.flush()
    filters = criteria_of(search).to_filters()
    lead_ids = list(
        db.scalars(repo.lead_ids_query(search.workspace_id, filters).order_by(Lead.id).limit(MAX_MATCHES_PER_RUN + 1))
    )
    truncated = len(lead_ids) > MAX_MATCHES_PER_RUN
    lead_ids = lead_ids[:MAX_MATCHES_PER_RUN]
    new_ids: list[uuid.UUID] = []
    if lead_ids:
        new_ids = list(
            db.scalars(
                insert(SavedSearchMatch)
                .values(
                    [
                        {
                            "id": uuid.uuid4(),
                            "saved_search_id": search.id,
                            "lead_id": lead_id,
                            "first_matched_run_id": run.id,
                        }
                        for lead_id in lead_ids
                    ]
                )
                .on_conflict_do_nothing(index_elements=["saved_search_id", "lead_id"])
                .returning(SavedSearchMatch.lead_id)
            )
        )
    now = utcnow()
    run.status = RunStatus.SUCCEEDED
    run.finished_at = now
    run.result_count = len(lead_ids)
    run.new_count = len(new_ids)
    run.truncated = truncated
    search.last_run_at = now
    search.last_run_status = LastRunStatus.SUCCEEDED
    search.last_run_id = run.id
    search.last_result_count = run.result_count
    search.last_new_count = run.new_count
    if new_ids:
        alert_service.alert_for_search_run(db, search, run, new_ids)
    db.commit()
    return run


def _record_failure(db: Session, search_id: uuid.UUID, workspace_id: uuid.UUID, trigger: RunTrigger) -> SavedSearchRun:
    run = SavedSearchRun(
        saved_search_id=search_id,
        workspace_id=workspace_id,
        trigger=trigger,
        status=RunStatus.FAILED,
        finished_at=utcnow(),
        error_code="RUN_FAILED",
        error_message="The search could not be run. Please try again.",
    )
    db.add(run)
    search = db.get(SavedSearch, search_id)
    if search is not None:
        search.last_run_at = run.finished_at
        search.last_run_status = LastRunStatus.FAILED
    db.commit()
    return run


def lock_search(db: Session, workspace_id: uuid.UUID, search_id: uuid.UUID) -> SavedSearch | None:
    """Row lock so one search never runs twice at once. None if another transaction holds it."""
    return db.scalar(
        select(SavedSearch)
        .where(SavedSearch.id == search_id, SavedSearch.workspace_id == workspace_id)
        .with_for_update(skip_locked=True)
    )


def run_search(db: Session, ctx: RequestContext, search_id: uuid.UUID) -> SavedSearchRunOut:
    ctx.require(Permission.SAVED_SEARCHES_WRITE)
    get_search(db, ctx, search_id)  # 404 before trying to lock
    search = lock_search(db, ctx.workspace.id, search_id)
    if search is None:
        raise RunInProgress()
    try:
        run = execute_run(db, search, RunTrigger.MANUAL)
    except Exception:
        logger.exception("Saved search run failed", extra={"saved_search_id": str(search_id)})
        db.rollback()
        run = _record_failure(db, search_id, ctx.workspace.id, RunTrigger.MANUAL)
    return SavedSearchRunOut.model_validate(run)


def list_runs(db: Session, ctx: RequestContext, search_id: uuid.UUID, *, page: int, page_size: int):
    search = get_search(db, ctx, search_id)
    stmt = select(SavedSearchRun).where(SavedSearchRun.saved_search_id == search.id)
    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = db.scalars(
        stmt.order_by(SavedSearchRun.started_at.desc(), SavedSearchRun.id.desc())
        .limit(page_size)
        .offset((page - 1) * page_size)
    )
    return _page([SavedSearchRunOut.model_validate(row) for row in rows], total, page, page_size)


def list_results(
    db: Session, ctx: RequestContext, search_id: uuid.UUID, *, sort: str, order: str, page: int, page_size: int
) -> Page[SavedSearchResult]:
    """Current matches for the stored criteria (live, not a snapshot), flagging leads new in the latest run."""
    search = get_search(db, ctx, search_id)
    filters = criteria_of(search).to_filters()
    stmt = repo.lead_query(ctx.workspace.id, filters)
    is_new = (
        select(SavedSearchMatch.id)
        .where(
            SavedSearchMatch.saved_search_id == search.id,
            SavedSearchMatch.lead_id == Lead.id,
            SavedSearchMatch.first_matched_run_id == search.last_run_id,
        )
        .exists()
        if search.last_run_id
        else None
    )
    if is_new is not None:
        stmt = stmt.add_columns(is_new.label("is_new"))
    rows, total = repo.list_query(db, stmt, sort=sort, order=order, page=page, page_size=page_size)
    items = [
        SavedSearchResult(
            **lead_summary(row[0], row[1], row[2]).model_dump(), is_new=bool(row[3]) if is_new is not None else False
        )
        for row in rows
    ]
    return _page(items, total, page, page_size)
