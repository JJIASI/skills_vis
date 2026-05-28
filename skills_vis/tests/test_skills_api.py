"""Tests for the /api/skills backend APIs.

These tests are written first and are expected to fail until the skills
API is implemented. They follow the existing test style in backend/tests.

This file intentionally mirrors the approved spec for the skills table and
response contracts. Tests assert the public API contract only (saved/starters)
and avoid relying on any non-spec storage column like `normalized_path`.
"""
from pathlib import Path
import sqlite3

import pytest
from fastapi.testclient import TestClient


def make_db(path: Path):
    """Create a test SQLite DB using the spec schema.

    Spec schema: id, label (nullable), path, created_at, updated_at
    """
    conn = sqlite3.connect(str(path))
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE skills (
            id INTEGER PRIMARY KEY,
            label TEXT,
            path TEXT NOT NULL UNIQUE,
            created_at TEXT,
            updated_at TEXT
        )
        """
    )
    conn.commit()
    return conn


# ---------------------------------------------------------------------------
# Read/list tests
# ---------------------------------------------------------------------------


def test_get_skills_list_returns_starters_and_saved(client: TestClient, tmp_path: Path):
    """GET /api/skills returns { saved, starters } and starters have fixed order/keys.

    This test seeds one saved row (using the spec schema) and verifies the
    public response shape. It does not rely on any internal `normalized_path`
    storage column.
    """
    db = tmp_path / "skills.db"
    # Intentionally do not create the skills table here. The application must
    # initialize storage (create the table) on first access.
    if db.exists():
        db.unlink()

    # Boot the app with this DB path; the real implementation will read this
    # from app.state or environment. We set an attribute the implementation can
    # reuse when wired.
    from skills_vis import main

    main.app.state.skills_db_path = str(db)

    resp = client.get("/api/skills")
    assert resp.status_code == 200, resp.text

    # verify the app created the skills table
    conn = sqlite3.connect(str(db))
    cur = conn.cursor()
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='skills'")
    assert cur.fetchone() is not None
    data = resp.json()
    assert isinstance(data, dict)
    assert set(data.keys()) == {"saved", "starters"}
    assert isinstance(data["saved"], list)
    assert isinstance(data["starters"], list)

    # capture the initial starters so we can verify stability of internal keys across reads
    initial_starters = list(data["starters"])

    # Insert one saved row into the now-initialized table so we guarantee saved-row coverage.
    # Use a path that actually exists so implementations must report availability correctly.
    real_dir = tmp_path / "real_skill_dir"
    real_dir.mkdir()
    cur.execute(
        "INSERT INTO skills (label, path, created_at, updated_at) VALUES (?, ?, ?, ?)",
        ("SeedMain", str(real_dir.resolve()), "2024-01-01T00:00:00", "2024-01-01T00:00:00"),
    )
    conn.commit()

    # Fetch again to include the inserted saved row and validate saved-entry shape and availability.
    resp2 = client.get("/api/skills")
    assert resp2.status_code == 200, resp2.text
    data2 = resp2.json()
    saved_list = data2.get("saved", [])
    assert saved_list, "expected at least one saved entry (SeedMain) in response"
    found_saved = [s for s in saved_list if s.get("label") == "SeedMain"]
    assert found_saved, "expected saved entry for SeedMain"
    saved_entry = found_saved[0]
    assert isinstance(saved_entry, dict)
    # saved entry must match the public saved-entry shape exactly
    assert set(saved_entry.keys()) == {"id", "label", "path", "is_available", "created_at", "updated_at"}
    # the saved entry path we created should be present on disk
    assert saved_entry.get("is_available") is True

    # swap in the refreshed data for the remainder of the original assertions
    data = data2

    # starters must be a list of mappings and presented in a stable order by name
    assert all(isinstance(s, dict) for s in data["starters"])
    names = [s.get("name") for s in data["starters"]]
    # Ensure the starters are presented in the spec-defined fixed order
    assert names == ["Claude Code", "Copilot", "Codex", "Hermes", "OpenClaw"], "expected starters to match the spec-defined order"

    # each starter must include required keys and have exact public shape
    for st in data["starters"]:
        assert set(st.keys()) == {"key", "name", "path", "already_added"}

    # keys must be present, usable as stable internal identifiers, and unique
    new_keys = [s.get("key") for s in data["starters"]]
    assert all(isinstance(k, str) and k for k in new_keys), "expected starter keys to be non-empty strings"
    assert len(set(new_keys)) == len(new_keys), "expected starter keys to be unique"

    # verify that keys are stable across reads for the same starter names
    initial_map = {s.get("name"): s.get("key") for s in initial_starters}
    new_map = {s.get("name"): s.get("key") for s in data["starters"]}
    for name in set(initial_map.keys()) & set(new_map.keys()):
        assert initial_map[name] == new_map[name], f"expected stable key for starter {name} across reads"

    # starter paths must be absolute after expansion/resolution and match per-starter expected bases
    expected = {
        "Claude Code": str(Path("~/.claude/skills").expanduser().resolve(strict=False)),
        "Copilot": str(Path("~/.copilot/skills").expanduser().resolve(strict=False)),
        "Codex": str(Path("~/.codex/skills").expanduser().resolve(strict=False)),
        "Hermes": str(Path("~/.hermes/skills").expanduser().resolve(strict=False)),
        "OpenClaw": str(Path("~/.openclaw/skills").expanduser().resolve(strict=False)),
    }
    for st in data["starters"]:
        p = st.get("path")
        assert isinstance(p, str)
        # must not include an unexpanded '~'
        assert "~" not in p
        # path must be the resolved absolute starter path string exactly (no further normalization allowed)
        name = st.get("name")
        assert name in expected, f"unexpected starter name: {name}"
        assert p == expected[name]
        # also ensure the path is absolute
        assert Path(p).is_absolute()

    # with no saved rows present the starters must not be marked already_added
    assert all(st.get("already_added") is False for st in data["starters"])

def test_get_skills_list_already_added_when_saved_matches_starter(client: TestClient, tmp_path: Path):
    """If a saved row exists whose normalized path matches a starter path,
    that starter should be reported with already_added=True and the saved
    list should contain the normalized row.
    """
    db = tmp_path / "skills.db"
    conn = make_db(db)
    from skills_vis import main
    main.app.state.skills_db_path = str(db)

    # initial GET to ensure starters are present and use a deterministic known starter for testing
    resp = client.get("/api/skills")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    starters = data.get("starters", [])
    assert starters, "expected starters in response"
    # Use a specific starter name from the spec to keep the test deterministic
    known_starter_name = "Copilot"
    # seed the normalized starter path (do not rely on read-time normalization of legacy rows)
    expected_normalized = str(Path("~/.copilot/skills").expanduser().resolve(strict=False))
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO skills (label, path, created_at, updated_at) VALUES (?, ?, ?, ?)",
        ("SeedStarter", expected_normalized, "2024-01-01T00:00:00", "2024-01-01T00:00:00"),
    )
    conn.commit()

    # subsequent GET should mark the matching starter as already_added True
    resp2 = client.get("/api/skills")
    assert resp2.status_code == 200, resp2.text
    data2 = resp2.json()
    # Ensure starters have the exact expected public shape
    for st in data2.get("starters", []):
        assert set(st.keys()) == {"key", "name", "path", "already_added"}
    # find starter with same name
    found = [s for s in data2.get("starters", []) if s.get("name") == known_starter_name]
    assert found, "expected to find the seeded starter by name"
    # The matching starter should be marked already_added True and all others False (deterministic check)
    for s in data2.get("starters", []):
        if s.get("name") == known_starter_name:
            assert s.get("already_added") is True
        else:
            assert s.get("already_added") is False
    # Note: spec only requires already_added True for matching starter; read-time normalization of legacy rows is not required here
    saved = data2.get("saved", [])
    # the response must include the saved row we inserted and match the public saved-entry shape
    found_saved = [s for s in saved if s.get("label") == "SeedStarter"]
    assert found_saved, "expected saved entry for SeedStarter"
    saved_entry = found_saved[0]
    assert isinstance(saved_entry.get("path"), str)
    assert set(saved_entry.keys()) == {"id", "label", "path", "is_available", "created_at", "updated_at"}


# ---------------------------------------------------------------------------
# CRUD and validation tests (focused and intentionally failing until implemented)
# ---------------------------------------------------------------------------


def test_post_creates_skill_and_persists_path_and_returns_saved_shape(client: TestClient, tmp_path: Path):
    db = tmp_path / "skills.db"
    conn = make_db(db)
    from skills_vis import main
    main.app.state.skills_db_path = str(db)

    # include whitespace and "~" to force normalization
    raw_path = "  ~/abs/path/to/skill  "
    payload = {"label": "New Skill", "path": raw_path}
    resp = client.post("/api/skills", json=payload)
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert isinstance(body, dict)

    # expected normalized path is expanduser + stripped whitespace
    expected_path = str(Path(raw_path.strip()).expanduser().resolve(strict=False))

    # returned body must be the created saved entry in the public saved-entry shape
    assert set(body.keys()) == {"id", "label", "path", "is_available", "created_at", "updated_at"}
    assert body.get("label") == "New Skill"
    assert body.get("path") == expected_path
    # timestamps must be present as non-empty strings
    assert isinstance(body.get("created_at"), str) and body.get("created_at").strip(), "expected created_at timestamp string"
    assert isinstance(body.get("updated_at"), str) and body.get("updated_at").strip(), "expected updated_at timestamp string"

    # verify DB row path is present and persisted exactly (normalization required)
    cur = conn.cursor()
    cur.execute("SELECT id, label, path, created_at, updated_at FROM skills WHERE path = ?", (expected_path,))
    row = cur.fetchone()
    assert row is not None
    db_id, db_label, db_path, db_created, db_updated = row
    assert db_label == body.get("label")
    assert db_path == body.get("path")
    assert body.get("id") == db_id
    # persisted timestamps should be non-empty and match the returned values
    assert isinstance(db_created, str) and db_created.strip()
    assert isinstance(db_updated, str) and db_updated.strip()
    assert body.get("created_at") == db_created
    assert body.get("updated_at") == db_updated

    # If the API echoes a representation, ensure any returned path is normalized
    if "path" in body:
        assert body["path"] == expected_path


def test_put_updates_skill_label_path_and_updated_at(client: TestClient, tmp_path: Path):
    db = tmp_path / "skills.db"
    conn = make_db(db)
    cur = conn.cursor()
    old_updated = "2024-01-01T00:00:00"
    old_path = str(tmp_path / "old")
    new_path = str(tmp_path / "new")
    cur.execute(
        "INSERT INTO skills (label, path, created_at, updated_at) VALUES (?, ?, ?, ?)",
        ("Old", old_path, "2024-01-01T00:00:00", old_updated),
    )
    cid = cur.lastrowid
    conn.commit()

    from skills_vis import main
    main.app.state.skills_db_path = str(db)

    resp = client.put(f"/api/skills/{cid}", json={"label": "New", "path": new_path})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert isinstance(body, dict)
    # response must be the updated saved entry in saved-entry shape
    assert set(body.keys()) == {"id", "label", "path", "is_available", "created_at", "updated_at"}
    assert body.get("id") == cid
    assert body.get("label") == "New"
    expected_new_path = str(Path(new_path).expanduser().resolve(strict=False))
    assert body.get("path") == expected_new_path
    # created_at and updated_at must be present as non-empty timestamp strings
    assert isinstance(body.get("created_at"), str) and body.get("created_at").strip()
    assert isinstance(body.get("updated_at"), str) and body.get("updated_at").strip()
    assert body.get("updated_at") != old_updated
    # verify storage updated accordingly
    cur.execute("SELECT label, path, updated_at FROM skills WHERE id = ?", (cid,))
    db_row = cur.fetchone()
    assert db_row is not None
    assert db_row[0] == "New"
    assert db_row[1] == expected_new_path
    assert db_row[2] == body.get("updated_at")


def test_delete_skill_returns_204(client: TestClient, tmp_path: Path):
    db = tmp_path / "skills.db"
    conn = make_db(db)
    cur = conn.cursor()
    del_path = str(tmp_path / "to_delete")
    cur.execute(
        "INSERT INTO skills (label, path, created_at, updated_at) VALUES (?, ?, ?, ?)",
        ("ToDelete", del_path, "2024-01-01T00:00:00", "2024-01-01T00:00:00"),
    )
    cid = cur.lastrowid
    conn.commit()

    from skills_vis import main
    main.app.state.skills_db_path = str(db)

    resp = client.delete(f"/api/skills/{cid}")
    assert resp.status_code == 204, resp.text

    # ensure the row was actually removed from storage
    cur.execute("SELECT id FROM skills WHERE id = ?", (cid,))
    assert cur.fetchone() is None, "expected skill row to be deleted from DB"


def test_get_returns_saved_rows_sorted_by_updated_at(client: TestClient, tmp_path: Path):
    db = tmp_path / "skills.db"
    conn = make_db(db)
    cur = conn.cursor()
    # Insert three rows so that ordering by other fields (label, id, created_at)
    # would not produce the same order as ordering by updated_at DESC. We insert
    # in insertion order A, B, C but give updated_at timestamps so the correct
    # updated_at DESC order is B, A, C.
    pA = str(tmp_path / "a")
    pB = str(tmp_path / "b")
    pC = str(tmp_path / "c")
    cur.execute(
        "INSERT INTO skills (label, path, created_at, updated_at) VALUES (?, ?, ?, ?)",
        ("A", pA, "2022-01-01T00:00:00", "2024-01-02T00:00:00"),
    )
    cur.execute(
        "INSERT INTO skills (label, path, created_at, updated_at) VALUES (?, ?, ?, ?)",
        ("B", pB, "2023-01-01T00:00:00", "2024-01-03T00:00:00"),
    )
    cur.execute(
        "INSERT INTO skills (label, path, created_at, updated_at) VALUES (?, ?, ?, ?)",
        ("C", pC, "2024-01-01T00:00:00", "2024-01-01T00:00:00"),
    )
    conn.commit()

    from skills_vis import main
    main.app.state.skills_db_path = str(db)

    resp = client.get("/api/skills")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    saved = body["saved"]
    saved_labels = [s.get("label") for s in saved]
    # Expect ordering uniquely determined by updated_at DESC: B (newest), A, C (oldest)
    assert saved_labels == ["B", "A", "C"]


def test_validation_empty_or_relative_path_and_duplicates(client: TestClient, tmp_path: Path):
    db = tmp_path / "skills.db"
    conn = make_db(db)
    from skills_vis import main
    main.app.state.skills_db_path = str(db)

    # empty path
    resp = client.post("/api/skills", json={"label": "X", "path": ""})
    assert resp.status_code == 400
    body = resp.json()
    assert isinstance(body, dict)
    assert set(body.keys()) == {"detail"}
    assert isinstance(body["detail"], str) and body["detail"].strip(), "expected a human-readable error detail"
    det = body["detail"].lower()
    assert any(k in det for k in ("path", "empty", "required")), "error detail should mention path or empty"

    # relative path
    resp = client.post("/api/skills", json={"label": "X", "path": "relative/path"})
    assert resp.status_code == 400
    body = resp.json()
    assert isinstance(body, dict)
    assert set(body.keys()) == {"detail"}
    assert isinstance(body["detail"], str) and body["detail"].strip(), "expected a human-readable error detail"
    det = body["detail"].lower()
    assert any(k in det for k in ("path", "relative", "absolute")), "error detail should mention relative/absolute path"

    # duplicate path (normalization-equivalent input)
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO skills (label, path, created_at, updated_at) VALUES (?, ?, ?, ?)",
        ("Dup", str(Path("~/dup").expanduser().resolve(strict=False)), "2024-01-01T00:00:00", "2024-01-01T00:00:00"),
    )
    conn.commit()
    # send a normalization-equivalent path using ~ and surrounding whitespace to require expansion & normalization
    resp = client.post("/api/skills", json={"label": "X", "path": " ~/dup "})
    assert resp.status_code == 409
    body = resp.json()
    assert isinstance(body, dict)
    assert set(body.keys()) == {"detail"}
    assert isinstance(body["detail"], str) and body["detail"].strip(), "expected a human-readable error detail"
    det = body["detail"].lower()
    assert any(k in det for k in ("duplicate", "exists", "already", "conflict")), "expected duplicate/conflict hint in detail"


def test_missing_id_returns_404_for_put_and_delete(client: TestClient, tmp_path: Path):
    db = tmp_path / "skills.db"
    conn = make_db(db)
    from skills_vis import main
    main.app.state.skills_db_path = str(db)

    resp = client.put("/api/skills/9999", json={"label": "x", "path": str(tmp_path / "missing-target")})
    assert resp.status_code == 404
    body = resp.json()
    assert isinstance(body, dict)
    assert set(body.keys()) == {"detail"}
    assert isinstance(body["detail"], str)
    det = body["detail"].lower().strip()
    # Require a meaningful API-level error detail (not a generic route 404). It should reference the missing saved resource.
    assert det and ("9999" in det or any(k in det for k in ("skill", "saved", "entry", "id"))), "expected detail to reference the missing saved resource (e.g., '9999' or 'skill')"

    resp = client.delete("/api/skills/9999")
    assert resp.status_code == 404
    body = resp.json()
    assert isinstance(body, dict)
    assert set(body.keys()) == {"detail"}
    assert isinstance(body["detail"], str)
    det = body["detail"].lower().strip()
    # Require a meaningful API-level error detail (not a generic route 404). It should reference the missing saved resource.
    assert det and ("9999" in det or any(k in det for k in ("skill", "saved", "entry", "id"))), "expected detail to reference the missing saved resource (e.g., '9999' or 'skill')"


def test_nonexistent_paths_are_accepted_but_marked_unavailable(client: TestClient, tmp_path: Path):
    db = tmp_path / "skills.db"
    conn = make_db(db)
    from skills_vis import main
    main.app.state.skills_db_path = str(db)

    missing_dir = tmp_path / "does_not_exist"
    payload = {"label": "MissingDir", "path": str(missing_dir)}
    resp = client.post("/api/skills", json=payload)
    assert resp.status_code == 201, resp.text

    # create a real file, post it. Even while a file exists, a file-path should be reported unavailable
    real_file = tmp_path / "real.txt"
    real_file.write_text("hello")
    payload2 = {"label": "MissingFile", "path": str(real_file)}
    respf = client.post("/api/skills", json=payload2)
    assert respf.status_code == 201, respf.text

    # immediate GET should show that a file path (as opposed to a directory) is reported unavailable
    resp_interim = client.get("/api/skills")
    assert resp_interim.status_code == 200
    interim = resp_interim.json()
    found_file = [s for s in interim.get("saved", []) if s.get("label") == "MissingFile"]
    assert found_file, "expected saved entry for MissingFile after POST"
    assert found_file[0].get("is_available") is False

    # remove the file so the file path becomes unavailable (redundant) and test missing-path coverage
    real_file.unlink()

    # subsequent GET should mark is_available false for those entries
    resp2 = client.get("/api/skills")
    assert resp2.status_code == 200
    data = resp2.json()
    for lbl in ("MissingDir", "MissingFile"):
        found = [s for s in data.get("saved", []) if s.get("label") == lbl]
        assert found, f"expected saved entry for {lbl}"
        assert found[0].get("is_available") is False
        # ensure public shape
        assert set(found[0].keys()) == {"id", "label", "path", "is_available", "created_at", "updated_at"}


def test_storage_failure_returns_500_with_detail(client: TestClient, monkeypatch: pytest.MonkeyPatch, tmp_path: Path):
    # Simulate a storage layer failure by causing sqlite3.connect to raise an OperationalError
    import sqlite3 as _sqlite3
    from skills_vis import main

    def fail_connect(*a, **kw):
        raise _sqlite3.OperationalError("simulated storage failure")

    # Monkeypatch the sqlite3.connect used by the application to ensure deterministic failure
    monkeypatch.setattr(_sqlite3, "connect", fail_connect)
    main.app.state.skills_db_path = str(tmp_path / "skills.db")

    resp = client.post("/api/skills", json={"label": "X", "path": str(tmp_path / "abs" / "path")})
    assert resp.status_code == 500
    body = resp.json()
    assert isinstance(body, dict)
    assert set(body.keys()) == {"detail"}
    assert isinstance(body["detail"], str) and body["detail"].strip(), "expected a human-readable error detail"
