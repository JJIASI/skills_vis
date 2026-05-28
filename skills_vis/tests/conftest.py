from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from skills_vis.main import app


@pytest.fixture
def sample_root(tmp_path: Path) -> Path:
    root = tmp_path / "skills"
    (root / "nested").mkdir(parents=True)
    (root / "nested" / "SKILL.md").write_text("# Skill", encoding="utf-8")
    (root / "notes.md").write_text("# Notes", encoding="utf-8")
    return root


@pytest.fixture
def client() -> TestClient:
    app.state.active_root = None
    # avoid leaking a DB path between tests; tests should set this explicitly when needed
    app.state.skills_db_path = None
    return TestClient(app)
