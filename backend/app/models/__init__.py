"""Import every model so Alembic autogenerate and relationship resolution see them."""

from app.models.alert import Alert, AlertRecipient, NotificationDelivery
from app.models.audit import AuditEvent, RateLimitBucket
from app.models.company import Company
from app.models.export import ExportJob
from app.models.job import Job, WorkerHeartbeat
from app.models.lead import HiringSignal, Lead, LeadScore, LeadSource, SavedLead
from app.models.search import SavedSearch, SavedSearchMatch, SavedSearchRun
from app.models.user import AuthSession, PasswordResetToken, User, UserPreference
from app.models.workspace import Workspace, WorkspaceInvitation, WorkspaceMembership

__all__ = [
    "Alert",
    "ExportJob",
    "Job",
    "WorkerHeartbeat",
    "AlertRecipient",
    "NotificationDelivery",
    "SavedSearch",
    "SavedSearchMatch",
    "SavedSearchRun",
    "AuditEvent",
    "AuthSession",
    "Company",
    "HiringSignal",
    "Lead",
    "LeadScore",
    "LeadSource",
    "PasswordResetToken",
    "RateLimitBucket",
    "SavedLead",
    "User",
    "UserPreference",
    "Workspace",
    "WorkspaceInvitation",
    "WorkspaceMembership",
]
