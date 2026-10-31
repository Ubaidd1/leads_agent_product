from enum import StrEnum

from sqlalchemy import Enum


class Role(StrEnum):
    OWNER = "owner"
    ADMIN = "admin"
    MEMBER = "member"


class HiringIntent(StrEnum):
    STRONG = "strong"
    MEDIUM = "medium"
    LOW = "low"


class VerificationStatus(StrEnum):
    UNVERIFIED = "unverified"
    VERIFIED = "verified"
    HIGH_CONFIDENCE = "high_confidence"


class LeadStatus(StrEnum):
    OPEN = "open"
    CLOSED = "closed"


class SearchFrequency(StrEnum):
    MANUAL = "manual"
    INSTANT = "instant"
    DAILY = "daily"
    WEEKLY = "weekly"


class LastRunStatus(StrEnum):
    NEVER = "never"
    SUCCEEDED = "succeeded"
    FAILED = "failed"


class RunTrigger(StrEnum):
    MANUAL = "manual"
    SCHEDULED = "scheduled"


class RunStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"


class AlertType(StrEnum):
    SAVED_SEARCH_MATCHES = "saved_search_matches"
    COMPANY_SIGNAL = "company_signal"
    DIGEST = "digest"


class DeliveryChannel(StrEnum):
    IN_APP = "in_app"
    EMAIL = "email"
    SLACK = "slack"
    WEBHOOK = "webhook"


class DeliveryStatus(StrEnum):
    PENDING = "pending"
    SENT = "sent"
    FAILED = "failed"
    SKIPPED = "skipped"


def str_enum(enum_cls: type[StrEnum], name: str) -> Enum:
    """Store enum values as VARCHAR + CHECK constraint (easier to evolve than native PG enums)."""
    return Enum(
        enum_cls,
        name=name,
        native_enum=False,
        create_constraint=True,
        length=32,
        values_callable=lambda cls: [member.value for member in cls],
    )
