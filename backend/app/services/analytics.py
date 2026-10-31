"""Dashboard and analytics metrics.

Every metric is computed in SQL from the same scopes as GET /leads (``lead_ids_query`` and
``visible_to``), so the dashboard, analytics and lead lists always agree. Dates are grouped in the
workspace's reporting timezone. Nothing is estimated or padded: unknown values are null.
"""

import uuid
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import Select, String, cast, func, or_, select
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Session

from app.core.context import RequestContext
from app.core.exceptions import ValidationFailed
from app.models import Company, HiringSignal, Lead
from app.models.enums import HiringIntent, VerificationStatus
from app.repositories import catalog as repo
from app.repositories.catalog import LeadFilters, visible_to
from app.schemas import analytics as schemas
from app.services.catalog import lead_summary

MAX_RANGE_DAYS = 366
DEFAULT_RANGE_DAYS = 30
VELOCITY_WEEKS = 8
REMOTE_FRIENDLY_REGIONS = ["worldwide", "international-remote", "pakistan-allowed"]


@dataclass(frozen=True)
class DateRange:
    start_date: date
    end_date: date  # inclusive
    timezone: str

    @property
    def start(self) -> datetime:
        return datetime.combine(self.start_date, time.min, ZoneInfo(self.timezone))

    @property
    def end(self) -> datetime:
        """Exclusive upper bound: midnight after end_date in the reporting timezone."""
        return datetime.combine(self.end_date + timedelta(days=1), time.min, ZoneInfo(self.timezone))

    @property
    def days(self) -> int:
        return (self.end_date - self.start_date).days + 1

    def previous(self) -> "DateRange":
        return DateRange(
            self.start_date - timedelta(days=self.days), self.start_date - timedelta(days=1), self.timezone
        )

    def out(self) -> schemas.RangeOut:
        return schemas.RangeOut(from_=self.start_date, to=self.end_date, timezone=self.timezone)


def resolve_range(ctx: RequestContext, start: date | None, end: date | None) -> DateRange:
    tz = ctx.workspace.reporting_timezone or "UTC"
    today = datetime.now(ZoneInfo(tz)).date()
    end = end or today
    start = start or end - timedelta(days=DEFAULT_RANGE_DAYS - 1)
    if end < start:
        raise ValidationFailed("`to` must be on or after `from`.", details=[{"field": "to", "message": "Before from"}])
    if (end - start).days + 1 > MAX_RANGE_DAYS:
        raise ValidationFailed(
            f"The date range can be at most {MAX_RANGE_DAYS} days.",
            details=[{"field": "from", "message": "Range too long"}],
        )
    return DateRange(start, end, tz)


def _change(current: float | None, previous: float | None) -> float | None:
    """Percentage change vs the previous period; null when there is nothing to compare against."""
    if current is None or not previous:
        return None
    return round((current - previous) / previous * 100, 1)


def _in_range(column, rng: DateRange):
    return (column >= rng.start) & (column < rng.end)


def _local(column, tz: str):
    return func.timezone(tz, column)


# --- scopes ------------------------------------------------------------------------


def open_leads(ws: uuid.UUID) -> Select:
    return repo.lead_ids_query(ws, LeadFilters())


def all_leads(ws: uuid.UUID) -> Select:
    return repo.lead_ids_query(ws, LeadFilters(include_closed=True))


def visible_signals(ws: uuid.UUID) -> Select:
    return (
        select(HiringSignal.id)
        .join(Company, Company.id == HiringSignal.company_id)
        .outerjoin(Lead, Lead.id == HiringSignal.lead_id)
        .where(
            visible_to(HiringSignal, ws),
            visible_to(Company, ws),
            or_(HiringSignal.lead_id.is_(None), visible_to(Lead, ws)),
        )
    )


def _count(db: Session, stmt: Select) -> int:
    return db.scalar(select(func.count()).select_from(stmt.subquery()))


# --- individual metrics -----------------------------------------------------------------


def qualified_leads(db: Session, ws: uuid.UUID, threshold: int) -> int:
    return repo.count_leads(db, ws, LeadFilters(min_score=threshold))


def new_leads(db: Session, ws: uuid.UUID, rng: DateRange) -> int:
    return _count(db, all_leads(ws).where(_in_range(Lead.first_seen_at, rng)))


def verified_leads(db: Session, ws: uuid.UUID, rng: DateRange) -> int:
    return _count(
        db,
        all_leads(ws).where(
            Lead.verification_status.in_([VerificationStatus.VERIFIED, VerificationStatus.HIGH_CONFIDENCE]),
            _in_range(Lead.last_verified_at, rng),
        ),
    )


def verified_signals(db: Session, ws: uuid.UUID, rng: DateRange) -> int:
    return _count(db, visible_signals(ws).where(_in_range(HiringSignal.occurred_at, rng)))


