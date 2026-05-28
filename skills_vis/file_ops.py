import shutil
from pathlib import Path


def normalize_root(raw_path: str) -> Path:
    root = Path(raw_path).expanduser().resolve()
    if not root.exists() or not root.is_dir():
        raise FileNotFoundError(f"Root directory does not exist: {root}")
    return root


def ensure_within_root(root: Path, candidate: Path) -> Path:
    resolved = candidate.expanduser().resolve()
    try:
        resolved.relative_to(root)
    except ValueError as exc:
        raise ValueError(f"Path is outside the allowed root: {resolved}") from exc
    return resolved


MAX_TEXT_BYTES = 1_000_000


def write_file(root: Path, target: Path, content: str) -> Path:
    safe_path = ensure_within_root(root, target)
    if safe_path.is_dir():
        raise IsADirectoryError(f"Target is a directory, not a file: {safe_path}")
    if not safe_path.exists():
        raise FileNotFoundError(f"File does not exist: {safe_path}")
    safe_path.write_text(content, encoding="utf-8")
    return safe_path


def rename_path(root: Path, source: Path, new_name: str) -> Path:
    safe_source = ensure_within_root(root, source)
    if not safe_source.exists():
        raise FileNotFoundError(f"Source path does not exist: {safe_source}")
    if Path(new_name).name != new_name:
        raise ValueError("Rename target must be a basename only")
    destination = ensure_within_root(root, safe_source.with_name(new_name))
    if destination.exists():
        raise FileExistsError(f"Path already exists: {destination}")
    safe_source.rename(destination)
    return destination


def create_folder(root: Path, target: Path) -> Path:
    safe_path = ensure_within_root(root, target)
    safe_path.mkdir(parents=True, exist_ok=False)
    return safe_path


def create_file(root: Path, target: Path, content: str) -> Path:
    safe_path = ensure_within_root(root, target)
    if safe_path.exists():
        raise FileExistsError(f"Path already exists: {safe_path}")
    if not safe_path.parent.exists():
        raise FileNotFoundError(f"Parent directory does not exist: {safe_path.parent}")
    safe_path.write_text(content, encoding="utf-8")
    return safe_path


def delete_file(root: Path, target: Path) -> None:
    safe_path = ensure_within_root(root, target)
    if safe_path.is_dir():
        raise IsADirectoryError(f"Target is a directory, not a file: {safe_path}")
    if not safe_path.exists():
        raise FileNotFoundError(f"Path does not exist: {safe_path}")
    safe_path.unlink()


def delete_folder(root: Path, target: Path) -> None:
    safe_path = ensure_within_root(root, target)
    if safe_path.is_file():
        raise NotADirectoryError(f"Target is a file, not a directory: {safe_path}")
    if not safe_path.exists():
        raise FileNotFoundError(f"Path does not exist: {safe_path}")
    shutil.rmtree(safe_path)

def build_tree(root: Path, current: Path, depth: int = 1, _visited: set = None) -> dict:
    if _visited is None:
        _visited = set()

    is_dir = current.is_dir()   # False for broken/circular symlinks
    is_file = current.is_file()  # False for broken/circular symlinks

    if not is_dir and not is_file:
        # Broken symlink, circular symlink, or special entry (FIFO, device, socket)
        return None

    try:
        _stat = current.stat()
        mtime = _stat.st_mtime
        atime = _stat.st_atime
    except (OSError, ValueError):
        mtime = 0
        atime = 0

    node = {
        "name": current.name,
        "path": str(current),
        "type": "folder" if is_dir else "file",
        "mtime": mtime,
        "atime": atime,
    }

    if is_file:
        node["is_skill"] = current.name == "SKILL.md"
        return node

    # Guard against symlinks that resolve to an already-visited directory (circular within root)
    try:
        real = current.resolve()
    except (OSError, ValueError):
        return None
    if real in _visited:
        return None
    _visited.add(real)

    children = []
    for child in sorted(current.iterdir(), key=lambda item: (item.is_file(), item.name.lower())):
        try:
            ensure_within_root(root, child)
        except (ValueError, OSError):
            continue

        if depth > 0 and child.is_dir():
            # Shallow mode: emit a folder stub instead of recursing.
            # children_loaded=False means the client must fetch children on demand.
            # children_loaded=True means the folder is empty; nothing to fetch.
            try:
                _cs = child.stat()
                child_mtime = _cs.st_mtime
                child_atime = _cs.st_atime
            except (OSError, ValueError):
                child_mtime = 0
                child_atime = 0
            try:
                has_content = any(True for _ in child.iterdir())
            except OSError:
                has_content = False
            children.append({
                "name": child.name,
                "path": str(child),
                "type": "folder",
                "mtime": child_mtime,
                "atime": child_atime,
                "children": [],
                "children_loaded": not has_content,
            })
        else:
            # depth=-1 (unlimited) or child is a file: recurse normally.
            child_node = build_tree(root, child, depth, _visited)
            if child_node is not None:
                children.append(child_node)

    node["children"] = children
    node["children_loaded"] = True
    return node

def read_file(root: Path, target: Path) -> dict:
    safe_path = ensure_within_root(root, target)
    raw = safe_path.read_bytes()
    if b"\x00" in raw[:1024] or len(raw) > MAX_TEXT_BYTES:
        return {"path": str(safe_path), "kind": "binary", "content": None}
    try:
        return {"path": str(safe_path), "kind": "text", "content": raw.decode("utf-8")}
    except UnicodeDecodeError:
        return {"path": str(safe_path), "kind": "binary", "content": None}
