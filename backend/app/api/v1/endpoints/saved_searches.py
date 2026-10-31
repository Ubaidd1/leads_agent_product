import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, status

from app.api.deps import DB, Ctx, Paging
from app.repositories.catalog import LEAD_SORTS, SortOrder
from app.schemas.common import Page
from app.schemas.search import (
    SavedSearchCreate,
    SavedSearchDetail,
    SavedSearchOut,
    SavedSearchResult,
    SavedSearchRunOut,
    SavedSearchUpdate,
)
from app.services import saved_searches as service

router = APIRouter(prefix="/saved-searches", tags=["saved searches"])

SearchSort = Literal[tuple(service.SORTS)]
LeadSort = Literal[tuple(LEAD_SORTS)]


@router.get("", response_model=Page[SavedSearchOut])
def list_saved_searches(
    db: DB, ctx: Ctx, paging: Annotated[Paging, Depends()], active: bool | None = None, sort: SearchSort = "updatedAt"
):
    return service.list_searches(db, ctx, active=active, sort=sort, page=paging.page, page_size=paging.page_size)


@router.post("", response_model=SavedSearchOut, status_code=status.HTTP_201_CREATED)
def create_saved_search(body: SavedSearchCreate, db: DB, ctx: Ctx):
    return service.create_search(db, ctx, body)


@router.get("/{search_id}", response_model=SavedSearchDetail)
def get_saved_search(search_id: uuid.UUID, db: DB, ctx: Ctx):
    return service.get_detail(db, ctx, search_id)


@router.patch("/{search_id}", response_model=SavedSearchOut)
def update_saved_search(search_id: uuid.UUID, body: SavedSearchUpdate, db: DB, ctx: Ctx):
    return service.update_search(db, ctx, search_id, body)


@router.delete("/{search_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_saved_search(search_id: uuid.UUID, db: DB, ctx: Ctx):
    service.delete_search(db, ctx, search_id)


@router.post("/{search_id}/duplicate", response_model=SavedSearchOut, status_code=status.HTTP_201_CREATED)
def duplicate_saved_search(search_id: uuid.UUID, db: DB, ctx: Ctx):
    return service.duplicate_search(db, ctx, search_id)


@router.post("/{search_id}/run", response_model=SavedSearchRunOut)
def run_saved_search(search_id: uuid.UUID, db: DB, ctx: Ctx):
    """Runs now, inside the request. Returns the finished run (succeeded or failed)."""
    return service.run_search(db, ctx, search_id)


@router.get("/{search_id}/runs", response_model=Page[SavedSearchRunOut])
def list_saved_search_runs(search_id: uuid.UUID, db: DB, ctx: Ctx, paging: Annotated[Paging, Depends()]):
    return service.list_runs(db, ctx, search_id, page=paging.page, page_size=paging.page_size)


@router.get("/{search_id}/results", response_model=Page[SavedSearchResult])
def list_saved_search_results(
    search_id: uuid.UUID,
    db: DB,
    ctx: Ctx,
    paging: Annotated[Paging, Depends()],
    sort: LeadSort = "score",
    order: SortOrder = "desc",
):
    return service.list_results(
        db, ctx, search_id, sort=sort, order=order, page=paging.page, page_size=paging.page_size
    )
