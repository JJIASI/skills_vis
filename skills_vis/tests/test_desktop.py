import socket

import pytest

from skills_vis.desktop import _wait_for_server


def test_wait_for_server_returns_when_port_open():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        s.listen(1)
        port = s.getsockname()[1]
        _wait_for_server("127.0.0.1", port, timeout=1.0)


def test_wait_for_server_raises_on_timeout():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        free_port = s.getsockname()[1]
    # socket above is closed and unbound, so nothing is listening on free_port
    with pytest.raises(RuntimeError):
        _wait_for_server("127.0.0.1", free_port, timeout=0.2)
