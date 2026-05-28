"""API endpoint tests for the FastAPI backend."""
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


# ---------------------------------------------------------------------------
# Read-only endpoint tests
# ---------------------------------------------------------------------------

def test_get_tree_returns_nested_json(client: TestClient, sample_root: Path):
    resp = client.get("/api/tree", params={"path": str(sample_root)})
    assert resp.status_code == 200
    data = resp.json()
    assert data["type"] == "folder"
    assert data["name"] == "skills"
    names = {c["name"] for c in data["children"]}
    assert "nested" in names
    assert "notes.md" in names


def test_get_tree_returns_404_for_missing_root(client: TestClient, tmp_path: Path):
    missing = str(tmp_path / "nonexistent_dir")
    resp = client.get("/api/tree", params={"path": missing})
    assert resp.status_code == 404


def test_get_tree_set_root_false_does_not_overwrite_active_root(client: TestClient, sample_root: Path):
    # Load workspace root
    client.get("/api/tree", params={"path": str(sample_root)})
    # Fetch a subtree without updating the root
    subfolder = str(sample_root / "nested")
    resp = client.get("/api/tree", params={"path": subfolder, "set_root": "false"})
    assert resp.status_code == 200
    # active_root must still be the original workspace root, not the subfolder
    root_resp = client.get("/api/active_root")
    assert root_resp.json()["path"] == str(sample_root)


def test_get_tree_set_root_false_rejects_path_outside_active_root(client: TestClient, sample_root: Path, tmp_path: Path):
    # Load workspace root
    client.get("/api/tree", params={"path": str(sample_root)})
    # Try to fetch a subtree outside the active root
    outside = str(tmp_path)
    resp = client.get("/api/tree", params={"path": outside, "set_root": "false"})
    assert resp.status_code == 400


def test_get_file_returns_text_payload(client: TestClient, sample_root: Path):
    # First load the tree to set active root
    client.get("/api/tree", params={"path": str(sample_root)})
    target = str(sample_root / "notes.md")
    resp = client.get("/api/file", params={"path": target})
    assert resp.status_code == 200
    data = resp.json()
    assert data["kind"] == "text"
    assert "Notes" in data["content"]


def test_get_file_returns_415_for_binary_or_oversize_content(
    client: TestClient, sample_root: Path
):
    # Write a binary file (contains null bytes)
    binary_file = sample_root / "image.bin"
    binary_file.write_bytes(b"\x00\x01\x02\x03" * 256)
    client.get("/api/tree", params={"path": str(sample_root)})
    resp = client.get("/api/file", params={"path": str(binary_file)})
    assert resp.status_code == 415


def test_get_file_returns_400_for_path_outside_active_root(
    client: TestClient, sample_root: Path, tmp_path: Path
):
    client.get("/api/tree", params={"path": str(sample_root)})
    outside_file = tmp_path / "outside.txt"
    outside_file.write_text("outside", encoding="utf-8")
    resp = client.get("/api/file", params={"path": str(outside_file)})
    assert resp.status_code == 400


def test_require_active_root_falls_back_to_cwd(
    client: TestClient, tmp_path: Path, monkeypatch
):
    """When active_root is None, file endpoints use Path.cwd() as root."""
    monkeypatch.chdir(tmp_path)
    test_file = tmp_path / "hello.txt"
    test_file.write_text("hello from cwd", encoding="utf-8")
    # No active_root set — fixture resets it to None
    resp = client.get("/api/file", params={"path": str(test_file)})
    assert resp.status_code == 200
    assert resp.json()["content"] == "hello from cwd"


def test_get_file_returns_400_for_path_outside_fallback_cwd(
    client: TestClient, sample_root: Path, tmp_path: Path, monkeypatch
):
    # Pin cwd to a directory that cannot be an ancestor of sample_root
    safe_cwd = tmp_path / "cwd_anchor"
    safe_cwd.mkdir()
    monkeypatch.chdir(safe_cwd)
    # active_root is None → falls back to safe_cwd
    # sample_root is outside safe_cwd, so it should be rejected
    target = str(sample_root / "notes.md")
    resp = client.get("/api/file", params={"path": target})
    assert resp.status_code == 400


# ---------------------------------------------------------------------------
# Mutation endpoint tests
# ---------------------------------------------------------------------------

def test_put_file_updates_text_content(client: TestClient, sample_root: Path):
    client.get("/api/tree", params={"path": str(sample_root)})
    target = str(sample_root / "notes.md")
    resp = client.put("/api/file", json={"path": target, "content": "updated"})
    assert resp.status_code == 200
    assert (sample_root / "notes.md").read_text() == "updated"


