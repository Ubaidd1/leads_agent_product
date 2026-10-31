import uuid

import pytest
from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.models import SavedSearch, User, Workspace
from app.models.enums import Role
from app.services import saved_searches as search_service

CRITERIA = {"technologies": ["React"], "minScore": 80}


@pytest.fixture
def setup(signed_in, make_company, make_lead):
    client, user, workspace = signed_in("owner@example.com")
    company = make_company(name="NovaStack", slug="novastack")
    make_lead(company, title="React Engineer", technologies=["React"], score=90)
    make_lead(company, title="React Junior", technologies=["React"], score=70)
    make_lead(company, title="Python Engineer", technologies=["Python"], score=95)
    return client, user, workspace, company


def create(client, name="React watch", **body):
    response = client.post("/api/v1/saved-searches", json={"name": name, "criteria": CRITERIA, **body})
    assert response.status_code == 201, response.text
    return response.json()


def test_crud_and_counts_are_null_before_first_run(setup):
    client, user, *_ = setup
    created = create(client, frequency="daily")
    assert created["lastResultCount"] is None and created["lastNewCount"] is None
    assert created["lastRunStatus"] == "never"
    assert created["criteria"] == {
        **CRITERIA,
        "criteriaVersion": 1,
        "q": None,
        "serviceTypes": [],
        "technologyMatch": "any",
        "intents": [],
        "regions": [],
        "freshnessDays": None,
    }
    # Scheduling is honest about not running yet.
    assert created["scheduling"] == {"enabled": False} and created["nextRunAt"] is None
    assert created["canEdit"] is True and created["createdByUserId"] == str(user.id)

    detail = client.get(f"/api/v1/saved-searches/{created['id']}").json()
    assert detail["latestRun"] is None

    updated = client.patch(f"/api/v1/saved-searches/{created['id']}", json={"name": "Renamed", "isActive": False})
    assert updated.status_code == 200 and updated.json()["name"] == "Renamed" and not updated.json()["isActive"]

    listed = client.get("/api/v1/saved-searches", params={"active": "false"}).json()
    assert [item["name"] for item in listed["items"]] == ["Renamed"]

    assert client.delete(f"/api/v1/saved-searches/{created['id']}").status_code == 204
    assert client.get(f"/api/v1/saved-searches/{created['id']}").status_code == 404


def test_duplicate_name_conflicts_and_duplicate_endpoint_makes_unique_names(setup):
    client, *_ = setup
    first = create(client)
    assert client.post("/api/v1/saved-searches", json={"name": "React watch"}).status_code == 409
    copy1 = client.post(f"/api/v1/saved-searches/{first['id']}/duplicate").json()
    copy2 = client.post(f"/api/v1/saved-searches/{first['id']}/duplicate").json()
    assert copy1["name"] == "React watch (copy)" and copy2["name"] == "React watch (copy 2)"
    assert copy1["lastResultCount"] is None and copy1["criteria"] == first["criteria"]


@pytest.mark.parametrize(
    "criteria",
    [{"regions": ["mars"]}, {"minScore": 101}, {"unexpected": True}, {"intents": ["certain"]}, {"freshnessDays": 0}],
)
def test_criteria_validation(setup, criteria):
    client, *_ = setup
    response = client.post("/api/v1/saved-searches", json={"name": "Bad", "criteria": criteria})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_runs_count_new_matches(setup, make_lead):
    client, _, _, company = setup
    search = create(client)
    run = client.post(f"/api/v1/saved-searches/{search['id']}/run").json()
    assert run["status"] == "succeeded" and run["resultCount"] == 1 and run["newCount"] == 1

    again = client.post(f"/api/v1/saved-searches/{search['id']}/run").json()
    assert again["resultCount"] == 1 and again["newCount"] == 0

    make_lead(company, title="React Lead", technologies=["React", "AWS"], score=85)
    third = client.post(f"/api/v1/saved-searches/{search['id']}/run").json()
    assert third["resultCount"] == 2 and third["newCount"] == 1

    detail = client.get(f"/api/v1/saved-searches/{search['id']}").json()
    assert detail["lastResultCount"] == 2 and detail["lastNewCount"] == 1 and detail["latestRun"]["id"] == third["id"]
    runs = client.get(f"/api/v1/saved-searches/{search['id']}/runs").json()
    assert runs["total"] == 3 and runs["items"][0]["id"] == third["id"]

    results = client.get(f"/api/v1/saved-searches/{search['id']}/results").json()
    flags = {item["jobTitle"]: item["isNew"] for item in results["items"]}
    assert flags == {"React Engineer": False, "React Lead": True}


