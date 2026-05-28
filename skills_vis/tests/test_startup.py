import socket

from skills_vis.main import _find_free_port, _is_port_in_use


def test_is_port_in_use_returns_false_for_free_port():
    # bind-only (no connect) sockets don't enter TIME_WAIT, so the port
    # is available as soon as the socket descriptor closes
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        free_port = s.getsockname()[1]
    assert _is_port_in_use("127.0.0.1", free_port) is False


def test_is_port_in_use_returns_true_for_bound_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        s.listen(1)
        bound_port = s.getsockname()[1]
        assert _is_port_in_use("127.0.0.1", bound_port) is True


def test_find_free_port_returns_start_when_free():
    # bind-only socket — no TIME_WAIT, port is free immediately on close
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        free_port = s.getsockname()[1]
    assert _find_free_port(free_port) == free_port


def test_find_free_port_skips_occupied_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        s.listen(1)
        occupied = s.getsockname()[1]
        result = _find_free_port(occupied)
    assert result > occupied


from pathlib import Path
from unittest.mock import patch

from skills_vis.main import _default_db_path, _resolve_db_path


def test_resolve_db_path_with_explicit_arg():
    assert _resolve_db_path("/tmp/custom.db") == Path("/tmp/custom.db")


def test_resolve_db_path_none_returns_default():
    result = _resolve_db_path(None)
    assert result == _default_db_path()
    assert result.name == "skills.db"
    assert "skills-vis" in str(result)


@patch("platform.system", return_value="Darwin")
def test_default_db_path_macos(_mock):
    p = _default_db_path()
    assert str(p).startswith(str(Path.home() / "Library" / "Application Support"))
    assert "skills-vis" in str(p)
    assert p.name == "skills.db"


@patch("platform.system", return_value="Linux")
def test_default_db_path_linux_no_xdg(_mock, monkeypatch):
    monkeypatch.delenv("XDG_DATA_HOME", raising=False)
    p = _default_db_path()
    assert str(p).startswith(str(Path.home() / ".local" / "share"))
    assert "skills-vis" in str(p)


@patch("platform.system", return_value="Linux")
def test_default_db_path_linux_with_xdg(_mock, monkeypatch, tmp_path):
    monkeypatch.setenv("XDG_DATA_HOME", str(tmp_path))
    p = _default_db_path()
    assert str(p).startswith(str(tmp_path))
    assert "skills-vis" in str(p)


@patch("platform.system", return_value="Windows")
def test_default_db_path_windows(_mock, monkeypatch, tmp_path):
    monkeypatch.setenv("APPDATA", str(tmp_path))
    p = _default_db_path()
    assert str(p).startswith(str(tmp_path))
    assert "skills-vis" in str(p)


from skills_vis.main import _banner, _collapse_home


def test_collapse_home_replaces_home_prefix():
    home = Path.home()
    result = _collapse_home(home / "docs" / "file.txt")
    assert result == "~/docs/file.txt"


def test_collapse_home_exact_home():
    result = _collapse_home(Path.home())
    assert result == "~"


def test_collapse_home_leaves_non_home_path():
    result = _collapse_home(Path("/tmp/other/file.db"))
    assert result == "/tmp/other/file.db"


def test_banner_contains_url():
    b = _banner("http://127.0.0.1:8001", Path("/tmp/s.db"), 8001, "auto-detected", use_color=False)
    assert "http://127.0.0.1:8001" in b


def test_banner_contains_db_path():
    b = _banner("http://127.0.0.1:8001", Path("/tmp/s.db"), 8001, "auto-detected", use_color=False)
    assert "/tmp/s.db" in b


def test_banner_contains_port_source_auto():
    b = _banner("http://127.0.0.1:8001", Path("/tmp/s.db"), 8001, "auto-detected", use_color=False)
    assert "auto-detected" in b


def test_banner_contains_port_source_flag():
    b = _banner("http://127.0.0.1:9000", Path("/tmp/s.db"), 9000, "--port", use_color=False)
    assert "--port" in b


def test_banner_contains_port_number():
    b = _banner("http://127.0.0.1:8042", Path("/tmp/s.db"), 8042, "auto-detected", use_color=False)
    assert "8042" in b


def test_banner_no_ansi_when_color_false():
    b = _banner("http://127.0.0.1:8001", Path("/tmp/s.db"), 8001, "auto-detected", use_color=False)
    assert "\033[" not in b


def test_banner_has_ansi_when_color_true():
    b = _banner("http://127.0.0.1:8001", Path("/tmp/s.db"), 8001, "auto-detected", use_color=True)
    assert "\033[" in b