def test_post_rename_changes_file_name(client: TestClient, sample_root: Path):
    client.get("/api/tree", params={"path": str(sample_root)})
    old = str(sample_root / "notes.md")
    resp = client.post("/api/rename", json={"old": old, "new": "renamed.md"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "renamed.md"
    assert (sample_root / "renamed.md").exists()


def test_post_rename_changes_folder_name(client: TestClient, sample_root: Path):
    client.get("/api/tree", params={"path": str(sample_root)})
    old = str(sample_root / "nested")
    resp = client.post("/api/rename", json={"old": old, "new": "renamed_folder"})
    assert resp.status_code == 200
    assert (sample_root / "renamed_folder").is_dir()


def test_post_rename_rejects_nested_or_absolute_new_values(
    client: TestClient, sample_root: Path
):
    client.get("/api/tree", params={"path": str(sample_root)})
    old = str(sample_root / "notes.md")
    # Nested path separator
    resp = client.post("/api/rename", json={"old": old, "new": "sub/name.md"})
    assert resp.status_code == 400
    # Absolute path
    resp2 = client.post("/api/rename", json={"old": old, "new": "/absolute/name.md"})
    assert resp2.status_code == 400


def test_post_rename_rejects_existing_destination(client: TestClient, sample_root: Path):
    client.get("/api/tree", params={"path": str(sample_root)})
    # nested already exists as a folder; trying to rename notes.md to "nested" should conflict
    old = str(sample_root / "notes.md")
    resp = client.post("/api/rename", json={"old": old, "new": "nested"})
    assert resp.status_code == 409


def test_post_create_file_creates_a_new_file(client: TestClient, sample_root: Path):
    client.get("/api/tree", params={"path": str(sample_root)})
    new_path = str(sample_root / "new_file.txt")
    resp = client.post("/api/create/file", json={"path": new_path, "content": "hello"})
    assert resp.status_code == 201
    assert (sample_root / "new_file.txt").read_text() == "hello"


def test_post_create_file_rejects_existing_path(client: TestClient, sample_root: Path):
    client.get("/api/tree", params={"path": str(sample_root)})
    existing = str(sample_root / "notes.md")
    resp = client.post("/api/create/file", json={"path": existing, "content": ""})
    assert resp.status_code == 409


def test_post_create_folder_creates_a_new_folder(client: TestClient, sample_root: Path):
    client.get("/api/tree", params={"path": str(sample_root)})
    new_folder = str(sample_root / "new_folder")
    resp = client.post("/api/create/folder", json={"path": new_folder})
    assert resp.status_code == 201
    assert (sample_root / "new_folder").is_dir()


def test_post_create_folder_rejects_existing_path(client: TestClient, sample_root: Path):
    client.get("/api/tree", params={"path": str(sample_root)})
    existing = str(sample_root / "nested")
    resp = client.post("/api/create/folder", json={"path": existing})
    assert resp.status_code == 409


def test_delete_file_removes_a_file(client: TestClient, sample_root: Path):
    client.get("/api/tree", params={"path": str(sample_root)})
    target = str(sample_root / "notes.md")
    resp = client.delete("/api/file", params={"path": target})
    assert resp.status_code == 204
    assert not (sample_root / "notes.md").exists()


def test_delete_folder_removes_directory(client: TestClient, sample_root: Path):
    client.get("/api/tree", params={"path": str(sample_root)})
    target = str(sample_root / "nested")
    resp = client.delete("/api/folder", params={"path": target})
    assert resp.status_code == 204
    assert not (sample_root / "nested").exists()


def test_mutation_endpoints_return_404_for_missing_paths(
    client: TestClient, sample_root: Path
):
    client.get("/api/tree", params={"path": str(sample_root)})
    ghost = str(sample_root / "ghost.txt")

    resp = client.put("/api/file", json={"path": ghost, "content": "x"})
    assert resp.status_code == 404

    resp = client.post("/api/rename", json={"old": ghost, "new": "other.txt"})
    assert resp.status_code == 404

    resp = client.delete("/api/file", params={"path": ghost})
    assert resp.status_code == 404

    ghost_folder = str(sample_root / "ghost_dir")
    resp = client.delete("/api/folder", params={"path": ghost_folder})
    assert resp.status_code == 404


def test_mutation_endpoints_return_400_for_paths_outside_fallback_cwd(
    client: TestClient, sample_root: Path, tmp_path: Path, monkeypatch
):
    # Pin cwd to a directory that cannot be an ancestor of sample_root
    safe_cwd = tmp_path / "cwd_anchor"
    safe_cwd.mkdir()
    monkeypatch.chdir(safe_cwd)
    # active_root is None → falls back to safe_cwd
    # sample_root is outside safe_cwd, so it should be rejected
    target = str(sample_root / "notes.md")

    assert client.put("/api/file", json={"path": target, "content": "x"}).status_code == 400
    assert client.post("/api/rename", json={"old": target, "new": "x.md"}).status_code == 400
    assert client.post("/api/create/file", json={"path": target, "content": ""}).status_code == 400
    assert client.post("/api/create/folder", json={"path": target}).status_code == 400
    assert client.delete("/api/file", params={"path": target}).status_code == 400
    assert client.delete("/api/folder", params={"path": target}).status_code == 400


def test_mutation_endpoints_reject_paths_outside_active_root(
    client: TestClient, sample_root: Path, tmp_path: Path
):
    client.get("/api/tree", params={"path": str(sample_root)})

    outside = str(tmp_path / "outside.txt")
    Path(outside).write_text("x", encoding="utf-8")

    assert client.put("/api/file", json={"path": outside, "content": "x"}).status_code == 400
    assert client.post("/api/rename", json={"old": outside, "new": "x.txt"}).status_code == 400
    assert client.post("/api/create/file", json={"path": outside, "content": ""}).status_code == 400
    assert client.post("/api/create/folder", json={"path": outside}).status_code == 400
    assert client.delete("/api/file", params={"path": outside}).status_code == 400


def test_cors_allows_local_vite_origin(client: TestClient, sample_root: Path):
    response = client.options(
        "/api/tree",
        params={"path": str(sample_root)},
        headers={
            "Origin": "http://127.0.0.1:5173",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:5173"


# ---------------------------------------------------------------------------
# /api/skills/scan endpoint tests
# ---------------------------------------------------------------------------

def make_skills_source(root: Path) -> Path:
    """Create a local skills directory with two skill subfolders."""
    src = root / "source"
    src.mkdir()
    for name, desc in [("brainstorming", "Use before coding"), ("writing-plans", "Plan first")]:
        d = src / name
        d.mkdir()
        (d / "SKILL.md").write_text(f"---\ndescription: {desc}\n---")
    return src


def test_scan_local_returns_skill_list(client: TestClient, tmp_path: Path):
    src = make_skills_source(tmp_path)
    resp = client.post("/api/skills/scan", json={"source": "local", "path": str(src)})
    assert resp.status_code == 200
    data = resp.json()
    assert data["source_label"] == str(src)
    names = {s["name"] for s in data["skills"]}
    assert "brainstorming" in names
    assert "writing-plans" in names


def test_scan_local_returns_empty_list_for_no_skills(client: TestClient, tmp_path: Path):
    empty = tmp_path / "empty"
    empty.mkdir()
    resp = client.post("/api/skills/scan", json={"source": "local", "path": str(empty)})
    assert resp.status_code == 200
    assert resp.json()["skills"] == []


def test_scan_local_returns_404_for_missing_path(client: TestClient, tmp_path: Path):
    resp = client.post("/api/skills/scan", json={"source": "local", "path": str(tmp_path / "missing")})
    assert resp.status_code == 404


def test_scan_returns_400_for_missing_url_on_github_source(client: TestClient):
    resp = client.post("/api/skills/scan", json={"source": "github"})
    assert resp.status_code == 400


# ---------------------------------------------------------------------------
# /api/skills/import endpoint tests
# ---------------------------------------------------------------------------

def test_import_local_copies_skills_to_active_root(client: TestClient, tmp_path: Path):
    src = make_skills_source(tmp_path)
    dest = tmp_path / "graph"
    dest.mkdir()
    client.get("/api/tree", params={"path": str(dest)})  # set active_root

    resp = client.post("/api/skills/import", json={
        "source": "local",
        "path": str(src),
        "skill_names": ["brainstorming"],
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "brainstorming" in data["imported"]
    assert (dest / "brainstorming" / "SKILL.md").exists()
    assert data["destination"] == str(dest)


def test_import_returns_409_on_conflict(client: TestClient, tmp_path: Path):
    src = make_skills_source(tmp_path)
    dest = tmp_path / "graph"
    dest.mkdir()
    (dest / "brainstorming").mkdir()  # pre-existing
    client.get("/api/tree", params={"path": str(dest)})

    resp = client.post("/api/skills/import", json={
        "source": "local",
        "path": str(src),
        "skill_names": ["brainstorming"],
    })
    assert resp.status_code == 409
    assert "brainstorming" in resp.json()["conflicts"]


def test_import_resolves_conflict_with_overwrite(client: TestClient, tmp_path: Path):
    src = make_skills_source(tmp_path)
    dest = tmp_path / "graph"
    dest.mkdir()
    (dest / "brainstorming").mkdir()
    client.get("/api/tree", params={"path": str(dest)})

    resp = client.post("/api/skills/import", json={
        "source": "local",
        "path": str(src),
        "skill_names": ["brainstorming"],
        "conflict_resolution": {"brainstorming": "overwrite"},
    })
    assert resp.status_code == 200
    assert "brainstorming" in resp.json()["imported"]


def test_import_returns_422_when_skill_not_found_at_source(client: TestClient, tmp_path: Path):
    src = make_skills_source(tmp_path)
    dest = tmp_path / "graph"
    dest.mkdir()
    client.get("/api/tree", params={"path": str(dest)})

    resp = client.post("/api/skills/import", json={
        "source": "local",
        "path": str(src),
        "skill_names": ["nonexistent"],
    })
    assert resp.status_code == 422


def test_import_uses_cwd_fallback_when_no_active_root(client: TestClient, tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    src = make_skills_source(tmp_path)
    dest = tmp_path / "graph"
    dest.mkdir()
    monkeypatch.chdir(dest)
    # No GET /api/tree call — active_root stays None

    resp = client.post("/api/skills/import", json={
        "source": "local",
        "path": str(src),
        "skill_names": ["brainstorming"],
    })
    assert resp.status_code == 200
    assert (dest / "brainstorming").exists()


# ---------------------------------------------------------------------------
# /api/active_root endpoint tests
# ---------------------------------------------------------------------------

class TestGetActiveRoot:
    def test_returns_path_when_active_root_set(self, client, tmp_path):
        """GET /api/active_root returns the active root path."""
        client.get(f"/api/tree?path={tmp_path}")  # sets active_root
        resp = client.get("/api/active_root")
        assert resp.status_code == 200
        assert resp.json()["path"] == str(tmp_path)

    def test_returns_cwd_fallback_when_no_active_root(self, client, monkeypatch):
        """Falls back to cwd when no active root is set."""
        import skills_vis.main as m
        monkeypatch.setattr(m.app.state, "active_root", None, raising=False)
        resp = client.get("/api/active_root")
        assert resp.status_code == 200
        import os
        assert resp.json()["path"] == os.getcwd()


# /api/server_cwd endpoint tests
# ---------------------------------------------------------------------------

class TestGetServerCwd:
    def test_returns_immutable_startup_cwd(self, client):
        """GET /api/server_cwd always returns the startup CWD, even after tree navigation."""
        import skills_vis.main as m
        resp = client.get("/api/server_cwd")
        assert resp.status_code == 200
        assert resp.json()["path"] == m._SERVER_CWD

    def test_not_changed_after_get_tree(self, client, tmp_path):
        """GET /api/server_cwd is unaffected by GET /api/tree calls that change active_root."""
        import skills_vis.main as m
        cwd_before = m._SERVER_CWD
        client.get(f"/api/tree?path={tmp_path}")  # changes active_root
        resp = client.get("/api/server_cwd")
        assert resp.json()["path"] == cwd_before


# ---------------------------------------------------------------------------
# depth param tests (Task 2)
# ---------------------------------------------------------------------------

def test_get_tree_default_depth_returns_shallow_tree(client: TestClient, sample_root: Path):
    """Default call (no depth param) returns a shallow tree — nested folder is a stub."""
    resp = client.get("/api/tree", params={"path": str(sample_root)})
    assert resp.status_code == 200
    data = resp.json()
    nested = next(n for n in data["children"] if n["name"] == "nested")
    assert nested["children"] == []
    assert nested["children_loaded"] is False


def test_get_tree_depth_minus1_returns_full_tree(client: TestClient, sample_root: Path):
    """depth=-1 returns the complete recursive tree with children_loaded: True everywhere."""
    resp = client.get("/api/tree", params={"path": str(sample_root), "depth": -1})
    assert resp.status_code == 200
    data = resp.json()
    nested = next(n for n in data["children"] if n["name"] == "nested")
    assert nested["children_loaded"] is True
    assert any(c["name"] == "SKILL.md" for c in nested["children"])


def test_get_tree_depth_zero_returns_shallow_tree(client: TestClient, sample_root: Path):
    """depth=0 (or any non-negative value) returns a shallow tree — NOT a full recursive dump."""
    resp = client.get("/api/tree", params={"path": str(sample_root), "depth": 0})
    assert resp.status_code == 200
    data = resp.json()
    nested = next(n for n in data["children"] if n["name"] == "nested")
    assert nested["children"] == []
    assert nested["children_loaded"] is False


def test_get_tree_root_children_loaded_is_true(client: TestClient, sample_root: Path):
    """Root node always has children_loaded: True regardless of depth."""
    resp = client.get("/api/tree", params={"path": str(sample_root)})
    assert resp.status_code == 200
    data = resp.json()
    assert data["children_loaded"] is True
