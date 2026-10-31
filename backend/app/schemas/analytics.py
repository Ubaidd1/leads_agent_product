import uuid
from datetime import date, datetime

from pydantic import Field

from app.schemas.common import CamelModel
from app.schemas.leads import LeadSummary


class RangeOut(CamelModel):
    from_: date = Field(serialization_alias="from")
    to: date
    timezone: str


class Metric(CamelModel):
    value: float | int | None
    # Same metric over the equal-length window just before the range; null where not comparable.
    previous: float | int | None = None
    change_pct: float | None = None


class SeriesPoint(CamelModel):
    period: date
    value: int


class Bucket(CamelModel):
    key: str
    count: int
    share: float | None


class ActivityItem(CamelModel):
    signal_type: str
    description: str
    occurred_at: datetime
    company_id: uuid.UUID
    company_name: str
    company_slug: str
    lead_id: uuid.UUID | None


class DashboardKpis(CamelModel):
    qualified_leads: Metric
    high_intent_companies: Metric
    new_leads: Metric
    verified_leads: Metric
    average_score: Metric
    # Verified leads ÷ new leads in the range; null when there were no new leads.
    verification_rate: float | None


class DashboardOut(CamelModel):
    range: RangeOut
    qualified_threshold: int
    kpis: DashboardKpis
    velocity: list[SeriesPoint]
    intent_distribution: list[Bucket]
    top_leads: list[LeadSummary]
    recent_activity: list[ActivityItem]
    data_freshness: datetime | None


class AnalyticsOverview(CamelModel):
    range: RangeOut
    monitored_companies: int
    open_leads: int
    verified_signals: Metric
    remote_acceptance: float | None
    average_score: float | None


class SeriesOut(CamelModel):
    range: RangeOut
    interval: str
    points: list[SeriesPoint]


class BucketsOut(CamelModel):
    range: RangeOut
    items: list[Bucket]


class ActivityOut(CamelModel):
    range: RangeOut
    items: list[ActivityItem]
