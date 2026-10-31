def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert response.headers["X-Request-ID"]
    assert response.headers["X-Content-Type-Options"] == "nosniff"


def test_ready_reports_database_and_migrations(client):
    response = client.get("/ready")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok" and body["checks"] == {"database": "ok", "migrations": "ok"}


def test_ready_warns_about_the_worker_without_failing(client, db):
    from datetime import timedelta

    from app.models import WorkerHeartbeat
    from app.utils.time import utcnow

    assert client.get("/ready").json()["warnings"] == {"worker": "not_running"}
    beat = WorkerHeartbeat(worker_id="w1", started_at=utcnow(), last_seen_at=utcnow() - timedelta(minutes=5))
    db.add(beat)
    db.commit()
    response = client.get("/ready")
    assert response.status_code == 200 and response.json()["warnings"] == {"worker": "stale"}
    beat.last_seen_at = utcnow()
    db.commit()
    assert client.get("/ready").json()["warnings"] == {"worker": "ok"}


def test_request_id_is_propagated(client):
    response = client.get("/health", headers={"X-Request-ID": "abc123"})
    assert response.headers["X-Request-ID"] == "abc123"