def test_changing_criteria_resets_match_history(setup):
    client, *_ = setup
    search = create(client)
    client.post(f"/api/v1/saved-searches/{search['id']}/run")
    updated = client.patch(f"/api/v1/saved-searches/{search['id']}", json={"criteria": {"technologies": ["Python"]}})
    assert updated.json()["lastResultCount"] is None and updated.json()["lastRunStatus"] == "never"
    run = client.post(f"/api/v1/saved-searches/{search['id']}/run").json()
    assert run["resultCount"] == 1 and run["newCount"] == 1


def test_lead_count_matches_lead_list(setup):
    client, *_ = setup
    params = {"technology": "React", "minScore": 75}
    assert client.get("/api/v1/leads/count", params=params).json() == {"total": 1}
    assert client.get("/api/v1/leads", params=params).json()["total"] == 1
    assert client.get("/api/v1/leads/count", params={"region": "mars"}).status_code == 422


def test_workspace_isolation(setup, signed_in):
    client, *_ = setup
    search = create(client)
    other, *_ = signed_in("other@example.com")
    for method, path in [
        ("get", ""),
        ("patch", ""),
        ("delete", ""),
        ("post", "/run"),
        ("get", "/results"),
        ("get", "/runs"),
        ("post", "/duplicate"),
    ]:
        kwargs = {"json": {"name": "x"}} if method == "patch" else {}
        response = getattr(other, method)(f"/api/v1/saved-searches/{search['id']}{path}", **kwargs)
        assert response.status_code == 404, (method, path, response.status_code)
    assert other.get("/api/v1/saved-searches").json()["total"] == 0


def test_members_cannot_edit_others_searches(setup, make_client, make_user):
    client, _, workspace, _ = setup
    owners = create(client)
    make_user("member@example.com", workspace=workspace, role=Role.MEMBER)
    from tests.conftest import login

    member = make_client()
    login(member, "member@example.com")
    assert member.get(f"/api/v1/saved-searches/{owners['id']}").json()["canEdit"] is False
    assert member.patch(f"/api/v1/saved-searches/{owners['id']}", json={"name": "Mine"}).status_code == 403
    assert member.delete(f"/api/v1/saved-searches/{owners['id']}").status_code == 403
    # Members can still run it, and fully manage their own searches.
    assert member.post(f"/api/v1/saved-searches/{owners['id']}/run").status_code == 200
    own = create(member, name="Member search")
    assert member.patch(f"/api/v1/saved-searches/{own['id']}", json={"name": "Member renamed"}).status_code == 200
    # Admins/owners can edit anyone's search.
    assert client.patch(f"/api/v1/saved-searches/{own['id']}", json={"isActive": False}).status_code == 200


def test_row_lock_prevents_concurrent_runs(engine):
    """Uses committed data and two real connections: a locked search is skipped (-> 409)."""
    with Session(engine) as setup_session:
        user = User(email=f"lock-{uuid.uuid4().hex}@example.com", password_hash="x", full_name="Lock")
        workspace = Workspace(name="Lock workspace")
        setup_session.add_all([user, workspace])
        setup_session.flush()
        search = SavedSearch(workspace_id=workspace.id, created_by_user_id=user.id, name="Locked", criteria={})
        setup_session.add(search)
        setup_session.commit()
        ids = (workspace.id, search.id, user.id)
    try:
        with Session(engine) as holder, Session(engine) as contender:
            assert search_service.lock_search(holder, ids[0], ids[1]) is not None
            assert search_service.lock_search(contender, ids[0], ids[1]) is None
            holder.rollback()
            assert search_service.lock_search(contender, ids[0], ids[1]) is not None
            contender.rollback()
    finally:
        with Session(engine) as cleanup:
            cleanup.execute(delete(Workspace).where(Workspace.id == ids[0]))
            cleanup.execute(delete(User).where(User.id == ids[2]))
            cleanup.commit()


def test_run_in_progress_maps_to_409(setup, monkeypatch):
    client, *_ = setup
    search = create(client)
    monkeypatch.setattr(search_service, "lock_search", lambda *args: None)
    response = client.post(f"/api/v1/saved-searches/{search['id']}/run")
    assert response.status_code == 409 and response.json()["error"]["code"] == "RUN_IN_PROGRESS"
