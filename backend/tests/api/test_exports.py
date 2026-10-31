import csv
import io
from datetime import timedelta

import pytest
from openpyxl import load_workbook

from app.models import ExportJob
from app.models.enums import ExportStatus, JobStatus
from app.services import exports as export_service
from app.tasks import queue
from app.utils.time import utcnow


@pytest.fixture(autouse=True)
def tmp_storage(tmp_path, monkeypatch):
    monkeypatch.setattr(export_service, "storage", export_service.LocalStorage(tmp_path))


@pytest.fixture
def catalog(signed_in, make_company, make_lead):
    client, _, workspace = signed_in("exporter@example.com")
    company = make_company(name="=HYPERLINK(evil)", slug="evil", domain="evil.example")
    leads = [
        make_lead(company, title="React Engineer", technologies=["React"], score=90),
        make_lead(company, title="@SUM(1+1)", technologies=["Python"], score=80),
    ]
    return client, workspace, company, leads


def create(client, **body):
    return client.post("/api/v1/exports", json={"format": "csv", **body})


def download_csv(client, export_id):
    response = client.get(f"/api/v1/exports/{export_id}/download")
    assert response.status_code == 200, response.text
    assert response.content.startswith("﻿".encode())  # BOM for Excel
    return list(csv.reader(io.StringIO(response.content.decode("utf-8-sig"))))


def test_small_csv_export_is_generated_inline_with_escaping(catalog):
    client, *_ = catalog
    response = create(client, filters={"technologies": ["React", "Python"]})
    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "succeeded" and body["recordCount"] == 2 and body["expiresAt"]
    rows = download_csv(client, body["id"])
    assert rows[0] == export_service.COLUMNS
    by_title = {row[2]: row for row in rows[1:]}
    assert set(by_title) == {"React Engineer", "'@SUM(1+1)"}  # formula characters escaped
    assert by_title["React Engineer"][0] == "'=HYPERLINK(evil)" and by_title["React Engineer"][3] == "90"
    history = client.get("/api/v1/exports").json()
    assert history["total"] == 1 and history["items"][0]["requestedByName"] == "Test User"


def test_xlsx_export(catalog):
    client, _, _, leads = catalog
    body = create(client, format="xlsx", leadIds=[str(leads[0].id)]).json()
    response = client.get(f"/api/v1/exports/{body['id']}/download")
    assert response.headers["content-type"].startswith("application/vnd.openxmlformats")
    sheet = load_workbook(io.BytesIO(response.content)).active
    rows = list(sheet.values)
    assert list(rows[0]) == export_service.COLUMNS and rows[1][2] == "React Engineer" and len(rows) == 2


def test_ids_from_other_workspaces_are_dropped_and_counted(catalog, signed_in, make_company, make_lead):
    client, _, _, leads = catalog
    _, _, other_ws = signed_in("rival@example.com")
    secret = make_lead(make_company(workspace_id=other_ws.id, slug="secret"), title="Secret role")
    body = create(client, leadIds=[str(leads[0].id), str(secret.id)]).json()
    assert body["recordCount"] == 1 and body["skippedCount"] == 1
    titles = [row[2] for row in download_csv(client, body["id"])[1:]]
    assert titles == ["React Engineer"]


def test_other_workspace_cannot_see_or_download(catalog, signed_in):
    client, *_ = catalog
    export_id = create(client, filters={}).json()["id"]
    other, *_ = signed_in("snoop@example.com")
    assert other.get(f"/api/v1/exports/{export_id}").status_code == 404
    assert other.get(f"/api/v1/exports/{export_id}/download").status_code == 404
    assert other.get("/api/v1/exports").json()["total"] == 0


def test_expired_export_returns_410(catalog, db):
    client, *_ = catalog
    export_id = create(client, filters={}).json()["id"]
    export = db.get(ExportJob, export_id)
    export.expires_at = utcnow() - timedelta(minutes=1)
    db.commit()
    response = client.get(f"/api/v1/exports/{export_id}/download")
    assert response.status_code == 410 and response.json()["error"]["code"] == "EXPORT_EXPIRED"
    assert export_service.expire_old(db) == 1
    assert db.get(ExportJob, export_id).status == ExportStatus.EXPIRED


def test_large_export_is_queued_until_the_worker_finishes(catalog, db, monkeypatch):
    client, *_ = catalog
    monkeypatch.setattr(export_service, "INLINE_MAX_ROWS", 1)
    response = create(client, filters={})
    assert response.status_code == 202
    body = response.json()
    assert body["status"] == "queued" and body["recordCount"] is None
    assert client.get(f"/api/v1/exports/{body['id']}/download").status_code == 409

    job = queue.claim(db, "test-worker")
    assert job.kind == "export.generate" and job.workspace_id is not None
    assert queue.run_one(db, job) == JobStatus.SUCCEEDED
    done = client.get(f"/api/v1/exports/{body['id']}").json()
    assert done["status"] == "succeeded" and done["recordCount"] == 2
    assert len(download_csv(client, body["id"])) == 3


def test_row_limit_and_validation(catalog, monkeypatch):
    client, _, _, leads = catalog
    monkeypatch.setattr(export_service, "MAX_ROWS", 1)
    too_big = create(client, filters={})
    assert too_big.status_code == 422 and too_big.json()["error"]["code"] == "EXPORT_TOO_LARGE"
    assert create(client).status_code == 422  # neither leadIds nor filters
    assert create(client, filters={}, leadIds=[str(leads[0].id)]).status_code == 422  # both
    assert create(client, format="pdf", filters={}).status_code == 422


def test_idempotency_key_returns_the_same_export(catalog):
    client, *_ = catalog
    first = create(client, filters={}, idempotencyKey="click-123456").json()
    second = create(client, filters={}, idempotencyKey="click-123456").json()
    assert first["id"] == second["id"]
    assert client.get("/api/v1/exports").json()["total"] == 1