def _companies_with_open_leads(ws: uuid.UUID):
    return select(Lead.company_id).where(Lead.id.in_(open_leads(ws)))


def high_intent_companies(db: Session, ws: uuid.UUID) -> int:
    return _count(
        db,
        select(Company.id).where(
            visible_to(Company, ws),
            Company.intent_level == HiringIntent.STRONG,
            Company.id.in_(_companies_with_open_leads(ws)),
        ),
    )


def average_score(db: Session, ws: uuid.UUID) -> float | None:
    value = db.scalar(select(func.avg(Lead.score)).where(Lead.id.in_(open_leads(ws)), Lead.score.is_not(None)))
    return round(float(value), 1) if value is not None else None


def monitored_companies(db: Session, ws: uuid.UUID) -> int:
    return _count(db, select(Company.id).where(visible_to(Company, ws)))


def open_lead_count(db: Session, ws: uuid.UUID) -> int:
    return _count(db, open_leads(ws))


def remote_acceptance(db: Session, ws: uuid.UUID) -> float | None:
    total = open_lead_count(db, ws)
    if not total:
        return None
    friendly = _count(db, open_leads(ws).where(Lead.regions.overlap(cast(REMOTE_FRIENDLY_REGIONS, ARRAY(String)))))
    return round(friendly / total, 4)


def data_freshness(db: Session, ws: uuid.UUID) -> datetime | None:
    return db.scalar(select(func.max(Lead.last_seen_at)).where(Lead.id.in_(all_leads(ws))))


# --- series and distributions --------------------------------------------------------------


def _buckets(start: date, end: date, interval: str) -> list[date]:
    if interval == "day":
        first, step = start, lambda d: d + timedelta(days=1)
    elif interval == "week":
        first, step = start - timedelta(days=start.weekday()), lambda d: d + timedelta(days=7)
    else:
        first = start.replace(day=1)
        step = lambda d: (d.replace(day=28) + timedelta(days=4)).replace(day=1)  # noqa: E731
    out, current = [], first
    while current <= end:
        out.append(current)
        current = step(current)
    return out


def new_leads_series(
    db: Session, ws: uuid.UUID, start: date, end: date, tz: str, interval: str
) -> list[schemas.SeriesPoint]:
    """New leads per day/week/month (ISO weeks start Monday), with empty buckets as 0."""
    buckets = _buckets(start, end, interval)
    lower = datetime.combine(buckets[0], time.min, ZoneInfo(tz))
    upper = datetime.combine(end + timedelta(days=1), time.min, ZoneInfo(tz))
    bucket = func.date_trunc(interval, _local(Lead.first_seen_at, tz)).label("bucket")
    rows = db.execute(
        select(bucket, func.count())
        .where(Lead.id.in_(all_leads(ws)), Lead.first_seen_at >= lower, Lead.first_seen_at < upper)
        .group_by(bucket)
    ).all()
    counts = {row[0].date(): row[1] for row in rows}
    return [schemas.SeriesPoint(period=b, value=counts.get(b, 0)) for b in buckets]


def intent_distribution(db: Session, ws: uuid.UUID) -> list[schemas.Bucket]:
    level = func.coalesce(Company.intent_level, "unknown").label("level")
    rows = dict(
        db.execute(
            select(level, func.count())
            .where(visible_to(Company, ws), Company.id.in_(_companies_with_open_leads(ws)))
            .group_by(level)
        ).all()
    )
    total = sum(rows.values())
    order = ["strong", "medium", "low", "unknown"]
    return [schemas.Bucket(key=key, count=rows.get(key, 0), share=_share(rows.get(key, 0), total)) for key in order]


def _share(count: int, total: int) -> float | None:
    return round(count / total, 4) if total else None


def technology_demand(db: Session, ws: uuid.UUID, rng: DateRange, limit: int) -> list[schemas.Bucket]:
    scope = open_leads(ws).where(_in_range(Lead.first_seen_at, rng))
    total = _count(db, scope)
    tech = select(func.unnest(Lead.technologies).label("technology")).where(Lead.id.in_(scope)).subquery()
    rows = db.execute(
        select(tech.c.technology, func.count().label("n"))
        .group_by(tech.c.technology)
        .order_by(func.count().desc(), tech.c.technology)
        .limit(limit)
    ).all()
    return [schemas.Bucket(key=name, count=n, share=_share(n, total)) for name, n in rows]


def industry_breakdown(db: Session, ws: uuid.UUID, limit: int) -> list[schemas.Bucket]:
    industry = func.coalesce(Company.industry, "Unknown").label("industry")
    rows = db.execute(
        select(industry, func.count(Company.id.distinct()).label("n"))
        .where(visible_to(Company, ws), Company.id.in_(_companies_with_open_leads(ws)))
        .group_by(industry)
        .order_by(func.count(Company.id.distinct()).desc(), industry)
    ).all()
    total = sum(n for _, n in rows)
    return [schemas.Bucket(key=name, count=n, share=_share(n, total)) for name, n in rows[:limit]]


