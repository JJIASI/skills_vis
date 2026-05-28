"""Skill importer: scan and copy skills from local paths or remote repos."""
from __future__ import annotations

import base64
import logging
import os
import re
import shutil
import subprocess
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse, quote

logger = logging.getLogger(__name__)


import httpx  # used in scan_github / scan_gitlab (Tasks 5–6)

# Scaffolding imports for Tasks 4–6
if __package__:
    from .schemas import ImportSkillsRequest
else:
    from schemas import ImportSkillsRequest


@dataclass
class SkillInfo:
    name: str
    description: str = ""


@dataclass
class ImportResult:
    imported: list[str] = field(default_factory=list)
    skipped: list[str] = field(default_factory=list)
    destination: str = ""


class SkillConflictError(Exception):
    """Raised when skills already exist at destination and have no resolution."""

    def __init__(self, conflicts: list[str]):
        self.conflicts = conflicts
        super().__init__(f"Skill conflicts: {conflicts}")


class SkillMissingAtSourceError(Exception):
    """Raised when a requested skill name cannot be found at the source."""


def _parse_frontmatter_description(text: str) -> str:
    """Extract the `description` field from YAML frontmatter. Returns '' on any failure."""
    try:
        if not text.startswith("---"):
            return ""
        end = text.index("---", 3)
        yaml_block = text[3:end]
        for line in yaml_block.splitlines():
            if line.startswith("description:"):
                value = line[len("description:"):].strip()
                if len(value) >= 2 and value[0] == value[-1] and value[0] in ('"', "'"):
                    value = value[1:-1]
                return value
    except (ValueError, IndexError):
        pass
    return ""


def scan_local(root: Path) -> list[SkillInfo]:
    """Recursively scan for skill folders (any depth) containing SKILL.md."""
    results = []
    try:
        skill_mds = sorted(root.rglob("SKILL.md"))
    except OSError:
        return []
    for skill_md in skill_mds:
        skill_dir = skill_md.parent
        if skill_dir == root:
            continue  # skip SKILL.md at root level
        rel = skill_dir.relative_to(root)
        name = rel.as_posix()
        try:
            text = skill_md.read_text(encoding="utf-8")
        except OSError:
            continue
        description = _parse_frontmatter_description(text)
        results.append(SkillInfo(name=name, description=description))
    return results


def scan_github(url: str, subfolder: str = "") -> list[SkillInfo]:
    """Scan a GitHub repo for skills using the REST API."""
    match = re.match(r"https?://github\.com/([^/]+)/([^/.]+?)(?:\.git)?/?$", url)
    if not match:
        raise ValueError(f"Unsupported GitHub URL: {url}")
    owner, repo = match.group(1), match.group(2)
    subfolder = subfolder.rstrip("/")

    tree_url = f"https://api.github.com/repos/{owner}/{repo}/git/trees/HEAD?recursive=1"
    resp = httpx.get(tree_url, timeout=30, headers={"Accept": "application/vnd.github+json"})
    resp.raise_for_status()

    prefix = f"{subfolder}/" if subfolder else ""
    skill_dirs: dict[str, str] = {}
    for item in resp.json().get("tree", []):
        if item.get("type") != "blob":
            continue
        path = item["path"]
        if not path.endswith("/SKILL.md"):
            continue
        if not path.startswith(prefix):
            continue
        relative = path[len(prefix):]  # e.g. "brainstorming/SKILL.md"
        parts = relative.split("/")
        if len(parts) >= 2 and parts[-1] == "SKILL.md":
            skill_name = "/".join(parts[:-1])
            skill_dirs[skill_name] = path

    results = []
    for dir_name, skill_md_path in sorted(skill_dirs.items()):
        contents_url = f"https://api.github.com/repos/{owner}/{repo}/contents/{skill_md_path}"
        try:
            r = httpx.get(contents_url, timeout=30, headers={"Accept": "application/vnd.github+json"})
            r.raise_for_status()
            raw = base64.b64decode(r.json()["content"].replace("\n", "")).decode("utf-8")
            description = _parse_frontmatter_description(raw)
        except Exception:
            description = ""
        results.append(SkillInfo(name=dir_name, description=description))
    return results


