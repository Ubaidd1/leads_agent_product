"""Idempotent development seed: a demo workspace + user holding the prototype fixtures.

    python -m scripts.seed_demo

All rows are flagged ``is_demo`` and scoped to the demo workspace, so they are never visible to
real workspaces. Refuses to run when ENVIRONMENT=production.

Phase 2 adds four saved searches (each run once for real, so their counts are true for the demo
data) and the prototype's four alert texts, flagged ``is_demo``.
"""

import os
import secrets
import sys

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models import (
    Alert,
    Company,
    HiringSignal,
    Lead,
    LeadScore,
    LeadSource,
    SavedSearch,
    User,
    Workspace,
    WorkspaceMembership,
)
from app.models.enums import AlertType, HiringIntent, Role, RunTrigger, SearchFrequency, VerificationStatus
from app.schemas.search import SearchCriteria
from app.services import alerts as alert_service
from app.services import saved_searches as search_service
from app.utils.time import utcnow
from scripts.demo_fixtures import COMPANIES, LEADS, TIMELINE, fixture_breakdown

DEMO_EMAIL = "demo@hiringintel.ai"
DEMO_WORKSPACE = "ZoneX Agency (Demo)"
FIXTURE_SOURCE = "demo_fixture"
FIXTURE_SCORE_VERSION = "demo-fixture"


def seed_user_and_workspace(db: Session) -> tuple[Workspace, str | None]:
    user = db.scalar(select(User).where(User.email == DEMO_EMAIL))
    generated_password = None
    if user is None:
        password = os.environ.get("DEMO_USER_PASSWORD")
        if not password:
            password = generated_password = secrets.token_urlsafe(12)
        user = User(
            email=DEMO_EMAIL,
            password_hash=hash_password(password),
            full_name="ZoneX Dev",
            job_title="Agency Partner",
            password_changed_at=utcnow(),
        )
        db.add(user)
        db.flush()

    workspace = db.scalar(
        select(Workspace)
        .join(WorkspaceMembership, WorkspaceMembership.workspace_id == Workspace.id)
        .where(Workspace.is_demo.is_(True), WorkspaceMembership.user_id == user.id)
    )
    if workspace is None:
        workspace = Workspace(name=DEMO_WORKSPACE, is_demo=True)
        db.add(workspace)
        db.flush()
        db.add(WorkspaceMembership(workspace_id=workspace.id, user_id=user.id, role=Role.OWNER))
    return workspace, generated_password


def seed_companies(db: Session, workspace: Workspace) -> dict[str, Company]:
    by_slug = {}
    for data in COMPANIES:
        data = dict(data)
        activity = data.pop("activity")
        company = db.scalar(select(Company).where(Company.workspace_id == workspace.id, Company.slug == data["slug"]))
        if company is None:
            company = Company(workspace_id=workspace.id, slug=data["slug"], is_demo=True)
            db.add(company)
        for field, value in data.items():
            setattr(company, field, HiringIntent(value) if field == "intent_level" else value)
        company.careers_url = f"https://{data['slug']}.example/careers"
        company.activity_series = [{"period": f"P{i + 1}", "value": value} for i, value in enumerate(activity)]
        by_slug[company.slug] = company
    db.flush()
    return by_slug


def seed_leads(db: Session, workspace: Workspace, companies: dict[str, Company]) -> int:
    now = utcnow()
    created = 0
    for index, row in enumerate(LEADS):
        fixture_id, slug, title, service, score, intent, techs, remote, regions, salary, posted_ago, verified_ago = row
        company = companies[slug]
        source = db.scalar(
            select(LeadSource).where(
                LeadSource.source_type == FIXTURE_SOURCE, LeadSource.source_record_id == fixture_id
            )
        )
        if source is not None:
            continue  # Already seeded; leave timestamps and history untouched.

        lead = Lead(
            workspace_id=workspace.id,
            company_id=company.id,
            title=title,
            service_type=service,
            seniority="Lead / Principal" if index % 3 == 0 else "Senior",
            technologies=techs,
            remote_policy=remote,
            regions=regions,
            salary_min=salary[0],
            salary_max=salary[1],
            salary_currency=salary[2],
            hiring_intent=HiringIntent(intent),
            verification_status=VerificationStatus.HIGH_CONFIDENCE if score >= 88 else VerificationStatus.VERIFIED,
            canonical_url=f"https://{slug}.example/jobs/{fixture_id}",
            posted_at=now - posted_ago,
            first_seen_at=now - posted_ago,
            last_seen_at=now - verified_ago,
            last_verified_at=now - verified_ago,
            score=score,
            score_version=FIXTURE_SCORE_VERSION,
            is_demo=True,
        )
        db.add(lead)
        db.flush()
        db.add(
            LeadSource(
                lead_id=lead.id,
                source_type=FIXTURE_SOURCE,
                source_name="Demo fixture (prototype src/data/leads.js)",
                source_url=None,
                source_record_id=fixture_id,
                first_seen_at=now - posted_ago,
                last_seen_at=now - verified_ago,
                verified_at=None,
            )
        )
        db.add(
            LeadScore(
                lead_id=lead.id,
                version=FIXTURE_SCORE_VERSION,
                total=score,
                components=fixture_breakdown(score),
                rationale=(
                    f"{company.name} is showing {intent} hiring intent with {company.relevant_roles_count} relevant "
                    f"roles, recent verified activity, and strong alignment with {techs[0]} and {techs[1]}. "
                    "(Illustrative demo score; not produced by the scoring engine.)"
                ),
                calculated_at=now,
            )
        )
        for ago, signal_type, description in TIMELINE:
            db.add(
                HiringSignal(
                    workspace_id=workspace.id,
                    company_id=company.id,
                    lead_id=lead.id,
                    signal_type=signal_type,
                    description=description.format(title=title),
                    occurred_at=now - ago,
                    is_demo=True,
                )
            )
        created += 1
    return created


