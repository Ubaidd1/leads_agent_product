"""Job handlers and the scheduler's periodic work. Importing this module registers every handler."""

import logging
from datetime import timedelta

from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.models import AuthSession, PasswordResetToken
from app.services import (
    exports,  # noqa: F401 - registers "export.generate"
    rate_limit,
)
from app.tasks import queue
from app.utils.time import utcnow

logger = logging.getLogger(__name__)


@queue.handler("maintenance.cleanup")
def cleanup(db: Session, job) -> None:
    """Daily: expired exports, long-expired sessions and used/expired reset tokens, old rate-limit buckets."""
    now = utcnow()
    expired_exports = exports.expire_old(db)
    sessions = db.execute(delete(AuthSession).where(AuthSession.expires_at < now - timedelta(days=30))).rowcount
    tokens = db.execute(delete(PasswordResetToken).where(PasswordResetToken.expires_at < now)).rowcount
    db.commit()
    rate_limit.purge_expired(db)
    logger.info("Cleanup done", extra={"exports": expired_exports, "sessions": sessions, "reset_tokens": tokens})


def schedule_due(db: Session) -> None:
    """Runs every minute on one worker. Idempotency keys make repeated scheduling harmless."""
    today = utcnow().date().isoformat()
    queue.enqueue(db, "maintenance.cleanup", idempotency_key=f"cleanup:{today}")
    db.commit()
