import pytest
from sqlalchemy import func, select

from app.models import Alert, NotificationDelivery
from app.models.enums import AlertType, DeliveryChannel, DeliveryStatus, Role
from app.services import alerts as alert_service
from tests.conftest import login


@pytest.fixture
def team(signed_in, make_client, make_user, make_company, make_lead):
    """Owner + member in one workspace, one matching lead, and a saved search that has run once."""
    owner, _, workspace = signed_in("owner@example.com")
    make_user("member@example.com", workspace=workspace, role=Role.MEMBER)
    member = make_client()
    login(member, "member@example.com")
    company = make_company(name="NovaStack", slug="novastack")
    make_lead(company, title="React Engineer", technologies=["React"])
    search = owner.post(
        "/api/v1/saved-searches",
        json={"name": "React", "criteria": {"technologies": ["React"]}, "notifyInApp": True, "notifyEmail": True},
    ).json()
    owner.post(f"/api/v1/saved-searches/{search['id']}/run")
    return owner, member, workspace, search, company


def alerts(client, **params):
    response = client.get("/api/v1/alerts", params=params)
    assert response.status_code == 200, response.text
    return response.json()


def test_run_with_new_matches_alerts_every_member(team):
    owner, member, _, search, _ = team
    for client in (owner, member):
        body = alerts(client)
        assert body["total"] == 1
        item = body["items"][0]
        assert item["title"] == "1 new lead matched “React”"
        assert item["type"] == "saved_search_matches" and item["savedSearchName"] == "React"
        assert item["isRead"] is False and item["canPause"] is True and item["isPaused"] is False
        assert item["payload"]["newCount"] == 1 and len(item["payload"]["leadIds"]) == 1
        assert client.get("/api/v1/alerts/unread-count").json() == {"count": 1}


def test_email_is_skipped_not_sent_without_a_provider(team, db):
    owner, *_ = team
    channels = {c["channel"]: c for c in alerts(owner)["items"][0]["channels"]}
    assert channels["in_app"]["status"] == "sent"
    assert channels["email"]["status"] == "skipped" and channels["email"]["errorCode"] == "EMAIL_NOT_CONFIGURED"
    assert channels["email"]["sentAt"] is None
    sent_emails = db.scalar(
        select(func.count()).where(
            NotificationDelivery.channel == DeliveryChannel.EMAIL, NotificationDelivery.status == DeliveryStatus.SENT
        )
    )
    assert sent_emails == 0


def test_read_state_is_per_user(team):
    owner, member, *_ = team
    alert_id = alerts(owner)["items"][0]["id"]
    assert owner.patch(f"/api/v1/alerts/{alert_id}", json={"read": True}).json()["isRead"] is True
    assert owner.get("/api/v1/alerts/unread-count").json() == {"count": 0}
    assert member.get("/api/v1/alerts/unread-count").json() == {"count": 1}
    assert alerts(owner, unread="true")["total"] == 0 and alerts(owner, unread="false")["total"] == 1
    assert owner.patch(f"/api/v1/alerts/{alert_id}", json={"read": False}).json()["isRead"] is False


def test_mark_all_read_only_touches_callers_rows_in_this_workspace(team, db, make_user):
    owner, member, workspace, *_ = team
    # The owner also belongs to a second workspace with its own alert.
    _, other_ws = make_user("elsewhere@example.com")
    from app.models import User, WorkspaceMembership

    owner_user = db.scalar(select(User).where(User.email == "owner@example.com"))
    db.add(WorkspaceMembership(workspace_id=other_ws.id, user_id=owner_user.id, role=Role.MEMBER))
    db.flush()
    alert_service.create_alert(
        db, workspace_id=other_ws.id, alert_type=AlertType.DIGEST, dedupe_key="digest:1", title="Other workspace"
    )
    db.commit()

    assert owner.post("/api/v1/alerts/mark-all-read").json() == {"updated": 1}
    assert member.get("/api/v1/alerts/unread-count").json() == {"count": 1}
    owner.put("/api/v1/auth/session/workspace", json={"workspaceId": str(other_ws.id)})
    assert owner.get("/api/v1/alerts/unread-count").json() == {"count": 1}


def test_dismiss_hides_for_caller_only_and_is_idempotent(team):
    owner, member, *_ = team
    alert_id = alerts(owner)["items"][0]["id"]
    assert owner.delete(f"/api/v1/alerts/{alert_id}").status_code == 204
    assert owner.delete(f"/api/v1/alerts/{alert_id}").status_code == 204
    assert alerts(owner)["total"] == 0 and alerts(member)["total"] == 1
    assert owner.patch(f"/api/v1/alerts/{alert_id}", json={"read": True}).status_code == 404


def test_same_dedupe_key_creates_one_alert(team, db):
    _, _, workspace, *_ = team
    args = {"workspace_id": workspace.id, "alert_type": AlertType.DIGEST, "dedupe_key": "digest:x", "title": "Digest"}
    assert alert_service.create_alert(db, **args) is not None
    assert alert_service.create_alert(db, **args) is None
    assert db.scalar(select(func.count()).where(Alert.dedupe_key == "digest:x")) == 1


def test_pause_stops_new_alerts_and_resume_restores_them(team, make_lead):
    owner, _, _, search, company = team
    alert_id = alerts(owner)["items"][0]["id"]
    paused = owner.patch(f"/api/v1/alerts/{alert_id}", json={"paused": True}).json()
    assert paused["isPaused"] is True
    detail = owner.get(f"/api/v1/saved-searches/{search['id']}").json()
    assert detail["notificationsPaused"] is True and detail["notifyInApp"] is True  # channel choices kept

    make_lead(company, title="React Lead", technologies=["React"])
    run = owner.post(f"/api/v1/saved-searches/{search['id']}/run").json()
    assert run["newCount"] == 1 and alerts(owner)["total"] == 1  # no alert while paused

    owner.patch(f"/api/v1/alerts/{alert_id}", json={"paused": False})
    make_lead(company, title="React Architect", technologies=["React"])
    owner.post(f"/api/v1/saved-searches/{search['id']}/run")
    assert alerts(owner)["total"] == 2


def test_member_cannot_pause_someone_elses_search(team):
    _, member, *_ = team
    alert_id = alerts(member)["items"][0]["id"]
    assert member.patch(f"/api/v1/alerts/{alert_id}", json={"paused": True}).status_code == 403


def test_alerts_without_a_saved_search_cannot_be_paused(team, db):
    owner, _, workspace, *_ = team
    alert = alert_service.create_alert(
        db, workspace_id=workspace.id, alert_type=AlertType.COMPANY_SIGNAL, dedupe_key="sig:1", title="Signal"
    )
    db.commit()
    response = owner.patch(f"/api/v1/alerts/{alert.id}", json={"paused": True})
    assert response.status_code == 422 and response.json()["error"]["code"] == "ALERT_NOT_PAUSABLE"


def test_workspace_isolation(team, signed_in):
    owner, *_ = team
    alert_id = alerts(owner)["items"][0]["id"]
    other, *_ = signed_in("stranger@example.com")
    assert alerts(other)["total"] == 0
    assert other.get("/api/v1/alerts/unread-count").json() == {"count": 0}
    assert other.patch(f"/api/v1/alerts/{alert_id}", json={"read": True}).status_code == 404
    assert other.delete(f"/api/v1/alerts/{alert_id}").status_code == 404
    assert other.post("/api/v1/alerts/mark-all-read").json() == {"updated": 0}
