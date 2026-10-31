from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query

from app.api.deps import DB, Ctx
from app.schemas import analytics as schemas
from app.services import analytics as service

router = APIRouter(tags=["dashboard & analytics"])


def date_range(
    ctx: Ctx,
    start: Annotated[
        date | None, Query(alias="from", description="First day, in the workspace reporting timezone")
    ] = None,
    end: Annotated[date | None, Query(alias="to", description="Last day (inclusive). Default: today")] = None,
) -> service.DateRange:
    return service.resolve_range(ctx, start, end)


Range = Annotated[service.DateRange, Depends(date_range)]
Limit = Annotated[int, Query(ge=1, le=50)]


@router.get("/dashboard", response_model=schemas.DashboardOut)
def dashboard(db: DB, ctx: Ctx, rng: Range):
    return service.dashboard(db, ctx, rng)


@router.get("/analytics/overview", response_model=schemas.AnalyticsOverview)
def analytics_overview(db: DB, ctx: Ctx, rng: Range):
    return service.overview(db, ctx, rng)


@router.get("/analytics/leads-over-time", response_model=schemas.SeriesOut)
def leads_over_time(db: DB, ctx: Ctx, rng: Range, interval: Literal["day", "week", "month"] = "week"):
    points = service.new_leads_series(db, ctx.workspace.id, rng.start_date, rng.end_date, rng.timezone, interval)
    return schemas.SeriesOut(range=rng.out(), interval=interval, points=points)


@router.get("/analytics/intent-distribution", response_model=schemas.BucketsOut)
def intent_distribution(db: DB, ctx: Ctx, rng: Range):
    return schemas.BucketsOut(range=rng.out(), items=service.intent_distribution(db, ctx.workspace.id))


@router.get("/analytics/technologies", response_model=schemas.BucketsOut)
def technologies(db: DB, ctx: Ctx, rng: Range, limit: Limit = 10):
    return schemas.BucketsOut(range=rng.out(), items=service.technology_demand(db, ctx.workspace.id, rng, limit))


@router.get("/analytics/industries", response_model=schemas.BucketsOut)
def industries(db: DB, ctx: Ctx, rng: Range, limit: Limit = 10):
    return schemas.BucketsOut(range=rng.out(), items=service.industry_breakdown(db, ctx.workspace.id, limit))


@router.get("/analytics/seniority", response_model=schemas.BucketsOut)
def seniority(db: DB, ctx: Ctx, rng: Range):
    return schemas.BucketsOut(range=rng.out(), items=service.seniority_distribution(db, ctx.workspace.id))


@router.get("/analytics/score-distribution", response_model=schemas.BucketsOut)
def score_distribution(db: DB, ctx: Ctx, rng: Range):
    return schemas.BucketsOut(range=rng.out(), items=service.score_distribution(db, ctx.workspace.id))


@router.get("/analytics/recent-activity", response_model=schemas.ActivityOut)
def recent_activity(db: DB, ctx: Ctx, rng: Range, limit: Limit = 10):
    return schemas.ActivityOut(range=rng.out(), items=service.recent_activity(db, ctx.workspace.id, limit))
