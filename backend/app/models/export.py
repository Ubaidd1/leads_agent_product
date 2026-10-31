import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, UniqueConstraint, Uuid, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDPrimaryKey
from app.models.enums import ExportFormat, ExportSelection, ExportStatus, str_enum


class ExportJob(UUIDPrimaryKey, Base):
    """A requested lead export. Rows are re-resolved for the workspace when the file is generated."""

    __tablename__ = "export_jobs"
    __table_args__ = (
        UniqueConstraint("workspace_id", "idempotency_key"),
        Index("ix_export_jobs_workspace_created", "workspace_id", "created_at"),
    )

    workspace_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"))
    requested_by_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    format: Mapped[ExportFormat] = mapped_column(str_enum(ExportFormat, "export_format"))
    selection: Mapped[ExportSelection] = mapped_column(str_enum(ExportSelection, "export_selection"))
    lead_ids: Mapped[list[uuid.UUID] | None] = mapped_column(ARRAY(Uuid))
    filters: Mapped[dict | None] = mapped_column(JSONB)
    status: Mapped[ExportStatus] = mapped_column(str_enum(ExportStatus, "export_status"), default=ExportStatus.QUEUED)
    record_count: Mapped[int | None] = mapped_column(Integer)
    # Requested IDs that were not visible to the workspace at generation time and were left out.
    skipped_count: Mapped[int | None] = mapped_column(Integer)
    file_name: Mapped[str | None] = mapped_column(String(200))
    file_size: Mapped[int | None] = mapped_column(Integer)
    sha256: Mapped[str | None] = mapped_column(String(64))
    storage_key: Mapped[str | None] = mapped_column(String(500))
    error_code: Mapped[str | None] = mapped_column(String(50))
    idempotency_key: Mapped[str | None] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