def scan_gitlab(url: str, subfolder: str = "") -> list[SkillInfo]:
    """Scan a GitLab repo for skills using the REST API (recursive)."""
    match = re.match(r"https?://gitlab\.com/([^?#]+?)(?:\.git)?/?$", url)
    if not match:
        raise ValueError(f"Unsupported GitLab URL: {url}")
    project_path = match.group(1).strip("/")
    parts = project_path.split("/")
    if not (2 <= len(parts) <= 3):
        raise ValueError(f"Unsupported GitLab URL (expected namespace/project, got nesting >1 group level): {url}")

    encoded_path = quote(project_path, safe="")
    subfolder = subfolder.rstrip("/")

    tree_url = f"https://gitlab.com/api/v4/projects/{encoded_path}/repository/tree"
    params: dict = {"recursive": "true", "per_page": "100", "page": "1"}
    if subfolder:
        params["path"] = subfolder

    prefix = f"{subfolder}/" if subfolder else ""
    results = []
    while True:
        resp = httpx.get(tree_url, params=params, timeout=30)
        resp.raise_for_status()
        entries = resp.json()
        if not entries:
            break
        for entry in entries:
            if entry.get("type") != "blob" or entry.get("name") != "SKILL.md":
                continue
            skill_md_path = entry["path"]
            if not skill_md_path.startswith(prefix):
                continue
            relative = skill_md_path[len(prefix):]
            rel_parts = relative.split("/")
            if len(rel_parts) < 2:
                continue
            dir_name = "/".join(rel_parts[:-1])

            encoded_file = quote(skill_md_path, safe="")
            file_url = f"https://gitlab.com/api/v4/projects/{encoded_path}/repository/files/{encoded_file}/raw"
            try:
                r = httpx.get(file_url, timeout=30)
                if r.status_code == 404:
                    continue
                r.raise_for_status()
                description = _parse_frontmatter_description(r.text)
            except Exception:
                description = ""
            results.append(SkillInfo(name=dir_name, description=description))
        next_page = resp.headers.get("X-Next-Page", "")
        if not next_page:
            break
        params["page"] = next_page
    return sorted(results, key=lambda s: s.name)


def _clone_to_tempdir(url: str) -> tuple[str, tempfile.TemporaryDirectory]:
    """Clone a repo with --depth=1 to a new temp dir. Returns (clone_path, tmpdir_obj)."""
    tmpdir_obj = tempfile.TemporaryDirectory()
    clone_dir = os.path.join(tmpdir_obj.name, "repo")
    try:
        result = subprocess.run(
            ["git", "clone", "--depth=1", url, clone_dir],
            capture_output=True,
            timeout=60,
        )
    except subprocess.TimeoutExpired as exc:
        exc.process.kill()
        exc.process.wait()
        tmpdir_obj.cleanup()
        raise RuntimeError(f"git clone timed out for: {url}")
    if result.returncode != 0:
        tmpdir_obj.cleanup()
        raise RuntimeError(f"git clone failed: {result.stderr.decode(errors='replace')}")
    return clone_dir, tmpdir_obj


