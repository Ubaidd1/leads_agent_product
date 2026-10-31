import uuid
from datetime import datetime
from typing import Annotated

from pydantic import Field, model_validator

from app.models.enums import ExportFormat, ExportSelection, ExportStatus
from app.schemas.common import CamelModel, RequestModel
from app.schemas.search import SearchCriteria

MAX_LEAD_IDS = 5_000


class ExportCreate(RequestModel):
    format: ExportFormat
    # Exactly one of lead_ids / filters.
    lead_ids: Annotated[list[uuid.UUID] | None, Field(min_length=1, max_length=MAX_LEAD_IDS)] = None
    filters: SearchCriteria | None = None
    # Lets a retried or double-clicked request return the same export instead of creating another.
    idempotency_key: Annotated[str | None, Field(min_length=8, max_length=100)] = None

    @model_validator(mode="after")
    def one_selection(self):
        if (self.lead_ids is None) == (self.filters is None):
            raise ValueError("Provide exactly one of leadIds or filters")
        return self


class ExportOut(CamelModel):
    id: uuid.UUID
    format: ExportFormat
    selection: ExportSelection
    filters: dict | None
    requested_count: int | None
    status: ExportStatus
    record_count: int | None
    skipped_count: int | None
    file_name: str | None
    file_size: int | None
    error_code: str | None
    error_message: str | None
    requested_by_name: str | None
    created_at: datetime
    finished_at: datetime | None
    expires_at: datetime | None