# Criteria translated from the prototype's summaries (src/data/savedSearches.js). Its vanity counts
# ("418 total matches") are not seeded; each search is run once against the demo data instead.
SAVED_SEARCHES = [
    (
        "US React & Node Opportunities",
        SearchFrequency.DAILY,
        True,
        {"technologies": ["React", "Node.js"], "regions": ["united-states"], "minScore": 80},
    ),
    (
        "Global AI / LLM Demand",
        SearchFrequency.INSTANT,
        True,
        {"technologies": ["LLM", "RAG", "Python"], "regions": ["worldwide"], "minScore": 85},
    ),
    (
        "International Software Teams",
        SearchFrequency.DAILY,
        True,
        {"serviceTypes": ["Software Development"], "regions": ["worldwide"], "minScore": 78},
    ),
    (
        "Programmatic SEO Leads",
        SearchFrequency.WEEKLY,
        False,
        {"technologies": ["SEO", "Next.js"], "regions": ["worldwide"], "minScore": 75},
    ),
]

# The prototype's alert texts (src/data/alerts.js), stored as demo alerts rather than passed off as real events.
DEMO_ALERTS = [
    ("demo:alert-1", AlertType.DIGEST, "14 new high-intent AI companies matched", "Global AI / LLM Demand"),
    (
        "demo:alert-2",
        AlertType.COMPANY_SIGNAL,
        "NovaStack Labs hiring velocity increased 41%",
        "US React & Node Opportunities",
    ),
    ("demo:alert-3", AlertType.COMPANY_SIGNAL, "CloudNova Systems added 3 AI roles", "Global AI / LLM Demand"),
    ("demo:alert-4", AlertType.DIGEST, "Weekly lead digest is ready", "Programmatic SEO Leads"),
]


def seed_saved_searches(db: Session, workspace: Workspace) -> int:
    owner_id = db.scalar(select(WorkspaceMembership.user_id).where(WorkspaceMembership.workspace_id == workspace.id))
    created = 0
    for name, frequency, active, criteria in SAVED_SEARCHES:
        if db.scalar(select(SavedSearch.id).where(SavedSearch.workspace_id == workspace.id, SavedSearch.name == name)):
            continue
        search = SavedSearch(
            workspace_id=workspace.id,
            created_by_user_id=owner_id,
            name=name,
            criteria=SearchCriteria.model_validate(criteria).stored(),
            frequency=frequency,
            is_active=active,
            notify_in_app=True,
            notify_email=False,
        )
        db.add(search)
        db.flush()
        # A real run, so the counts shown are true for the demo data. Commits.
        search_service.execute_run(db, search, RunTrigger.MANUAL)
        created += 1
    return created


def seed_alerts(db: Session, workspace: Workspace) -> int:
    created = 0
    for key, alert_type, title, search_name in DEMO_ALERTS:
        search_id = db.scalar(
            select(SavedSearch.id).where(SavedSearch.workspace_id == workspace.id, SavedSearch.name == search_name)
        )
        if db.scalar(select(Alert.id).where(Alert.workspace_id == workspace.id, Alert.dedupe_key == key)):
            continue
        alert_service.create_alert(
            db,
            workspace_id=workspace.id,
            alert_type=alert_type,
            dedupe_key=key,
            title=title,
            detail=f"{search_name} (demo alert)",
            saved_search_id=search_id,
            is_demo=True,
        )
        created += 1
    return created


def main() -> int:
    settings = get_settings()
    if settings.environment == "production":
        print("Refusing to seed demo data in production.", file=sys.stderr)
        return 1
    with SessionLocal() as db:
        workspace, generated_password = seed_user_and_workspace(db)
        companies = seed_companies(db, workspace)
        created = seed_leads(db, workspace, companies)
        db.commit()
        searches = seed_saved_searches(db, workspace)
        alerts = seed_alerts(db, workspace)
        db.commit()
    print(f"Demo workspace ready: {len(companies)} companies, {created} new leads ({len(LEADS)} total).")
    print(f"Saved searches created: {searches}; demo alerts created: {alerts}.")
    print(f"Sign in as {DEMO_EMAIL}")
    if generated_password:
        print(f"Generated password (shown once): {generated_password}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
