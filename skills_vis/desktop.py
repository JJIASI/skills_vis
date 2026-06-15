import os
import threading
import time

import uvicorn

from .main import app, _find_free_port, _is_port_in_use, _resolve_db_path


def _wait_for_server(host: str, port: int, timeout: float = 10.0) -> None:
    """Block until something is listening on host:port, or raise on timeout."""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if _is_port_in_use(host, port):
            return
        time.sleep(0.05)
    raise RuntimeError(f"Server did not start on {host}:{port} within {timeout}s")


def run() -> None:
    """Entry point for `skills-vis-desktop`: run the app in a native window."""
    import webview

    host = "127.0.0.1"

    db_path = _resolve_db_path(None)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    app.state.skills_db_path = str(db_path)
    os.environ["SKILLS_VIS_DB_PATH"] = str(db_path)

    port = _find_free_port(8001, host)

    config = uvicorn.Config(app, host=host, port=port, log_level="warning")
    server = uvicorn.Server(config)

    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()

    _wait_for_server(host, port)

    webview.create_window("Skills Vis", f"http://{host}:{port}", width=1280, height=800)
    webview.start()

    server.should_exit = True
    thread.join(timeout=5)