def seniority_distribution(db: Session, ws: uuid.UUID) -> list[schemas.Bucket]:
    seniority = func.coalesce(Lead.seniority, "Unknown").label("seniority")
    rows = db.execute(
        select(seniority, func.count())
        .where(Lead.id.in_(open_leads(ws)))
        .group_by(seniority)
        .order_by(func.count().desc(), seniority)
    ).all()
    total = sum(n for _, n in rows)
    return [schemas.Bucket(key=name, count=n, share=_share(n, total)) for name, n in rows]


def score_distribution(db: Session, ws: uuid.UUID) -> list[schemas.Bucket]:
    """Open leads in 10-point bands (90–100 is one band), plus an 'unscored' bucket."""
    band = func.least(func.floor(Lead.score / 10) * 10, 90).label("band")
    rows = dict(
        db.execute(
            select(band, func.count()).where(Lead.id.in_(open_leads(ws)), Lead.score.is_not(None)).group_by(band)
        ).all()
    )
    unscored = _count(db, open_leads(ws).where(Lead.score.is_(None)))
    counts = [(f"{b}-{b + 9 if b < 90 else 100}", int(rows.get(b, 0))) for b in range(0, 100, 10)]
    total = sum(n for _, n in counts) + unscored
    return [schemas.Bucket(key=k, count=n, share=_share(n, total)) for k, n in counts] + [
        schemas.Bucket(key="unscored", count=unscored, share=_share(unscored, total))
    ]


def recent_activity(db: Session, ws: uuid.UUID, limit: int) -> list[schemas.ActivityItem]:
    rows = db.execute(
        select(HiringSignal, Company.name, Company.slug)
        .join(Company, Company.id == HiringSignal.company_id)
        .where(HiringSignal.id.in_(visible_signals(ws)))
        .order_by(HiringSignal.occurred_at.desc(), HiringSignal.id)
        .limit(limit)
    ).all()
    return [
        schemas.ActivityItem(
            signal_type=signal.signal_type,
            description=signal.description,
            occurred_at=signal.occurred_at,
            company_id=signal.company_id,
            company_name=name,
            company_slug=slug,
            lead_id=signal.lead_id,
        )
        for signal, name, slug in rows
    ]


# --- endpoint payloads ---------------------------------------------------------------------


def dashboard(db: Session, ctx: RequestContext, rng: DateRange) -> schemas.DashboardOut:
    ws = ctx.workspace.id
    prev = rng.previous()
    new_now, new_prev = new_leads(db, ws, rng), new_leads(db, ws, prev)
    verified_now, verified_prev = verified_leads(db, ws, rng), verified_leads(db, ws, prev)
    top_rows, _ = repo.list_leads(db, ws, LeadFilters(), sort="score", order="desc", page=1, page_size=5)
    velocity_start = rng.end_date - timedelta(weeks=VELOCITY_WEEKS - 1)
    return schemas.DashboardOut(
        range=rng.out(),
        qualified_threshold=ctx.workspace.qualified_threshold,
        kpis=schemas.DashboardKpis(
            qualified_leads=schemas.Metric(value=qualified_leads(db, ws, ctx.workspace.qualified_threshold)),
            high_intent_companies=schemas.Metric(value=high_intent_companies(db, ws)),
            new_leads=schemas.Metric(value=new_now, previous=new_prev, change_pct=_change(new_now, new_prev)),
            verified_leads=schemas.Metric(
                value=verified_now, previous=verified_prev, change_pct=_change(verified_now, verified_prev)
            ),
            average_score=schemas.Metric(value=average_score(db, ws)),
            verification_rate=round(verified_now / new_now, 4) if new_now else None,
        ),
        velocity=new_leads_series(db, ws, velocity_start, rng.end_date, rng.timezone, "week"),
        intent_distribution=intent_distribution(db, ws),
        top_leads=[lead_summary(*row) for row in top_rows],
        recent_activity=recent_activity(db, ws, 10),
        data_freshness=data_freshness(db, ws),
    )


def overview(db: Session, ctx: RequestContext, rng: DateRange) -> schemas.AnalyticsOverview:
    ws = ctx.workspace.id
    now, prev = verified_signals(db, ws, rng), verified_signals(db, ws, rng.previous())
    return schemas.AnalyticsOverview(
        range=rng.out(),
        monitored_companies=monitored_companies(db, ws),
        open_leads=open_lead_count(db, ws),
        verified_signals=schemas.Metric(value=now, previous=prev, change_pct=_change(now, prev)),
        remote_acceptance=remote_acceptance(db, ws),
        average_score=average_score(db, ws),
    )
