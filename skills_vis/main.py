import json as _json
import logging
from pathlib import Path
import sqlite3
import argparse
import os
import platform
import socket
import sys

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

if __package__:
    from .file_ops import (
        build_tree,
        create_file,
        create_folder,
        delete_file,
        delete_folder,
        ensure_within_root,
        normalize_root,
        read_file,
        rename_path,
        write_file,
    )
    from .skill_importer import (
        SkillConflictError,
        SkillMissingAtSourceError,
        get_source_label,
        import_skills,
        scan_skills,
    )
    from .schemas import (
        CreateSkillRequest,
        CreateFileRequest,
        CreateFolderRequest,
        RenameRequest,
        SaveFileRequest,
        UpdateSkillRequest,
        ScanSkillsRequest,
        ImportSkillsRequest,
        StartSessionRequest,
        RecordEventRequest,
    )
    from .usage_store import UsageStore
    from .skills_store import (
        DuplicateSkillPathError,
        SkillNotFoundError,
        SkillsValidationError,
        create_skill,
        delete_skill,
        read_skills,
        update_skill,
    )
else:
    from file_ops import (
        build_tree,
        create_file,
        create_folder,
        delete_file,
        delete_folder,
        ensure_within_root,
        normalize_root,
        read_file,
        rename_path,
        write_file,
    )
    from skill_importer import (
        SkillConflictError,
        SkillMissingAtSourceError,
        get_source_label,
        import_skills,
        scan_skills,
    )
    from schemas import (
        CreateSkillRequest,
        CreateFileRequest,
        CreateFolderRequest,
        RenameRequest,
        SaveFileRequest,
        UpdateSkillRequest,
        ScanSkillsRequest,
        ImportSkillsRequest,
        StartSessionRequest,
        RecordEventRequest,
    )
    from usage_store import UsageStore
    from skills_store import (
        DuplicateSkillPathError,
        SkillNotFoundError,
        SkillsValidationError,
        create_skill,
        delete_skill,
        read_skills,
        update_skill,
    )

logger = logging.getLogger(__name__)

app = FastAPI()

# Capture the server's startup CWD once — never changes after this point.
_SERVER_CWD = str(Path.cwd())

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(FileNotFoundError)
async def file_not_found_handler(request: Request, exc: FileNotFoundError):
    return JSONResponse(status_code=404, content={"detail": str(exc)})


@app.exception_handler(FileExistsError)
async def file_exists_handler(request: Request, exc: FileExistsError):
    return JSONResponse(status_code=409, content={"detail": str(exc)})


@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    return JSONResponse(status_code=400, content={"detail": str(exc)})


@app.exception_handler(RequestValidationError)
async def request_validation_handler(request: Request, exc: RequestValidationError):
    if request.url.path.startswith("/api/skills"):
        first_error = exc.errors()[0] if exc.errors() else {}
        field = first_error.get("loc", [])[-1] if first_error.get("loc") else "payload"
        message = first_error.get("msg", "Invalid request payload")
        return JSONResponse(status_code=400, content={"detail": f"Invalid {field}: {message}"})
    return JSONResponse(status_code=422, content={"detail": exc.errors()})


def require_active_root() -> Path:
    """Return the active root path, falling back to Path.cwd() if none is set."""
    root = getattr(app.state, "active_root", None)
    if root is None:
        cwd = Path.cwd()
        logger.debug("active_root not set; falling back to cwd=%s", cwd)
        return cwd
    return root


def get_skills_db_path() -> Path:
    configured = getattr(app.state, "skills_db_path", None) or os.environ.get("SKILLS_VIS_DB_PATH")
    if configured:
        return Path(configured)
    return Path(__file__).resolve().with_name("skills.db")


def get_usage_store() -> "UsageStore":
    if not getattr(app.state, "usage_store", None):
        app.state.usage_store = UsageStore(get_skills_db_path())
    return app.state.usage_store


@app.get("/api/tree")
def get_tree(path: str, depth: int = 1, set_root: bool = True):
    # Normalize: any negative depth → full recursion (-1); any non-negative → shallow (1).
    # build_tree uses `depth > 0` for shallow mode, so depth=0 would silently dump the
    # full tree without this normalization.
    normalized_depth = -1 if depth < 0 else 1
    if set_root:
        root = normalize_root(path)
        app.state.active_root = root
        return build_tree(root, root, normalized_depth)
    else:
        root = require_active_root()
        start = ensure_within_root(root, Path(path))
        return build_tree(root, start, normalized_depth)


@app.get("/api/skills")
def get_skills():
    try:
        return read_skills(get_skills_db_path())
    except (OSError, sqlite3.Error) as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/active_root")
def get_active_root():
    return {"path": str(require_active_root())}


