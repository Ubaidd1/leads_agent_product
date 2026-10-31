import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import Field

from app.models.enums import HiringIntent, LastRunStatus, RunStatus, RunTrigger, SearchFrequency
from app.repositories.catalog import LeadFilters
from app.schemas.common import CamelModel, RequestModel
from app.schemas.constants import Region
from app.schemas.leads import LeadSummary

CRITERIA_VERSION = 1
Term = Annotated[str, Field(min_length=1, max_length=100)]


class SearchCriteria(RequestModel):
    """Lead filters shared by GET /leads, saved searches, alerts, exports and analytics.

    Stored as JSON on saved searches with ``criteriaVersion`` so the format can evolve.
    Unknown keys are rejected (422).
    """

    criteria_version: Literal[1] = CRITERIA_VERSION
    q: Annotated[str | None, Field(max_length=200)] = None
    service_types: Annotated[list[Term], Field(max_length=20)] = []
    technologies: Annotated[list[Term], Field(max_length=50)] = []
    technology_match: Literal["any", "all"] = "any"
    intents: Annotated[list[HiringIntent], Field(max_length=3)] = []
    regions: Annotated[list[Region], Field(max_length=8)] = []
    freshness_days: Annotated[int | None, Field(ge=1, le=365)] = None
    min_score: Annotated[int | None, Field(ge=0, le=100)] = None

    def to_filters(self, **extra) -> LeadFilters:
        return LeadFilters(
            q=self.q or None,
            service_types=list(self.service_types),
            technologies=list(self.technologies),
            technology_match=self.technology_match,
            intents=list(self.intents),
            regions=list(self.regions),
            freshness_days=self.freshness_days,
            min_score=self.min_score,
            **extra,
        )

    def stored(self) -> dict:
        return self.model_dump(by_alias=True, mode="json")


class SchedulingState(CamelModel):
    # False until the Phase 3 scheduler runs saved searches automatically.
    enabled: bool


class SavedSearchCreate(RequestModel):
    name: Annotated[str, Field(min_length=1, max_length=200)]
    criteria: SearchCriteria = SearchCriteria()
    frequency: SearchFrequency = SearchFrequency.MANUAL
    is_active: bool = True
    notify_in_app: bool = True
    notify_email: bool = False


class SavedSearchUpdate(RequestModel):
    name: Annotated[str | None, Field(min_length=1, max_length=200)] = None
    criteria: SearchCriteria | None = None
    frequency: SearchFrequency | None = None
    is_active: bool | None = None
    notify_in_app: bool | None = None
    notify_email: bool | None = None


class SavedSearchRunOut(CamelModel):
    id: uuid.UUID
    trigger: RunTrigger
    status: RunStatus
    started_at: datetime
    finished_at: datetime | None
    result_count: int | None
    new_count: int | None
    truncated: bool
    error_code: str | None
    error_message: str | None


class SavedSearchOut(CamelModel):
    id: uuid.UUID
    name: str
    criteria: dict
    frequency: SearchFrequency
    is_active: bool
    notify_in_app: bool
    notify_email: bool
    notifications_paused: bool
    last_run_at: datetime | None
    next_run_at: datetime | None
    last_run_status: LastRunStatus
    last_result_count: int | None
    last_new_count: int | None
    created_by_user_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime
    scheduling: SchedulingState
    # Whether the caller may edit, delete or pause this search (owner of the search, or admin+).
    can_edit: bool


class SavedSearchDetail(SavedSearchOut):
    latest_run: SavedSearchRunOut | None


class SavedSearchResult(LeadSummary):
    # First matched by the most recent successful run.
    is_new: bool


class LeadCount(CamelModel):
    total: int
