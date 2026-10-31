"""Server-side lead exports (CSV / XLSX).

Rows are always re-resolved through ``lead_query`` for the requesting workspace when the file is
generated, so an export can never contain another workspace's records. Requested IDs that are no
longer visible are dropped and counted in ``skipped_count``. A job is marked ``succeeded`` only after
the file is written and its hash recorded.
"""

import csv
import hashlib
import io
import math
import uuid
from datetime import timedelta
from pathlib import Path

from openpyxl import Workbook
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.context import RequestContext
from app.core.exceptions import AppError, Conflict, NotFound, ValidationFailed
from app.core.permissions import Permission
from app.models import Company, ExportJob, Lead, LeadScore, LeadSource, User
from app.models.enums import ExportFormat, ExportSelection, ExportStatus
from app.repositories import catalog as repo
from app.repositories.catalog import LeadFilters
from app.schemas.common import Page
from app.schemas.exports import ExportCreate, ExportOut
from app.schemas.search import SearchCriteria
from app.services import audit
from app.tasks import queue
from app.utils.time import utcnow

settings = get_settings()

MAX_ROWS = 10_000  # decision D3.3
INLINE_MAX_ROWS = 1_000
RETENTION = timedelta(days=7)  # decision D3.2
STORAGE_ROOT = Path(__file__).resolve().parents[2] / "storage" / "exports"
FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")
CONTENT_TYPES = {
    ExportFormat.CSV: "text/csv; charset=utf-8",
    ExportFormat.XLSX: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}
COLUMNS = [
    "Company",
    "Company domain",
    "Job title",
    "Lead score",
    "Score version",
    "Score breakdown",
    "Hiring intent",
    "Service type",
    "Seniority",
    "Technologies",
    "Remote fit",
    "Regions",
    "Salary min",
    "Salary max",
    "Salary currency",
    "Relevant roles",
    "Open roles",
    "Posted at",
    "First seen at",
    "Last verified at",
    "Verification status",
    "Canonical URL",
    "Source count",
    "Source URLs",
    "Lead ID",
]


class ExportExpired(AppError):
    status_code = 410
    code = "EXPORT_EXPIRED"
    message = "This export has expired. Create a new one."


class LocalStorage:
    """Files under storage/exports/<workspace_id>/, never served directly; downloads go through the API."""

    def __init__(self, root: Path = STORAGE_ROOT):
        self.root = root

    def save(self, key: str, data: bytes) -> None:
        path = self.root / key
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(path.suffix + ".tmp")
        tmp.write_bytes(data)
        tmp.replace(path)  # atomic: a reader never sees a half-written file

    def path(self, key: str) -> Path:
        return self.root / key

    def delete(self, key: str) -> None:
        (self.root / key).unlink(missing_ok=True)


storage = LocalStorage()


# --- row resolution -----------------------------------------------------------------


def _scope(export: ExportJob) -> LeadFilters:
    if export.selection == ExportSelection.IDS:
        # Explicitly chosen leads stay exportable even if closed (they are still reachable by id).
        return LeadFilters(include_closed=True)
    return SearchCriteria.model_validate(export.filters or {}).to_filters()


def resolve_query(export: ExportJob):
    stmt = repo.lead_query(export.workspace_id, _scope(export))
    if export.selection == ExportSelection.IDS:
        stmt = stmt.where(Lead.id.in_(export.lead_ids or []))
    return stmt


def count_rows(db: Session, export: ExportJob) -> int:
    return db.scalar(select(func.count()).select_from(resolve_query(export).with_only_columns(Lead.id).subquery()))


def escape_cell(value) -> object:
    """Prevents formula injection when the file is opened in a spreadsheet."""
    if isinstance(value, str) and value.startswith(FORMULA_PREFIXES):
        return "'" + value
    return value


def _iso(value) -> str:
    return value.isoformat() if value else ""