@app.get("/api/server_cwd")
def get_server_cwd():
    """Return the directory where the server was started. Never changes."""
    return {"path": _SERVER_CWD}


@app.post("/api/skills", status_code=201)
def create_skill_entry(payload: CreateSkillRequest):
    try:
        return create_skill(get_skills_db_path(), payload.label, payload.path)
    except SkillsValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except DuplicateSkillPathError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except (OSError, sqlite3.Error) as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.put("/api/skills/{skill_id}")
def update_skill_entry(skill_id: int, payload: UpdateSkillRequest):
    try:
        return update_skill(get_skills_db_path(), skill_id, payload.label, payload.path)
    except SkillsValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except DuplicateSkillPathError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except SkillNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except (OSError, sqlite3.Error) as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.delete("/api/skills/{skill_id}", status_code=204)
def delete_skill_entry(skill_id: int):
    try:
        delete_skill(get_skills_db_path(), skill_id)
    except SkillNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except (OSError, sqlite3.Error) as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/file")
def get_file(path: str):
    root = require_active_root()
    payload = read_file(root, Path(path))
    if payload["kind"] == "binary":
        raise HTTPException(status_code=415, detail="Cannot preview this file")
    return payload


@app.put("/api/file")
def save_file(payload: SaveFileRequest):
    write_file(require_active_root(), Path(payload.path), payload.content)
    return {"status": "ok"}


@app.post("/api/rename")
def rename_entry(payload: RenameRequest):
    renamed = rename_path(require_active_root(), Path(payload.old), payload.new)
    return {"path": str(renamed), "name": renamed.name}


@app.post("/api/create/file", status_code=201)
def create_file_entry(payload: CreateFileRequest):
    created = create_file(require_active_root(), Path(payload.path), payload.content)
    return {"path": str(created), "name": created.name}


@app.post("/api/create/folder", status_code=201)
def create_folder_entry(payload: CreateFolderRequest):
    created = create_folder(require_active_root(), Path(payload.path))
    return {"path": str(created), "name": created.name}


@app.delete("/api/file", status_code=204)
def delete_file_entry(path: str):
    delete_file(require_active_root(), Path(path))


@app.delete("/api/folder", status_code=204)
def delete_folder_entry(path: str):
    delete_folder(require_active_root(), Path(path))


@app.post("/api/skills/scan")
def scan_skills_endpoint(payload: ScanSkillsRequest):
    subfolder = (payload.subfolder or "").rstrip("/")
    try:
        skills = scan_skills(payload.source, payload.url, payload.path, subfolder)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    label = get_source_label(payload.source, payload.url, payload.path, subfolder)
    return {
        "source_label": label,
        "skills": [{"name": s.name, "description": s.description} for s in skills],
    }


@app.post("/api/skills/import")
def import_skills_endpoint(payload: ImportSkillsRequest):
    active_root = require_active_root()
    try:
        result = import_skills(payload, active_root)
    except SkillConflictError as exc:
        return JSONResponse(status_code=409, content={"conflicts": exc.conflicts})
    except SkillMissingAtSourceError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return {
        "imported": result.imported,
        "skipped": result.skipped,
        "destination": result.destination,
    }


@app.post("/api/usage/sessions")
def post_usage_session(body: StartSessionRequest):
    sid = get_usage_store().create_session(body.agent, body.graph_root)
    return {"session_id": sid}


@app.put("/api/usage/sessions/{session_id}/stop")
def stop_usage_session(session_id: str):
    get_usage_store().stop_session(session_id)
    return {"ok": True}


@app.post("/api/usage/record")
def post_usage_record(body: RecordEventRequest):
    try:
        event_id = get_usage_store().record_event(
            body.session_id, body.skill_path, body.skill_name, body.metadata
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"ok": True, "event_id": event_id}


@app.get("/api/usage/sessions")
def list_usage_sessions():
    return get_usage_store().list_sessions()


@app.get("/api/usage/sessions/{session_id}/events")
def get_session_events(session_id: str):
    return get_usage_store().get_events(session_id)


@app.get("/api/usage/stream")
async def usage_stream(session_id: str | None = None):
    store = get_usage_store()
    queue = store.subscribe()

    async def event_generator():
        try:
            while True:
                event = await queue.get()
                if session_id is None or event.get("session_id") == session_id:
                    yield f"data: {_json.dumps(event)}\n\n"
        finally:
            store.unsubscribe(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.delete("/api/usage/sessions/{session_id}")
def delete_usage_session(session_id: str):
    found = get_usage_store().delete_session(session_id)
    if not found:
        raise HTTPException(status_code=404, detail=f"Session not found: {session_id}")
    return {"ok": True}


_STATIC_DIR = Path(__file__).parent / "static"
if _STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=_STATIC_DIR, html=True), name="static")


