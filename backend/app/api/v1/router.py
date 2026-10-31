from fastapi import APIRouter

from app.api.v1.endpoints import alerts, analytics, auth, companies, leads, me, saved_searches, workspace

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(me.router)
api_router.include_router(workspace.router)
api_router.include_router(leads.router)
api_router.include_router(companies.router)
api_router.include_router(saved_searches.router)
api_router.include_router(alerts.router)
api_router.include_router(analytics.router)
