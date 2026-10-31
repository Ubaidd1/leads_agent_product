"""Background worker: python -m app.tasks.worker

Claims due jobs (FOR UPDATE SKIP LOCKED), runs their handlers, retries with backoff, and dead-letters
jobs that keep failing. One instance at a time (Postgres advisory lock) also runs the scheduler loop.
Shuts down cleanly on SIGTERM/SIGINT after the current job.
"""

import logging
import os
import signal
import socket
import time
import uuid
from datetime import timedelta

from sqlalchemy.dialects.postgresql import insert

from app.core.config import get_settings
from app.core.logging import configure_logging
from app.db.session import SessionLocal
from app.models import WorkerHeartbeat
from app.tasks import (
    handlers,  # noqa: F401 - registers job handlers
    queue,
)
from app.utils.time import utcnow

logger = logging.getLogger("app.worker")

POLL_SECONDS = 1.0
SCHEDULER_EVERY = timedelta(seconds=60)
STUCK_CHECK_EVERY = timedelta(minutes=1)


class Worker:
    def __init__(self):
        self.worker_id = f"{socket.gethostname()}:{os.getpid()}:{uuid.uuid4().hex[:6]}"
        self.started_at = utcnow()
        self.stopping = False
        self.next_schedule = utcnow()
        self.next_stuck_check = utcnow()
        self.scheduler_db = None  # holds the advisory lock for the scheduler role

    def stop(self, *_):
        logger.info("Shutdown requested; finishing current job", extra={"worker_id": self.worker_id})
        self.stopping = True

    def heartbeat(self, db):
        db.execute(
            insert(WorkerHeartbeat)
            .values(worker_id=self.worker_id, started_at=self.started_at, last_seen_at=utcnow())
            .on_conflict_do_update(index_elements=["worker_id"], set_={"last_seen_at": utcnow()})
        )
        db.commit()

    def maybe_schedule(self):
        if utcnow() < self.next_schedule:
            return
        self.next_schedule = utcnow() + SCHEDULER_EVERY
        if self.scheduler_db is None:
            db = SessionLocal()
            if queue.try_scheduler_lock(db):
                self.scheduler_db = db
                logger.info("This worker runs the scheduler", extra={"worker_id": self.worker_id})
            else:
                db.close()
                return
        with SessionLocal() as db:
            handlers.schedule_due(db)

    def run(self):
        signal.signal(signal.SIGTERM, self.stop)
        signal.signal(signal.SIGINT, self.stop)
        logger.info("Worker started", extra={"worker_id": self.worker_id})
        try:
            while not self.stopping:
                with SessionLocal() as db:
                    self.heartbeat(db)
                    if utcnow() >= self.next_stuck_check:
                        self.next_stuck_check = utcnow() + STUCK_CHECK_EVERY
                        if requeued := queue.requeue_stuck(db):
                            logger.warning("Requeued stuck jobs", extra={"count": requeued})
                    self.maybe_schedule()
                    job = queue.claim(db, self.worker_id)
                    if job is None:
                        time.sleep(POLL_SECONDS)
                        continue
                    logger.info("Running job", extra={"job_id": str(job.id), "kind": job.kind})
                    status = queue.run_one(db, job)
                    logger.info("Job finished", extra={"job_id": str(job.id), "kind": job.kind, "status": status})
        finally:
            if self.scheduler_db is not None:
                self.scheduler_db.close()  # releases the advisory lock
            logger.info("Worker stopped", extra={"worker_id": self.worker_id})


def main():
    configure_logging(get_settings().log_level)
    Worker().run()


if __name__ == "__main__":
    main()