def run() -> None:
    """CLI entry point for `skills-vis`."""
    parser = argparse.ArgumentParser(
        prog="skills-vis",
        description="Skills Vis — interactive AI skill browser and agent monitor",
    )
    parser.add_argument(
        "--port", type=int, default=None,
        help="Port to bind (default: auto-detect starting from 8001)",
    )
    parser.add_argument(
        "--host", type=str, default="127.0.0.1",
        help="Host to bind (default: 127.0.0.1)",
    )
    parser.add_argument(
        "--db", type=str, default=None, metavar="PATH",
        help="Path to the SQLite database file",
    )
    parser.add_argument(
        "--reload", action="store_true",
        help="Enable auto-reload for development",
    )
    parser.add_argument(
        "--verbose", action="store_true",
        help="Show full uvicorn logs (default: warnings only)",
    )
    args = parser.parse_args()

    # Validate host is resolvable
    try:
        socket.getaddrinfo(args.host, None)
    except OSError:
        print(f"Error: cannot resolve host {args.host!r}.", file=sys.stderr)
        sys.exit(1)

    # Resolve port
    if args.port is not None:
        if _is_port_in_use(args.host, args.port):
            print(
                f"Error: port {args.port} on {args.host} is already in use. "
                "Choose a different port or omit --port to auto-detect.",
                file=sys.stderr,
            )
            sys.exit(1)
        port = args.port
        port_source = "--port"
    else:
        port = _find_free_port(8001, args.host)
        port_source = "auto-detected"

    # Resolve and prepare DB path
    db_path = _resolve_db_path(args.db)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    app.state.skills_db_path = str(db_path)
    os.environ["SKILLS_VIS_DB_PATH"] = str(db_path)

    # Print banner
    url = f"http://{args.host}:{port}"
    print(_banner(url, db_path, port, port_source))

    import uvicorn
    uvicorn.run(
        "skills_vis.main:app",
        host=args.host,
        port=port,
        reload=args.reload,
        log_level="warning" if not args.verbose else "info",
    )


# ── Startup helpers ───────────────────────────────────────────────────────────

def _is_port_in_use(host: str, port: int) -> bool:
    """Return True if something is already listening on host:port."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.1)
        return s.connect_ex((host, port)) == 0


def _find_free_port(start: int, host: str = "127.0.0.1") -> int:
    """Try start, then start+1, start+2, … until a free port is found."""
    port = start
    while _is_port_in_use(host, port):
        port += 1
        if port > 65535:
            raise RuntimeError("No free port found in range starting from the requested port")
    return port


def _default_db_path() -> Path:
    """Return the OS-conventional location for the skills-vis database."""
    system = platform.system()
    if system == "Darwin":
        base = Path.home() / "Library" / "Application Support"
    elif system == "Windows":
        base = Path(os.environ.get("APPDATA", str(Path.home() / "AppData" / "Roaming")))
    else:  # Linux / BSD / other POSIX
        base = Path(os.environ.get("XDG_DATA_HOME", str(Path.home() / ".local" / "share")))
    return base / "skills-vis" / "skills.db"


def _resolve_db_path(db_arg: str | None) -> Path:
    """Resolve the database path from a CLI argument or the OS default."""
    if db_arg:
        return Path(db_arg)
    return _default_db_path()


_RESET      = "\033[0m"
_BOLD       = "\033[1m"
_DIM        = "\033[2m"
_GREEN      = "\033[32m"
_ORANGE     = "\033[38;5;208m"
_BOLD_WHITE = "\033[1;37m"


def _collapse_home(path: Path) -> str:
    """Replace the home directory prefix with ~ for display."""
    try:
        rel = path.relative_to(Path.home())
        return "~" if rel == Path(".") else "~/" + str(rel)
    except ValueError:
        return str(path)


def _banner(
    url: str,
    db_path: Path,
    port: int,
    port_source: str,
    use_color: bool | None = None,
) -> str:
    """Render the startup banner string."""
    if use_color is None:
        use_color = sys.stdout.isatty()

    def c(code: str, text: str) -> str:
        return f"{code}{text}{_RESET}" if use_color else text

    db_display = _collapse_home(db_path)
    sep = "─" * 41

    lines = [
        "",
        c(_ORANGE + _BOLD, "  ⚒  Skills-vis"),
        f"  {sep}",
        f"  {'URL':<6}→  {c(_GREEN, url)}",
        f"  {'DB':<6}→  {c(_BOLD_WHITE, db_display)}",
        f"  {'Port':<6}→  {c(_BOLD_WHITE, str(port))} {c(_DIM, f'({port_source})')}",
        "",
        c(_DIM, "  Press Ctrl+C to stop."),
        "",
    ]
    return "\n".join(lines)
