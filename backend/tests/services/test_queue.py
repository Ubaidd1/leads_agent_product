import random
from datetime import timedelta

import pytest
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models import Job
from app.models.enums import JobStatus
from app.tasks import queue
from app.utils.time import utcnow


@pytest.fixture
def registered(monkeypatch):
    calls = []
    monkeypatch.setitem(queue.HANDLERS, "test.ok", lambda db, job: calls.append(job.payload))

    def boom(db, job):
        raise RuntimeError("provider timeout")

    def permanent(db, job):
        raise queue.PermanentJobError("revoked")

    monkeypatch.setitem(queue.HANDLERS, "test.boom", boom)
    monkeypatch.setitem(queue.HANDLERS, "test.permanent", permanent)
    return calls


def test_backoff_is_exponential_capped_and_jittered():
    rng = random.Random(1)  # noqa: S311 - deterministic jitter for the test
    for attempts, base in [(1, 60), (2, 120), (5, 960), (7, 3600), (20, 3600)]:
        value = queue.backoff(attempts, rng).total_seconds()
        assert base * 0.8 <= value <= base * 1.2


def test_success(db, registered):
    queue.enqueue(db, "test.ok", {"n": 1})
    db.commit()
    job = queue.claim(db, "w1")
    assert job.status == JobStatus.RUNNING and job.attempts == 1 and job.locked_by == "w1"
    assert queue.run_one(db, job) == JobStatus.SUCCEEDED
    assert registered == [{"n": 1}] and job.finished_at is not None and job.locked_by is None
    assert queue.claim(db, "w1") is None


def test_retries_with_backoff_then_dead_letters(db, registered):
    queue.enqueue(db, "test.boom", max_attempts=2)
    db.commit()
    job = queue.claim(db, "w1")
    assert queue.run_one(db, job) == JobStatus.QUEUED
    assert job.run_at > utcnow() + timedelta(seconds=40) and "provider timeout" in job.last_error
    assert queue.claim(db, "w1") is None  # not due yet
    job.run_at = utcnow() - timedelta(seconds=1)
    db.commit()
    job = queue.claim(db, "w1")
    assert job.attempts == 2
    assert queue.run_one(db, job) == JobStatus.DEAD


def test_permanent_errors_and_unknown_kinds_go_dead_immediately(db, registered):
    queue.enqueue(db, "test.permanent")
    queue.enqueue(db, "test.unknown")
    db.commit()
    assert queue.run_one(db, queue.claim(db, "w1")) == JobStatus.DEAD
    assert queue.run_one(db, queue.claim(db, "w1")) == JobStatus.DEAD


def test_idempotency_key_returns_existing_job(db):
    first = queue.enqueue(db, "test.ok", idempotency_key="k-1")
    second = queue.enqueue(db, "test.ok", idempotency_key="k-1")
    assert first == second
    assert len(list(db.scalars(select(Job).where(Job.idempotency_key == "k-1")))) == 1


def test_stuck_jobs_are_requeued(db):
    queue.enqueue(db, "test.ok")
    db.commit()
    job = queue.claim(db, "crashed-worker")
    job.locked_at = utcnow() - timedelta(minutes=20)
    db.commit()
    assert queue.requeue_stuck(db) == 1
    db.refresh(job)
    assert job.status == JobStatus.QUEUED and job.locked_by is None


def test_two_workers_never_claim_the_same_job(engine):
    with Session(engine) as setup:
        ids = [queue.enqueue(setup, "test.concurrency", idempotency_key=f"conc-{i}") for i in range(2)]
        setup.commit()
    try:
        with Session(engine) as a, Session(engine) as b:
            # Hold A's claim open (no commit) to prove B skips the locked row instead of waiting or duplicating.
            due = select(Job).where(Job.id.in_(ids)).order_by(Job.created_at).limit(1).with_for_update(skip_locked=True)
            held = a.scalar(due)
            other = b.scalar(due)
            assert held is not None and other is not None and held.id != other.id
            a.rollback()
            b.rollback()
    finally:
        with Session(engine) as cleanup:
            cleanup.execute(delete(Job).where(Job.id.in_(ids)))
            cleanup.commit()