def build_rows(db: Session, export: ExportJob) -> list[list]:
    rows = db.execute(resolve_query(export).order_by(Lead.score.desc().nulls_last(), Lead.id).limit(MAX_ROWS)).all()
    lead_ids = [lead.id for lead, _, _ in rows]
    sources: dict[uuid.UUID, list[LeadSource]] = {}
    scores: dict[uuid.UUID, LeadScore] = {}
    if lead_ids:
        for source in db.scalars(select(LeadSource).where(LeadSource.lead_id.in_(lead_ids))):
            sources.setdefault(source.lead_id, []).append(source)
        latest = (
            select(LeadScore)
            .where(LeadScore.lead_id.in_(lead_ids))
            .distinct(LeadScore.lead_id)
            .order_by(LeadScore.lead_id, LeadScore.calculated_at.desc())
        )
        scores = {score.lead_id: score for score in db.scalars(latest)}
    out = []
    for lead, company, _ in rows:
        lead: Lead
        company: Company
        score = scores.get(lead.id)
        lead_sources = sources.get(lead.id, [])
        breakdown = "; ".join(f"{k}={v}" for k, v in (score.components if score else {}).items())
        out.append(
            [
                company.name,
                company.domain or "",
                lead.title,
                lead.score,
                lead.score_version or "",
                breakdown,
                lead.hiring_intent.value if lead.hiring_intent else "",
                lead.service_type or "",
                lead.seniority or "",
                ", ".join(lead.technologies),
                lead.remote_policy or "",
                ", ".join(lead.regions),
                lead.salary_min,
                lead.salary_max,
                lead.salary_currency or "",
                company.relevant_roles_count,
                company.open_roles_count,
                _iso(lead.posted_at),
                _iso(lead.first_seen_at),
                _iso(lead.last_verified_at),
                lead.verification_status.value,
                lead.canonical_url or "",
                len(lead_sources),
                " | ".join(s.source_url for s in lead_sources if s.source_url),
                str(lead.id),
            ]
        )
    return out


def render(fmt: ExportFormat, rows: list[list]) -> bytes:
    if fmt == ExportFormat.CSV:
        buffer = io.StringIO()
        writer = csv.writer(buffer)
        writer.writerow(COLUMNS)
        for row in rows:
            writer.writerow(["" if v is None else escape_cell(v) for v in row])
        return ("﻿" + buffer.getvalue()).encode("utf-8")  # BOM so Excel detects UTF-8
    workbook = Workbook(write_only=True)
    sheet = workbook.create_sheet("Leads")
    sheet.append(COLUMNS)
    for row in rows:
        sheet.append([escape_cell(v) for v in row])
    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


def generate(db: Session, export: ExportJob) -> None:
    """Builds and stores the file, then marks the export succeeded. Idempotent for a finished export."""
    if export.status in (ExportStatus.SUCCEEDED, ExportStatus.EXPIRED):
        return
    export.status = ExportStatus.RUNNING
    export.started_at = export.started_at or utcnow()
    rows = build_rows(db, export)
    data = render(export.format, rows)
    key = f"{export.workspace_id}/{export.id}.{export.format.value}"
    storage.save(key, data)
    export.record_count = len(rows)
    if export.selection == ExportSelection.IDS:
        export.skipped_count = len(set(export.lead_ids or [])) - len(rows)
    export.storage_key = key
    export.file_size = len(data)
    export.sha256 = hashlib.sha256(data).hexdigest()
    export.file_name = f"hiring-leads-{utcnow():%Y-%m-%d}-{str(export.id)[:8]}.{export.format.value}"
    export.finished_at = utcnow()
    export.expires_at = export.finished_at + RETENTION
    export.status = ExportStatus.SUCCEEDED
    db.commit()


@queue.handler("export.generate")
def generate_job(db: Session, job) -> None:
    export = db.scalar(
        select(ExportJob).where(
            ExportJob.id == uuid.UUID(job.payload["exportId"]), ExportJob.workspace_id == job.workspace_id
        )
    )
    if export is None:
        raise queue.PermanentJobError("Export not found for this workspace")
    try:
        generate(db, export)
    except Exception:
        db.rollback()
        if job.attempts >= job.max_attempts:
            export = db.get(ExportJob, export.id)
            export.status = ExportStatus.FAILED
            export.error_code = "GENERATION_FAILED"
            export.finished_at = utcnow()
            db.commit()
        raise


# --- API ------------------------------------------------------------------------------


def to_out(export: ExportJob, requested_by_name: str | None = None) -> ExportOut:
    return ExportOut(
        id=export.id,
        format=export.format,
        selection=export.selection,
        filters=export.filters,
        requested_count=len(export.lead_ids or []) if export.selection == ExportSelection.IDS else None,
        status=export.status,
        record_count=export.record_count,
        skipped_count=export.skipped_count,
        file_name=export.file_name,
        file_size=export.file_size,
        error_code=export.error_code,
        error_message="The file could not be generated. Please try again."
        if export.status == ExportStatus.FAILED
        else None,
        requested_by_name=requested_by_name,
        created_at=export.created_at,
        finished_at=export.finished_at,
        expires_at=export.expires_at,
    )