def import_skills(request: ImportSkillsRequest, active_root: Path) -> ImportResult:
    """Copy selected skills from the source to active_root."""
    if not request.skill_names:
        return ImportResult(destination=str(active_root))

    # Guard against path traversal via skill_names
    for name in request.skill_names:
        if not name:
            raise ValueError(f"Invalid skill name: {name!r}")
        p = Path(name)
        if p.is_absolute():
            raise ValueError(f"Invalid skill name: {name!r}")
        if name in (".", ".."):
            raise ValueError(f"Invalid skill name: {name!r}")
        for part in p.parts:
            if part in (".", ".."):
                raise ValueError(f"Invalid skill name: {name!r}")

    subfolder = (request.subfolder or "").strip("/")
    tmpdir_obj: Optional[tempfile.TemporaryDirectory] = None

    try:
        if request.source == "local":
            source_root = Path(request.path)
            if subfolder:
                source_root = source_root / subfolder
        else:
            clone_dir, tmpdir_obj = _clone_to_tempdir(request.url)
            source_root = Path(clone_dir)
            if subfolder:
                source_root = source_root / subfolder

        # Verify all skill names exist at source before copying anything
        for name in request.skill_names:
            if not (source_root / name).is_dir():
                raise SkillMissingAtSourceError(f"Skill not found at source: {name}")

        # Collect unresolved conflicts
        conflicts = [
            name for name in request.skill_names
            if (active_root / name).exists() and name not in request.conflict_resolution
        ]
        if conflicts:
            raise SkillConflictError(conflicts)

        # Execute copies
        imported: list[str] = []
        skipped: list[str] = []
        for name in request.skill_names:
            dest = active_root / name
            resolution = request.conflict_resolution.get(name)
            if dest.exists():
                if resolution == "skip":
                    skipped.append(name)
                    continue
                # Atomic overwrite: copy to temp, then swap
                tmp_dest = dest.parent / f"__tmp_{dest.name}"
                if tmp_dest.exists():
                    shutil.rmtree(tmp_dest)
                shutil.copytree(str(source_root / name), str(tmp_dest))
                shutil.rmtree(dest)
                tmp_dest.rename(dest)
            else:
                dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.copytree(str(source_root / name), str(dest))
            imported.append(name)

        return ImportResult(imported=imported, skipped=skipped, destination=str(active_root))
    finally:
        if tmpdir_obj:
            tmpdir_obj.cleanup()


def scan_via_clone(url: str, subfolder: str = "") -> list[SkillInfo]:
    """Clone a repo with --depth=1 and scan it locally."""
    clone_dir, tmpdir_obj = _clone_to_tempdir(url)
    try:
        scan_root = Path(clone_dir)
        if subfolder:
            scan_root = scan_root / subfolder
            if not scan_root.exists():
                raise FileNotFoundError(f"Subfolder not found in repo: {subfolder}")
        return scan_local(scan_root)
    finally:
        tmpdir_obj.cleanup()


def _get_url_host(url: str) -> str:
    return urlparse(url).hostname or ""


def scan_skills(
    source: str,
    url: str | None,
    path: str | None,
    subfolder: str | None,
) -> list[SkillInfo]:
    """Dispatch to the correct scan strategy.

    For local source, scans the given filesystem path.
    For remote sources, routing is determined by URL hostname:
    github.com → scan_github (fallback: clone), gitlab.com → scan_gitlab
    (fallback: clone), all other hosts → scan_via_clone directly.
    """
    subfolder = (subfolder or "").rstrip("/")

    if source == "local":
        if not path:
            raise ValueError("path is required for local source")
        target = Path(path)
        if not target.exists():
            raise FileNotFoundError(f"Path does not exist: {path}")
        if subfolder:
            target = target / subfolder
            if not target.exists():
                raise FileNotFoundError(f"Subfolder does not exist: {path}/{subfolder}")
        return scan_local(target)

    host = _get_url_host(url or "")

    if host == "github.com":
        try:
            return scan_github(url, subfolder)
        except Exception as exc:
            logger.warning("GitHub API scan failed (%s), falling back to clone: %s", type(exc).__name__, exc)
    elif host == "gitlab.com":
        try:
            return scan_gitlab(url, subfolder)
        except Exception as exc:
            logger.warning("GitLab API scan failed (%s), falling back to clone: %s", type(exc).__name__, exc)

    return scan_via_clone(url, subfolder)


def get_source_label(
    source: str,
    url: str | None,
    path: str | None,
    subfolder: str | None,
) -> str:
    """Build a human-readable source label for the scan response."""
    if source == "local":
        return path or ""
    subfolder = (subfolder or "").rstrip("/")
    if url:
        match = re.match(r"https?://[^/]+/([^?#]+?)(?:\.git)?/?$", url)
        if match:
            repo_part = match.group(1).strip("/")
            if subfolder:
                return f"{repo_part} • {subfolder}/"
            return repo_part
    return url or ""
