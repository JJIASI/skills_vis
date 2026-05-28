import asyncio
import pytest
from pathlib import Path
from skills_vis.usage_store import UsageStore


@pytest.fixture
def store(tmp_path: Path) -> UsageStore:
    return UsageStore(tmp_path / "test_usage.db")


def test_create_session_returns_uuid(store):
    sid = store.create_session(agent="test-agent", graph_root="/tmp/skills")
    assert isinstance(sid, str) and len(sid) == 36  # UUID format


def test_create_session_stores_fields(store):
    sid = store.create_session(agent="copilot-cli", graph_root="/tmp/root")
    sessions = store.list_sessions()
    assert len(sessions) == 1
    s = sessions[0]
    assert s["id"] == sid
    assert s["agent"] == "copilot-cli"
    assert s["graph_root"] == "/tmp/root"
    assert s["ended_at"] is None
    assert s["event_count"] == 0


def test_create_session_accepts_none_fields(store):
    sid = store.create_session(agent=None, graph_root=None)
    s = store.list_sessions()[0]
    assert s["id"] == sid
    assert s["agent"] is None


def test_stop_session_sets_ended_at(store):
    sid = store.create_session(agent=None, graph_root=None)
    store.stop_session(sid)
    s = store.list_sessions()[0]
    assert s["ended_at"] is not None


def test_stop_session_idempotent(store):
    sid = store.create_session(agent=None, graph_root=None)
    store.stop_session(sid)
    first_ended = store.list_sessions()[0]["ended_at"]
    store.stop_session(sid)  # second call must not raise
    assert store.list_sessions()[0]["ended_at"] == first_ended


def test_record_event_with_valid_session(store):
    sid = store.create_session(agent=None, graph_root=None)
    event_id = store.record_event(sid, "/path/brainstorming/SKILL.md", "Brainstorming", None)
    assert isinstance(event_id, int)
    events = store.get_events(sid)
    assert len(events) == 1
    e = events[0]
    assert e["skill_path"] == "/path/brainstorming/SKILL.md"
    assert e["skill_name"] == "Brainstorming"
    assert e["metadata"] is None


def test_record_event_with_metadata(store):
    sid = store.create_session(agent=None, graph_root=None)
    store.record_event(sid, "brainstorming", "Brainstorming", {"step": "design"})
    events = store.get_events(sid)
    assert events[0]["metadata"] == '{"step": "design"}'


def test_record_event_auto_creates_session_when_sid_omitted(store):
    event_id = store.record_event(None, "brainstorming", "Brainstorming", None)
    assert isinstance(event_id, int)
    sessions = store.list_sessions()
    assert len(sessions) == 1  # anonymous session auto-created


def test_record_event_raises_key_error_for_unknown_sid(store):
    with pytest.raises(KeyError):
        store.record_event("nonexistent-id", "brainstorming", "Brainstorming", None)


def test_list_sessions_ordered_newest_first(store):
    import time
    s1 = store.create_session(agent="a", graph_root=None)
    time.sleep(0.01)
    s2 = store.create_session(agent="b", graph_root=None)
    ids = [s["id"] for s in store.list_sessions()]
    assert ids == [s2, s1]


def test_list_sessions_includes_event_count(store):
    sid = store.create_session(agent=None, graph_root=None)
    store.record_event(sid, "a", "A", None)
    store.record_event(sid, "b", "B", None)
    s = store.list_sessions()[0]
    assert s["event_count"] == 2


def test_subscribe_receives_recorded_event(store):
    sid = store.create_session(agent=None, graph_root=None)
    q = store.subscribe()
    store.record_event(sid, "brainstorming", "Brainstorming", None)
    event = q.get_nowait()
    assert event["skill_path"] == "brainstorming"
    assert event["session_id"] == sid


def test_unsubscribe_stops_receiving_events(store):
    sid = store.create_session(agent=None, graph_root=None)
    q = store.subscribe()
    store.unsubscribe(q)
    store.record_event(sid, "brainstorming", "Brainstorming", None)
    assert q.empty()


def test_record_event_without_sid_uses_existing_open_session(store):
    sid = store.create_session(agent="ui", graph_root=None)
    store.record_event(None, "skill-a", "skill-a", None)
    store.record_event(None, "skill-b", "skill-b", None)
    sessions = store.list_sessions()
    assert len(sessions) == 1
    assert sessions[0]["id"] == sid
    assert sessions[0]["event_count"] == 2


def test_record_event_without_sid_creates_new_session_when_all_are_stopped(store):
    sid = store.create_session(agent="ui", graph_root=None)
    store.stop_session(sid)
    store.record_event(None, "skill-a", "skill-a", None)
    sessions = store.list_sessions()
    assert len(sessions) == 2
    open_sessions = [s for s in sessions if s["ended_at"] is None]
    assert len(open_sessions) == 1
    assert open_sessions[0]["id"] != sid


def test_record_event_without_sid_picks_most_recent_open_session(store):
    import time
    s1 = store.create_session(agent="a", graph_root=None)
    time.sleep(0.01)
    s2 = store.create_session(agent="b", graph_root=None)
    store.record_event(None, "skill-a", "skill-a", None)
    assert len(store.get_events(s2)) == 1
    assert len(store.get_events(s1)) == 0
