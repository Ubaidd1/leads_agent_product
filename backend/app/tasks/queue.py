"""PostgreSQL job queue (decision D3.1): FOR UPDATE SKIP LOCKED, no extra infrastructure.

Jobs are enqueued in the same transaction as the data they act on. Delivery is at-least-once, so
handlers must be idempotent (stable keys, unique constraints, status checks before side effects).
"""

import logging
import random
import uuid
from collections.abc import Callable
from datetime import datetime, timedelta

from sqlalchemy import select, text, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models import Job
from app.models.enums import JobStatus
from app.utils.time import utcnow

logger = logging.getLogger(__name__)

BASE_BACKOFF_SECONDS = 30
MAX_BACKOFF_SECONDS = 3600
JITTER = 0.2
STUCK_AFTER = timedelta(minutes=15)

Handler = Callable[[Session, Job], None]
HANDLERS: dict[str, Handler] = {}


class PermanentJobError(Exception):
    """Raise from a handler when retrying cannot help (bad input, revoked permission): the job goes dead now."""


def handler(kind: str) -> Callable[[Handler], Handler]:
    def register(func: Handler) -> Handler:
        HANDLERS[kind] = func
        return func

    return register


def enqueue(
    db: Session,
    kind: str,
    payload: dict | None = None,
    *,
    workspace_id: uuid.UUID | None = None,
    idempotency_key: str | None = None,
    run_at: datetime | None = None,
    max_attempts: int = 5,
) -> uuid.UUID:
    """Adds a job to the current transaction. With an idempotency key, a repeat returns the existing job's id."""
    values = {
        "id": uuid.uuid4(),
        "kind": kind,
        "payload": payload or {},
        "workspace_id": workspace_id,
        "status": JobStatus.QUEUED,
        "run_at": run_at or utcnow(),
        "attempts": 0,
        "max_attempts": max_attempts,
        "idempotency_key": idempotency_key,
    }
    stmt = insert(Job).values(**values)
    if idempotency_key:
        stmt = stmt.on_conflict_do_nothing(index_elements=["idempotency_key"])
    job_id = db.scalar(stmt.returning(Job.id))
    if job_id is None:
        job_id = db.scalar(select(Job.id).where(Job.idempotency_key == idempotency_key))
    return job_id


def claim(db: Session, worker_id: str) -> Job | None:
    """Atomically takes the oldest due job. Two workers never get the same job. Commits."""
    due = (
        select(Job.id)
        .where(Job.status == JobStatus.QUEUED, Job.run_at <= utcnow())
        .order_by(Job.run_at, Job.created_at)
        .limit(1)
        .with_for_update(skip_locked=True)
        .scalar_subquery()
    )
    job = db.scalar(
        update(Job)
        .where(Job.id == due)
        .values(status=JobStatus.RUNNING, locked_by=worker_id, locked_at=utcnow(), attempts=Job.attempts + 1)
        .returning(Job)
    )
    db.commit()
    return job


def backoff(attempts: int, rng: random.Random | None = None) -> timedelta:
    """min(2^attempts × 30 s, 1 h) ± 20 % jitter."""
    base = min((2**attempts) * BASE_BACKOFF_SECONDS, MAX_BACKOFF_SECONDS)
    spread = (rng or random).uniform(-JITTER, JITTER)  # noqa: S311 - jitter, not security
    return timedelta(seconds=base * (1 + spread))


def _safe_error(exc: BaseException) -> str:
    return f"{type(exc).__name__}: {str(exc)[:500]}"


def run_one(db: Session, job: Job) -> JobStatus:
    """Runs a claimed job's handler and records the outcome. Commits."""
    func = HANDLERS.get(job.kind)
    try:
        if func is None:
            raise PermanentJobError(f"No handler registered for job kind {job.kind!r}")
        func(db, job)
        job.status = JobStatus.SUCCEEDED
        job.finished_at = utcnow()
        job.last_error = None
    except Exception as exc:
        db.rollback()
        job = db.get(Job, job.id)
        job.last_error = _safe_error(exc)
        if isinstance(exc, PermanentJobError) or job.attempts >= job.max_attempts:
            job.status = JobStatus.DEAD
            job.finished_at = utcnow()
            logger.error("Job is dead", extra={"job_id": str(job.id), "kind": job.kind, "attempts": job.attempts})
        else:
            job.status = JobStatus.QUEUED
            job.run_at = utcnow() + backoff(job.attempts)
            logger.warning("Job failed; retrying", extra={"job_id": str(job.id), "kind": job.kind})
    job.locked_by = None
    job.locked_at = None
    db.commit()
    return job.status


def requeue_stuck(db: Session) -> int:
    """Jobs locked longer than STUCK_AFTER belong to a crashed worker; put them back. Commits."""
    result = db.execute(
        update(Job)
        .where(Job.status == JobStatus.RUNNING, Job.locked_at < utcnow() - STUCK_AFTER)
        .values(status=JobStatus.QUEUED, locked_by=None, locked_at=None, run_at=utcnow())
    )
    db.commit()
    return result.rowcount


def try_scheduler_lock(db: Session) -> bool:
    """Session-level advisory lock so only one worker runs the scheduler loop."""
    return bool(db.scalar(text("SELECT pg_try_advisory_lock(hashtext('hiring-intel-scheduler'))")))
