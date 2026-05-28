import asyncio
import json
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path


def _now_ts() -> int:
    return int(datetime.now(timezone.utc).timestamp())


class UsageStore:
    def __init__(self, db_path: str | Path):
        self._db_path = Path(db_path)
        self._db_path.parent.mkdir(parents=True, exist_ok=True)
        self._subscribers: list[tuple[asyncio.AbstractEventLoop | None, asyncio.Queue]] = []
        self._init_db()

    def _init_db(self) -> None:
        with sqlite3.connect(str(self._db_path)) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS sessions (
                    id         TEXT    PRIMARY KEY,
                    started_at INTEGER NOT NULL,
                    ended_at   INTEGER,
                    agent      TEXT,
                    graph_root TEXT
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS usage_events (
                    id          INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id  TEXT    NOT NULL REFERENCES sessions(id),
                    skill_path  TEXT    NOT NULL,
                    skill_name  TEXT    NOT NULL,
                    invoked_at  INTEGER NOT NULL,
                    metadata    TEXT
                )
            """)
            conn.commit()

    def create_session(self, agent: str | None, graph_root: str | None) -> str:
        session_id = str(uuid.uuid4())
        with sqlite3.connect(str(self._db_path)) as conn:
            conn.execute(
                "INSERT INTO sessions (id, started_at, agent, graph_root) VALUES (?, ?, ?, ?)",
                (session_id, _now_ts(), agent, graph_root),
            )
            conn.commit()
        return session_id

    def stop_session(self, session_id: str) -> None:
        with sqlite3.connect(str(self._db_path)) as conn:
            conn.execute(
                "UPDATE sessions SET ended_at = ? WHERE id = ? AND ended_at IS NULL",
                (_now_ts(), session_id),
            )
            conn.commit()

    def get_open_session(self) -> str | None:
        """Return the most recently started session that has not been stopped."""
        with sqlite3.connect(str(self._db_path)) as conn:
            row = conn.execute(
                "SELECT id FROM sessions WHERE ended_at IS NULL"
                " ORDER BY started_at DESC, rowid DESC LIMIT 1"
            ).fetchone()
            return row[0] if row else None

    def record_event(
        self,
        session_id: str | None,
        skill_path: str,
        skill_name: str,
        metadata: dict | None,
    ) -> int:
        if session_id is None:
            session_id = self.get_open_session() or self.create_session(None, None)

        metadata_str = json.dumps(metadata) if metadata is not None else None
        invoked_at = _now_ts()
        with sqlite3.connect(str(self._db_path)) as conn:
            row = conn.execute(
                "SELECT id FROM sessions WHERE id = ?", (session_id,)
            ).fetchone()
            if row is None:
                raise KeyError(f"Session not found: {session_id}")

            cursor = conn.execute(
                "INSERT INTO usage_events (session_id, skill_path, skill_name, invoked_at, metadata)"
                " VALUES (?, ?, ?, ?, ?)",
                (session_id, skill_path, skill_name, invoked_at, metadata_str),
            )
            event_id = cursor.lastrowid
            conn.commit()

        event_data = {
            "id": event_id,
            "session_id": session_id,
            "skill_path": skill_path,
            "skill_name": skill_name,
            "invoked_at": invoked_at,
        }
        for loop, q in list(self._subscribers):
            if loop is not None:
                loop.call_soon_threadsafe(q.put_nowait, event_data)
            else:
                q.put_nowait(event_data)

        return event_id

    def list_sessions(self) -> list[dict]:
        with sqlite3.connect(str(self._db_path)) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute("""
                SELECT s.id, s.started_at, s.ended_at, s.agent, s.graph_root,
                       COUNT(e.id) AS event_count
                FROM sessions s
                LEFT JOIN usage_events e ON e.session_id = s.id
                GROUP BY s.id
                ORDER BY s.started_at DESC, s.rowid DESC
            """).fetchall()
            return [dict(r) for r in rows]

    def get_events(self, session_id: str) -> list[dict]:
        with sqlite3.connect(str(self._db_path)) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute(
                "SELECT id, skill_path, skill_name, invoked_at, metadata"
                " FROM usage_events WHERE session_id = ? ORDER BY invoked_at ASC",
                (session_id,),
            ).fetchall()
            return [dict(r) for r in rows]

    def subscribe(self) -> asyncio.Queue:
        try:
            loop: asyncio.AbstractEventLoop | None = asyncio.get_running_loop()
        except RuntimeError:
            loop = None
        q: asyncio.Queue = asyncio.Queue()
        self._subscribers.append((loop, q))
        return q

    def unsubscribe(self, queue: asyncio.Queue) -> None:
        self._subscribers = [
            (loop, q) for loop, q in self._subscribers if q is not queue
        ]

    def delete_session(self, session_id: str) -> bool:
        """Delete a session and all its events. Returns True if session existed."""
        with sqlite3.connect(str(self._db_path)) as conn:
            conn.execute("DELETE FROM usage_events WHERE session_id = ?", (session_id,))
            cursor = conn.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
            conn.commit()
            return cursor.rowcount > 0
