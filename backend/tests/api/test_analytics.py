from datetime import UTC, datetime, timedelta

import pytest

from app.models import HiringSignal
from app.models.enums import HiringIntent, LeadStatus, VerificationStatus
from app.utils.time import utcnow


@pytest.fixture
def world(signed_in, make_company, make_lead, db):
    client, _, workspace = signed_in("analyst@example.com")
    now = utcnow()
    strong = make_company(name="Strong Co", slug="strong", intent_level=HiringIntent.STRONG, industry="SaaS")
    medium = make_company(name="Medium Co", slug="medium", intent_level=HiringIntent.MEDIUM, industry="Fintech")
    idle = make_company(name="Idle Co", slug="idle", intent_level=HiringIntent.STRONG, industry="SaaS")
    make_lead(
        strong,
        title="A",
        score=90,
        technologies=["React", "AWS"],
        regions=["worldwide"],
        first_seen_at=now,
        last_verified_at=now,
        seniority="Senior",
    )
    make_lead(
        strong,
        title="B",
        score=80,
        technologies=["React"],
        regions=["united-states"],
        first_seen_at=now,
        verification_status=VerificationStatus.UNVERIFIED,
        seniority="Senior",
    )
    make_lead(
        medium,
        title="C",
        score=60,
        technologies=["Python"],
        regions=["pakistan-allowed"],
        first_seen_at=now,
        last_verified_at=now,
        seniority="Mid",
    )
    make_lead(medium, title="D", score=None, technologies=[], regions=[], first_seen_at=now - timedelta(days=45))
    make_lead(idle, title="Closed", score=99, status=LeadStatus.CLOSED, first_seen_at=now)
    db.add(
        HiringSignal(
            company_id=strong.id,
            signal_type="new_role",
            description="Strong Co added a role",
            occurred_at=now - timedelta(hours=1),
        )
    )
    db.commit()
    return client, workspace


def get(client, path, **params):
    response = client.get(f"/api/v1{path}", params=params)
    assert response.status_code == 200, response.text
    return response.json()


def test_dashboard_known_numbers(world):
    client, _ = world
    body = get(client, "/dashboard")
    kpis = body["kpis"]
    assert body["qualifiedThreshold"] == 75
    assert kpis["qualifiedLeads"]["value"] == 2  # A, B (closed lead excluded)
    assert kpis["highIntentCompanies"]["value"] == 1  # Idle Co has no open leads
    assert kpis["newLeads"]["value"] == 4  # A, B, C, Closed (D is 45 days old)
    assert kpis["newLeads"]["previous"] == 1 and kpis["newLeads"]["changePct"] == 300.0
    assert kpis["verifiedLeads"]["value"] == 2 and kpis["verifiedLeads"]["changePct"] is None  # previous was 0
    assert kpis["averageScore"]["value"] == 76.7  # (90 + 80 + 60) / 3, unscored D ignored
    assert kpis["verificationRate"] == 0.5
    assert [lead["jobTitle"] for lead in body["topLeads"]] == ["A", "B", "C", "D"]
    assert body["recentActivity"][0]["companyName"] == "Strong Co"
    assert body["dataFreshness"] is not None
    intents = {b["key"]: b["count"] for b in body["intentDistribution"]}
    assert intents == {"strong": 1, "medium": 1, "low": 0, "unknown": 0}
    assert len(body["velocity"]) == 8 and body["velocity"][-1]["value"] == 4
    # D (45 days old) falls 6-7 weeks back; every other week is empty and filled with 0, not omitted.
    assert sum(point["value"] for point in body["velocity"]) == 5
    assert sum(1 for point in body["velocity"] if point["value"] == 0) == 6


def test_qualified_leads_matches_lead_list(world):
    client, _ = world
    client.patch("/api/v1/workspace", json={"qualifiedThreshold": 85})
    kpi = get(client, "/dashboard")["kpis"]["qualifiedLeads"]["value"]
    assert kpi == get(client, "/leads", minScore=85)["total"] == 1


def test_analytics_endpoints(world):
    client, _ = world
    overview = get(client, "/analytics/overview")
    assert overview["monitoredCompanies"] == 3 and overview["openLeads"] == 4
    assert overview["remoteAcceptance"] == 0.5  # A (worldwide) and C (pakistan-allowed) of 4
    assert overview["verifiedSignals"]["value"] == 1 and "averageTechExpansion" not in overview

    tech = get(client, "/analytics/technologies")["items"]
    assert tech[0] == {"key": "React", "count": 2, "share": round(2 / 3, 4)}
    industries = {b["key"]: b["count"] for b in get(client, "/analytics/industries")["items"]}
    assert industries == {"SaaS": 1, "Fintech": 1}
    seniority = {b["key"]: b["count"] for b in get(client, "/analytics/seniority")["items"]}
    assert seniority == {"Senior": 2, "Mid": 1, "Unknown": 1}
    scores = {b["key"]: b["count"] for b in get(client, "/analytics/score-distribution")["items"]}
    assert scores["90-100"] == 1 and scores["80-89"] == 1 and scores["60-69"] == 1 and scores["unscored"] == 1


def test_timezone_boundary(signed_in, make_company, make_lead):
    client, *_ = signed_in("tz@example.com")
    company = make_company()
    make_lead(company, first_seen_at=datetime(2026, 3, 10, 23, 30, tzinfo=UTC))
    params = {"from": "2026-03-10", "to": "2026-03-11", "interval": "day"}

    utc = get(client, "/analytics/leads-over-time", **params)["points"]
    assert utc == [{"period": "2026-03-10", "value": 1}, {"period": "2026-03-11", "value": 0}]

    client.patch("/api/v1/workspace", json={"reportingTimezone": "Asia/Karachi"})
    karachi = get(client, "/analytics/leads-over-time", **params)
    assert karachi["range"] == {"from": "2026-03-10", "to": "2026-03-11", "timezone": "Asia/Karachi"}
    assert karachi["points"] == [{"period": "2026-03-10", "value": 0}, {"period": "2026-03-11", "value": 1}]


def test_workspace_isolation(world, signed_in, make_company, make_lead):
    client, _ = world
    before = get(client, "/dashboard")["kpis"]
    other, _, other_ws = signed_in("rival@example.com")
    private = make_company(
        workspace_id=other_ws.id, name="Private Co", slug="private", intent_level=HiringIntent.STRONG
    )
    make_lead(private, title="Secret", score=99)
    assert get(client, "/dashboard")["kpis"] == before
    # The other workspace sees the shared catalogue (A, B) plus its own private lead.
    assert get(other, "/dashboard")["kpis"]["qualifiedLeads"]["value"] == 3


@pytest.mark.parametrize(
    "params", [{"from": "2026-01-10", "to": "2026-01-01"}, {"from": "2024-01-01", "to": "2026-01-01"}]
)
def test_invalid_ranges(world, params):
    client, _ = world
    for path in ("/dashboard", "/analytics/overview"):
        response = client.get(f"/api/v1{path}", params=params)
        assert response.status_code == 422 and response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_reporting_settings_validation(world):
    client, _ = world
    assert client.patch("/api/v1/workspace", json={"reportingTimezone": "Mars/Base"}).status_code == 422
    assert client.patch("/api/v1/workspace", json={"qualifiedThreshold": 101}).status_code == 422
    body = client.patch(
        "/api/v1/workspace", json={"reportingTimezone": "Europe/London", "qualifiedThreshold": 60}
    ).json()
    assert body["reportingTimezone"] == "Europe/London" and body["qualifiedThreshold"] == 60
