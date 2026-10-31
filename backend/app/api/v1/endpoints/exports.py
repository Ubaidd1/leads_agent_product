import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Response, status
from fastapi.responses import FileResponse

from app.api.deps import DB, Ctx, Paging
from app.schemas.common import Page
from app.schemas.exports import ExportCreate, ExportOut
from app.services import exports as service

router = APIRouter(prefix="/exports", tags=["exports"])


@router.post("", response_model=ExportOut, status_code=status.HTTP_201_CREATED)
def create_export(body: ExportCreate, db: DB, ctx: Ctx, response: Response):
    """Up to 1,000 rows are generated during the request (201, succeeded); larger exports are queued (202)."""
    export, finished = service.create_export(db, ctx, body)
    if not finished:
        response.status_code = status.HTTP_202_ACCEPTED
    return export


@router.get("", response_model=Page[ExportOut])
def list_exports(db: DB, ctx: Ctx, paging: Annotated[Paging, Depends()]):
    return service.list_exports(db, ctx, page=paging.page, page_size=paging.page_size)


@router.get("/{export_id}", response_model=ExportOut)
def get_export(export_id: uuid.UUID, db: DB, ctx: Ctx):
    return service.get_export(db, ctx, export_id)


@router.get("/{export_id}/download", response_class=FileResponse)
def download_export(export_id: uuid.UUID, db: DB, ctx: Ctx):
    path, export = service.open_download(db, ctx, export_id)
    return FileResponse(path, media_type=service.CONTENT_TYPES[export.format], filename=export.file_name)
