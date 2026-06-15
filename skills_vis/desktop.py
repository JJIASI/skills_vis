import time

from .main import _is_port_in_use


def _wait_for_server(host: str, port: int, timeout: float = 10.0) -> None:
    """Block until something is listening on host:port, or raise on timeout."""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if _is_port_in_use(host, port):
            return
        time.sleep(0.05)
    raise RuntimeError(f"Server did not start on {host}:{port} within {timeout}s")
