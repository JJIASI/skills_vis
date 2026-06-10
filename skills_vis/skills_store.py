import sqlite3
from datetime import datetime, timezone
from pathlib import Path


STARTER_SKILLS = [
    {"key": "claude-code", "name": "Claude Code", "path_template": "~/.claude/skills"},
    {"key": "copilot", "name": "Copilot", "path_template": "~/.copilot/skills"},
    {"key": "codex", "name": "Codex", "path_template": "~/.codex/skills"},
    {"key": "hermes", "name": "Hermes", "path_template": "~/.hermes/skills"},
    {"key": "openclaw", "name": "OpenClaw", "path_template": "~/.openclaw/skills"},
    {"key": "cursor", "name": "Cursor", "path_template": "~/.cursor/skills"},
    {"key": "agent", "name": "Agent", "path_template": "~/.agent/skills"},
]


class SkillsValidationError(Exception):
    pass


class DuplicateSkillPathError(Exception):
    pass


class SkillNotFoundError(Exception):
    pass


def _is_duplicate_path_error(exc: sqlite3.IntegrityError) -> bool:
    message = str(exc).lower()
    return "unique constraint failed: skills.path" in message or "skills.path" in message


def init_skills_db(db_path: str | Path) -> None:
    db_file = Path(db_path)
    db_file.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(str(db_file)) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS skills (
                id INTEGER PRIMARY KEY,
                label TEXT,
                path TEXT NOT NULL UNIQUE,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        conn.commit()


def normalize_skill_path(raw_path: str) -> str:
    cleaned = raw_path.strip()
    if not cleaned:
        raise SkillsValidationError("Path is required")

    expanded = Path(cleaned).expanduser()
    if not expanded.is_absolute():
        raise SkillsValidationError("Path must be absolute")

    return str(expanded.resolve(strict=False))


def is_skill_path_available(path: str) -> bool:
    candidate = Path(path)
    return candidate.exists() and candidate.is_dir()


def _utc_timestamp() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _saved_entry_from_row(row: sqlite3.Row | tuple) -> dict:
    if isinstance(row, sqlite3.Row):
        saved = dict(row)
    else:
        saved = {
            "id": row[0],
            "label": row[1],
            "path": row[2],
            "created_at": row[3],
            "updated_at": row[4],
        }

    return {
        "id": saved["id"],
        "label": saved["label"],
        "path": saved["path"],
        "is_available": is_skill_path_available(saved["path"]),
        "created_at": saved["created_at"],
        "updated_at": saved["updated_at"],
    }


def read_skills(db_path: str | Path) -> dict:
    init_skills_db(db_path)
    with sqlite3.connect(str(db_path)) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            """
            SELECT id, label, path, created_at, updated_at
            FROM skills
            ORDER BY updated_at DESC
            """
        ).fetchall()

    saved = [_saved_entry_from_row(row) for row in rows]
    saved_paths = {entry["path"] for entry in saved}
    starters = [
        {
            "key": starter["key"],
            "name": starter["name"],
            "path": normalize_skill_path(starter["path_template"]),
            "already_added": normalize_skill_path(starter["path_template"]) in saved_paths,
            "is_available": is_skill_path_available(normalize_skill_path(starter["path_template"])),
        }
        for starter in STARTER_SKILLS
    ]
    return {"saved": saved, "starters": starters}


def create_skill(db_path: str | Path, label: str | None, path: str) -> dict:
    init_skills_db(db_path)
    normalized_path = normalize_skill_path(path)
    timestamp = _utc_timestamp()

    with sqlite3.connect(str(db_path)) as conn:
        conn.row_factory = sqlite3.Row
        existing = conn.execute("SELECT id FROM skills WHERE path = ?", (normalized_path,)).fetchone()
        if existing is not None:
            raise DuplicateSkillPathError("Skill path already exists")

        try:
            cursor = conn.execute(
                """
                INSERT INTO skills (label, path, created_at, updated_at)
                VALUES (?, ?, ?, ?)
                """,
                (label, normalized_path, timestamp, timestamp),
            )
        except sqlite3.IntegrityError as exc:
            if _is_duplicate_path_error(exc):
                raise DuplicateSkillPathError("Skill path already exists") from exc
            raise
        row = conn.execute(
            """
            SELECT id, label, path, created_at, updated_at
            FROM skills
            WHERE id = ?
            """,
            (cursor.lastrowid,),
        ).fetchone()
        conn.commit()

    return _saved_entry_from_row(row)


def update_skill(db_path: str | Path, skill_id: int, label: str | None, path: str) -> dict:
    init_skills_db(db_path)
    normalized_path = normalize_skill_path(path)
    timestamp = _utc_timestamp()

    with sqlite3.connect(str(db_path)) as conn:
        conn.row_factory = sqlite3.Row
        existing = conn.execute(
            """
            SELECT id, label, path, created_at, updated_at
            FROM skills
            WHERE id = ?
            """,
            (skill_id,),
        ).fetchone()
        if existing is None:
            raise SkillNotFoundError(f"Skill id {skill_id} was not found")

        duplicate = conn.execute(
            "SELECT id FROM skills WHERE path = ? AND id != ?",
            (normalized_path, skill_id),
        ).fetchone()
        if duplicate is not None:
            raise DuplicateSkillPathError("Skill path already exists")

        try:
            conn.execute(
                """
                UPDATE skills
                SET label = ?, path = ?, updated_at = ?
                WHERE id = ?
                """,
                (label, normalized_path, timestamp, skill_id),
            )
        except sqlite3.IntegrityError as exc:
            if _is_duplicate_path_error(exc):
                raise DuplicateSkillPathError("Skill path already exists") from exc
            raise
        row = conn.execute(
            """
            SELECT id, label, path, created_at, updated_at
            FROM skills
            WHERE id = ?
            """,
            (skill_id,),
        ).fetchone()
        conn.commit()

    return _saved_entry_from_row(row)


def delete_skill(db_path: str | Path, skill_id: int) -> None:
    init_skills_db(db_path)
    with sqlite3.connect(str(db_path)) as conn:
        cursor = conn.execute("DELETE FROM skills WHERE id = ?", (skill_id,))
        conn.commit()

    if cursor.rowcount == 0:
        raise SkillNotFoundError(f"Skill id {skill_id} was not found")
