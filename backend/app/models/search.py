import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, Timestamps, UUIDPrimaryKey
from app.models.enums import LastRunStatus, RunStatus, RunTrigger, SearchFrequency, str_enum


class SavedSearch(UUIDPrimaryKey, Timestamps, Base):
    """Reusable lead criteria owned by a workspace. ``criteria`` is validated by schemas.search.SearchCriteria."""

    __tablename__ = "saved_searches"
    __table_args__ = (UniqueConstraint("workspace_id", "name"),)

    workspace_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), index=True)
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    name: Mapped[str] = mapped_column(String(200))
    criteria: Mapped[dict] = mapped_column(JSONB)
    frequency: Mapped[SearchFrequency] = mapped_column(
        str_enum(SearchFrequency, "search_frequency"), default=SearchFrequency.MANUAL
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    notify_in_app: Mapped[bool] = mapped_column(Boolean, default=True)
    notify_email: Mapped[bool] = mapped_column(Boolean, default=False)
    # "Pause" on the Alerts page: stops new alerts without losing the channel choices above.
    notifications_paused: Mapped[bool] = mapped_column(Boolean, default=False)
    last_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Only meaningful once the scheduler exists; stays NULL until then.
    next_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    last_run_status: Mapped[LastRunStatus] = mapped_column(
        str_enum(LastRunStatus, "last_run_status"), default=LastRunStatus.NEVER
    )
    last_run_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("saved_search_runs.id", ondelete="SET NULL", use_alter=True)
    )
    # NULL until the search has actually run; never zero-filled.
    last_result_count: Mapped[int | None] = mapped_column(Integer)
    last_new_count: Mapped[int | None] = mapped_column(Integer)


class SavedSearchRun(UUIDPrimaryKey, Base):
    __tablename__ = "saved_search_runs"
    __table_args__ = (Index("ix_saved_search_runs_search_started", "saved_search_id", "started_at"),)

    saved_search_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("saved_searches.id", ondelete="CASCADE"))
    workspace_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), index=True)
    trigger: Mapped[RunTrigger] = mapped_column(str_enum(RunTrigger, "run_trigger"))
    status: Mapped[RunStatus] = mapped_column(str_enum(RunStatus, "run_status"))
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    result_count: Mapped[int | None] = mapped_column(Integer)
    new_count: Mapped[int | None] = mapped_column(Integer)
    # True when more leads matched than the per-run cap and only the first ones were recorded.
    truncated: Mapped[bool] = mapped_column(Boolean, default=False)
    error_code: Mapped[str | None] = mapped_column(String(50))
    # Safe, user-facing text only; never internal exception details.
    error_message: Mapped[str | None] = mapped_column(String(500))


class SavedSearchMatch(Base):
    """Every lead a saved search has ever matched; how a run works out which matches are new."""

    __tablename__ = "saved_search_matches"
    __table_args__ = (UniqueConstraint("saved_search_id", "lead_id"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    saved_search_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("saved_searches.id", ondelete="CASCADE"))
    lead_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("leads.id", ondelete="CASCADE"), index=True)
    first_matched_run_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("saved_search_runs.id", ondelete="SET NULL")
    )
    first_matched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
