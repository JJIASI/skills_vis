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


import sys
from unittest.mock import MagicMock, patch


def test_run_starts_server_and_opens_window(tmp_path, monkeypatch):
    monkeypatch.setenv("SKILLS_VIS_DB_PATH", str(tmp_path / "skills.db"))

    mock_webview = MagicMock()
    mock_server = MagicMock()
    mock_server.should_exit = False

    with patch.dict(sys.modules, {"webview": mock_webview}), \
         patch("skills_vis.desktop.uvicorn.Server", return_value=mock_server), \
         patch("skills_vis.desktop.threading.Thread") as mock_thread_cls, \
         patch("skills_vis.desktop._wait_for_server"):
        from skills_vis import desktop
        desktop.run()

    mock_thread_cls.assert_called_once()
    _, thread_kwargs = mock_thread_cls.call_args
    assert thread_kwargs["target"] == mock_server.run
    assert thread_kwargs["daemon"] is True
    mock_thread_cls.return_value.start.assert_called_once()

    mock_webview.create_window.assert_called_once()
    args, kwargs = mock_webview.create_window.call_args
    assert args[0] == "Skills Vis"
    assert args[1].startswith("http://127.0.0.1:")
    assert kwargs["width"] == 1280
    assert kwargs["height"] == 800

    mock_webview.start.assert_called_once()
    assert mock_server.should_exit is True
    mock_thread_cls.return_value.join.assert_called_once_with(timeout=5)
