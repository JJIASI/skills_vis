"""
Integration tests for MCP server tools.
Routes httpx calls through FastAPI TestClient so all 4 tools are tested
against a real SQLite store — no production server needed.
"""
import contextlib
import pytest
from pathlib import Path
from fastapi.testclient import TestClient
from unittest.mock import patch
from skills_vis.main import app
from skills_vis.usage_store import UsageStore
import skills_vis.mcp_server as mcp_module


@pytest.fixture
def tc(tmp_path: Path) -> TestClient:
    app.state.usage_store = UsageStore(tmp_path / "mcp_test.db")
    return TestClient(app)


@contextlib.contextmanager
def _patch_httpx(client: TestClient, port: int = 8001):
    """Route mcp_module's httpx calls through TestClient (no real TCP needed)."""
    def fake_post(url, **kwargs):
        return client.post(url.replace(f"http://localhost:{port}", ""), json=kwargs.get("json", {}))

    def fake_put(url, **kwargs):
        return client.put(url.replace(f"http://localhost:{port}", ""))

    def fake_get(url, **kwargs):
        return client.get(url.replace(f"http://localhost:{port}", ""))

    with patch.object(mcp_module.httpx, "post", side_effect=fake_post), \
         patch.object(mcp_module.httpx, "put", side_effect=fake_put), \
         patch.object(mcp_module.httpx, "get", side_effect=fake_get):
        yield


def test_mcp_server_module_imports():
    """MCP server module can be imported without error."""
    import skills_vis.mcp_server  # noqa: F401


def test_full_session_lifecycle_via_mcp(tc):
    """start → record × 2 → stop → history: full round-trip through REST → SQLite."""
    with _patch_httpx(tc):
        # Start
        result = mcp_module.start_recording_session_impl(agent="test-mcp", graph_root="/tmp", port=8001)
        session_id = result["session_id"]
        assert len(session_id) == 36  # UUID format

        # Record two skills
        mcp_module.record_skill_usage_impl(session_id, "brainstorming", "Brainstorming", None, port=8001)
        mcp_module.record_skill_usage_impl(session_id, "writing-plans", "Writing Plans", None, port=8001)

        # History shows event_count = 2, session not yet ended
        history = mcp_module.get_session_history_impl(port=8001)
        assert len(history) == 1
        assert history[0]["id"] == session_id
        assert history[0]["event_count"] == 2
        assert history[0]["ended_at"] is None

        # Stop
        result = mcp_module.stop_recording_session_impl(session_id, port=8001)
        assert result["ok"] is True

        # History shows session ended
        history = mcp_module.get_session_history_impl(port=8001)
        assert history[0]["ended_at"] is not None


def test_record_usage_with_unknown_session_raises(tc):
    """record_skill_usage with a bogus session_id raises httpx.HTTPStatusError."""
    import httpx
    with _patch_httpx(tc):
        with pytest.raises(httpx.HTTPStatusError):
            mcp_module.record_skill_usage_impl("nonexistent-id", "x", "X", None, port=8001)
