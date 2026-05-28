import asyncio
import json as _json
import pytest
from pathlib import Path
from fastapi.testclient import TestClient
from skills_vis.main import app
from skills_vis.usage_store import UsageStore


@pytest.fixture
def client(tmp_path: Path) -> TestClient:
    app.state.usage_store = UsageStore(tmp_path / "usage.db")
    return TestClient(app)


def test_post_sessions_returns_session_id(client):
    resp = client.post("/api/usage/sessions", json={})
    assert resp.status_code == 200
    data = resp.json()
    assert "session_id" in data
    assert len(data["session_id"]) == 36


def test_post_sessions_with_agent_and_root(client):
    resp = client.post(
        "/api/usage/sessions",
        json={"agent": "copilot-cli", "graph_root": "/tmp/skills"},
    )
    assert resp.status_code == 200
    sid = resp.json()["session_id"]
    sessions = client.get("/api/usage/sessions").json()
    assert sessions[0]["id"] == sid
    assert sessions[0]["agent"] == "copilot-cli"
    assert sessions[0]["graph_root"] == "/tmp/skills"


def test_put_stop_session(client):
    sid = client.post("/api/usage/sessions", json={}).json()["session_id"]
    resp = client.put(f"/api/usage/sessions/{sid}/stop")
    assert resp.status_code == 200
    assert resp.json()["ok"] is True
    sessions = client.get("/api/usage/sessions").json()
    assert sessions[0]["ended_at"] is not None


def test_put_stop_idempotent(client):
    sid = client.post("/api/usage/sessions", json={}).json()["session_id"]
    client.put(f"/api/usage/sessions/{sid}/stop")
    resp = client.put(f"/api/usage/sessions/{sid}/stop")
    assert resp.status_code == 200


def test_post_record_with_valid_session(client):
    sid = client.post("/api/usage/sessions", json={}).json()["session_id"]
    resp = client.post(
        "/api/usage/record",
        json={"session_id": sid, "skill_path": "brainstorming", "skill_name": "Brainstorming"},
    )
    assert resp.status_code == 200
    assert resp.json()["ok"] is True
    assert isinstance(resp.json().get("event_id"), int)


def test_post_record_auto_creates_session_when_sid_omitted(client):
    resp = client.post(
        "/api/usage/record",
        json={"skill_path": "brainstorming", "skill_name": "Brainstorming"},
    )
    assert resp.status_code == 200
    sessions = client.get("/api/usage/sessions").json()
    assert len(sessions) == 1


def test_post_record_returns_404_for_unknown_session(client):
    resp = client.post(
        "/api/usage/record",
        json={"session_id": "bad-id", "skill_path": "x", "skill_name": "X"},
    )
    assert resp.status_code == 404


def test_get_sessions_returns_list(client):
    client.post("/api/usage/sessions", json={"agent": "test"})
    client.post("/api/usage/sessions", json={"agent": "test2"})
    resp = client.get("/api/usage/sessions")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


def test_get_session_events(client):
    sid = client.post("/api/usage/sessions", json={}).json()["session_id"]
    client.post(
        "/api/usage/record",
        json={"session_id": sid, "skill_path": "brainstorming", "skill_name": "Brainstorming"},
    )
    resp = client.get(f"/api/usage/sessions/{sid}/events")
    assert resp.status_code == 200
    events = resp.json()
    assert len(events) == 1
    assert events[0]["skill_path"] == "brainstorming"
    assert events[0]["skill_name"] == "Brainstorming"


def test_get_usage_stream_returns_sse_content_type(tmp_path):
    """GET /api/usage/stream returns text/event-stream and delivers events."""
    from skills_vis.main import app, usage_stream
    from skills_vis.usage_store import UsageStore

    store = UsageStore(tmp_path / "sse.db")
    app.state.usage_store = store

    sid = store.create_session(None, None)
    received = []

    async def run():
        resp = await usage_stream(session_id=sid)
        # Verify media type
        assert resp.media_type == "text/event-stream"

        async def record():
            await asyncio.sleep(0.05)
            store.record_event(sid, "brainstorming", "Brainstorming", None)

        task = asyncio.create_task(record())
        async for chunk in resp.body_iterator:
            if chunk.startswith("data:"):
                received.append(_json.loads(chunk[len("data:"):].strip()))
                break
        await task

    asyncio.run(run())

    assert len(received) == 1
    assert received[0]["skill_path"] == "brainstorming"
    assert received[0]["session_id"] == sid


def test_get_usage_stream_filters_by_session_id(tmp_path):
    """SSE stream delivers only events matching the ?session_id= filter."""
    from skills_vis.main import app, usage_stream
    from skills_vis.usage_store import UsageStore

    store = UsageStore(tmp_path / "sse2.db")
    app.state.usage_store = store

    sid1 = store.create_session(None, None)
    sid2 = store.create_session(None, None)
    received = []

    async def run():
        resp = await usage_stream(session_id=sid1)

        async def record():
            await asyncio.sleep(0.05)
            # Should be filtered out — belongs to sid2
            store.record_event(sid2, "other", "Other", None)
            await asyncio.sleep(0.05)
            # Should arrive — belongs to sid1
            store.record_event(sid1, "brainstorming", "Brainstorming", None)

        task = asyncio.create_task(record())
        async for chunk in resp.body_iterator:
            if chunk.startswith("data:"):
                received.append(_json.loads(chunk[len("data:"):].strip()))
                break
        await task

    asyncio.run(run())

    assert len(received) == 1
    assert received[0]["session_id"] == sid1
    assert received[0]["skill_path"] == "brainstorming"


def test_delete_session_removes_session_and_events(client):
    sid = client.post("/api/usage/sessions", json={}).json()["session_id"]
    client.post("/api/usage/record", json={"session_id": sid, "skill_path": "x", "skill_name": "X"})
    resp = client.delete(f"/api/usage/sessions/{sid}")
    assert resp.status_code == 200
    assert resp.json()["ok"] is True
    assert client.get("/api/usage/sessions").json() == []
    assert client.get(f"/api/usage/sessions/{sid}/events").json() == []


def test_delete_session_returns_404_for_unknown_session(client):
    resp = client.delete("/api/usage/sessions/nonexistent-id")
    assert resp.status_code == 404