def create_export(db: Session, ctx: RequestContext, body: ExportCreate) -> tuple[ExportOut, bool]:
    """Returns (export, finished_inline)."""
    ctx.require(Permission.EXPORTS_CREATE)
    if body.idempotency_key:
        existing = db.scalar(
            select(ExportJob).where(
                ExportJob.workspace_id == ctx.workspace.id, ExportJob.idempotency_key == body.idempotency_key
            )
        )
        if existing:
            return to_out(existing, ctx.user.full_name), existing.status == ExportStatus.SUCCEEDED
    export = ExportJob(
        id=uuid.uuid4(),
        workspace_id=ctx.workspace.id,
        requested_by_user_id=ctx.user.id,
        format=body.format,
        selection=ExportSelection.IDS if body.lead_ids is not None else ExportSelection.FILTERS,
        lead_ids=list(dict.fromkeys(body.lead_ids)) if body.lead_ids is not None else None,
        filters=body.filters.stored() if body.filters is not None else None,
        status=ExportStatus.QUEUED,
        idempotency_key=body.idempotency_key,
    )
    rows = count_rows(db, export)
    if rows > MAX_ROWS:
        raise ValidationFailed(
            f"This export would contain {rows:,} leads; the maximum is {MAX_ROWS:,}. Narrow the filters.",
            code="EXPORT_TOO_LARGE",
        )
    db.add(export)
    audit.record(
        db,
        "export.created",
        actor_user_id=ctx.user.id,
        workspace_id=ctx.workspace.id,
        target_type="export",
        target_id=export.id,
        details={"format": export.format.value, "selection": export.selection.value, "rows": rows},
    )
    try:
        db.flush()
    except IntegrityError as exc:  # same idempotency key submitted concurrently
        db.rollback()
        raise Conflict("This export request is already being processed.") from exc
    if rows <= INLINE_MAX_ROWS:
        generate(db, export)
        return to_out(export, ctx.user.full_name), True
    queue.enqueue(
        db,
        "export.generate",
        {"exportId": str(export.id)},
        workspace_id=ctx.workspace.id,
        idempotency_key=f"export:{export.id}",
    )
    db.commit()
    return to_out(export, ctx.user.full_name), False


def _get(db: Session, ctx: RequestContext, export_id: uuid.UUID) -> ExportJob:
    export = db.scalar(select(ExportJob).where(ExportJob.id == export_id, ExportJob.workspace_id == ctx.workspace.id))
    if export is None:
        raise NotFound()
    return export


def get_export(db: Session, ctx: RequestContext, export_id: uuid.UUID) -> ExportOut:
    export = _get(db, ctx, export_id)
    name = db.scalar(select(User.full_name).where(User.id == export.requested_by_user_id))
    return to_out(export, name)


def list_exports(db: Session, ctx: RequestContext, *, page: int, page_size: int) -> Page[ExportOut]:
    stmt = (
        select(ExportJob, User.full_name)
        .outerjoin(User, User.id == ExportJob.requested_by_user_id)
        .where(ExportJob.workspace_id == ctx.workspace.id)
    )
    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = db.execute(
        stmt.order_by(ExportJob.created_at.desc(), ExportJob.id.desc()).limit(page_size).offset((page - 1) * page_size)
    ).all()
    items = [to_out(export, name) for export, name in rows]
    return Page(items=items, total=total, page=page, page_size=page_size, total_pages=math.ceil(total / page_size))


def open_download(db: Session, ctx: RequestContext, export_id: uuid.UUID) -> tuple[Path, ExportJob]:
    export = _get(db, ctx, export_id)
    if export.status == ExportStatus.EXPIRED or (export.expires_at and export.expires_at <= utcnow()):
        raise ExportExpired()
    if export.status != ExportStatus.SUCCEEDED or not export.storage_key:
        raise Conflict("This export is not ready yet.", code="EXPORT_NOT_READY")
    path = storage.path(export.storage_key)
    if not path.exists():
        raise ExportExpired("The export file is no longer available. Create a new one.")
    audit.record(
        db,
        "export.downloaded",
        actor_user_id=ctx.user.id,
        workspace_id=ctx.workspace.id,
        target_type="export",
        target_id=export.id,
        ip_address=ctx.ip_address,
    )
    db.commit()
    return path, export


def expire_old(db: Session) -> int:
    """Daily retention job: delete files past expires_at and mark the exports expired."""
    expired = list(
        db.scalars(
            select(ExportJob).where(ExportJob.status == ExportStatus.SUCCEEDED, ExportJob.expires_at <= utcnow())
        )
    )
    for export in expired:
        if export.storage_key:
            storage.delete(export.storage_key)
        export.status = ExportStatus.EXPIRED
    db.commit()
    return len(expired)
