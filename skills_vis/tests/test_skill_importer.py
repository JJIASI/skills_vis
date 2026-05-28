"""Tests for skill_importer — local scanning, remote scanning, import logic."""
import base64
import os
import subprocess
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from skills_vis.skill_importer import (
    SkillInfo,
    scan_local,
    scan_github,
    scan_gitlab,
    scan_via_clone,
    SkillConflictError,
    SkillMissingAtSourceError,
    import_skills,
    _clone_to_tempdir,
    get_source_label,
    scan_skills,
)
from skills_vis.schemas import ImportSkillsRequest


def make_skill_dir(root: Path, name: str, content: str | None) -> Path:
    d = root / name
    d.mkdir()
    if content is not None:
        (d / "SKILL.md").write_text(content, encoding="utf-8")
    return d


class TestScanLocal:
    def test_returns_skills_with_names_and_descriptions(self, tmp_path):
        make_skill_dir(tmp_path, "brainstorming", "---\nname: brainstorming\ndescription: Use before coding\n---\n# Body")
        make_skill_dir(tmp_path, "writing-plans", "---\ndescription: Plan before writing\n---")
        results = scan_local(tmp_path)
        names = {s.name for s in results}
        assert "brainstorming" in names
        assert "writing-plans" in names

    def test_uses_directory_name_not_frontmatter_name(self, tmp_path):
        make_skill_dir(tmp_path, "my-skill-dir", "---\nname: different-name\ndescription: A skill\n---")
        results = scan_local(tmp_path)
        assert results[0].name == "my-skill-dir"

    def test_description_extracted_correctly(self, tmp_path):
        make_skill_dir(tmp_path, "skill-a", "---\ndescription: Use when you need help\n---")
        results = scan_local(tmp_path)
        assert results[0].description == "Use when you need help"

    def test_description_defaults_to_empty_when_field_absent(self, tmp_path):
        make_skill_dir(tmp_path, "no-desc", "---\nname: no-desc\n---")
        results = scan_local(tmp_path)
        assert results[0].description == ""

    def test_description_defaults_to_empty_when_no_frontmatter(self, tmp_path):
        make_skill_dir(tmp_path, "plain", "# Just a heading\nNo YAML here")
        results = scan_local(tmp_path)
        assert results[0].description == ""

    def test_description_defaults_to_empty_when_malformed_frontmatter(self, tmp_path):
        make_skill_dir(tmp_path, "bad-yaml", "---\nno closing fence")
        results = scan_local(tmp_path)
        assert results[0].description == ""

    def test_skips_dirs_without_skill_md(self, tmp_path):
        d = tmp_path / "no-skill"
        d.mkdir()
        (d / "README.md").write_text("readme")
        results = scan_local(tmp_path)
        assert results == []

    def test_finds_skill_two_levels_deep(self, tmp_path):
        nested = tmp_path / "outer" / "inner"
        nested.mkdir(parents=True)
        (nested / "SKILL.md").write_text("---\ndescription: deep\n---")
        # outer has no SKILL.md; inner is found recursively as "outer/inner"
        results = scan_local(tmp_path)
        names = [s.name for s in results]
        assert "outer/inner" in names
        assert "outer" not in names

    def test_non_directory_entries_are_skipped(self, tmp_path):
        (tmp_path / "file.txt").write_text("hello")
        results = scan_local(tmp_path)
        assert results == []

    def test_returns_empty_list_for_empty_directory(self, tmp_path):
        results = scan_local(tmp_path)
        assert results == []

    def test_quoted_description_has_quotes_stripped(self, tmp_path):
        make_skill_dir(tmp_path, "quoted", '---\ndescription: "Quoted value"\n---')
        results = scan_local(tmp_path)
        assert results[0].description == "Quoted value"

    def test_finds_nested_skill(self, tmp_path):
        nested = tmp_path / "advanced" / "brainstorming"
        nested.mkdir(parents=True)
        (nested / "SKILL.md").write_text("---\ndescription: Advanced brain\n---\n")
        results = scan_local(tmp_path)
        names = [s.name for s in results]
        assert "advanced/brainstorming" in names

    def test_nested_skill_description(self, tmp_path):
        nested = tmp_path / "category" / "myskill"
        nested.mkdir(parents=True)
        (nested / "SKILL.md").write_text("---\ndescription: My desc\n---\n")
        results = scan_local(tmp_path)
        skill = next(s for s in results if s.name == "category/myskill")
        assert skill.description == "My desc"

    def test_ignores_root_level_skill_md(self, tmp_path):
        (tmp_path / "SKILL.md").write_text("---\ndescription: root\n---\n")
        results = scan_local(tmp_path)
        assert not any(s.name == "" for s in results)
        assert len(results) == 0

    def test_mixed_depth(self, tmp_path):
        flat = tmp_path / "simple"
        flat.mkdir()
        (flat / "SKILL.md").write_text("---\ndescription: Flat\n---\n")
        deep = tmp_path / "cat" / "deep"
        deep.mkdir(parents=True)
        (deep / "SKILL.md").write_text("---\ndescription: Deep\n---\n")
        names = [s.name for s in scan_local(tmp_path)]
        assert "simple" in names
        assert "cat/deep" in names


def make_source(root: Path, skill_names: list[str]) -> Path:
    """Create a local source directory with the given skill folders."""
    src = root / "source"
    src.mkdir()
    for name in skill_names:
        d = src / name
        d.mkdir()
        (d / "SKILL.md").write_text(f"---\ndescription: {name}\n---")
    return src


class TestImportSkills:
    def test_copies_skills_to_active_root(self, tmp_path):
        src = make_source(tmp_path, ["brainstorming", "writing-plans"])
        dest = tmp_path / "graph"
        dest.mkdir()
        req = ImportSkillsRequest(source="local", path=str(src), skill_names=["brainstorming"])
        result = import_skills(req, dest)
        assert "brainstorming" in result.imported
        assert (dest / "brainstorming" / "SKILL.md").exists()

    def test_returns_destination_as_absolute_path(self, tmp_path):
        src = make_source(tmp_path, ["skill-a"])
        dest = tmp_path / "graph"
        dest.mkdir()
        req = ImportSkillsRequest(source="local", path=str(src), skill_names=["skill-a"])
        result = import_skills(req, dest)
        assert result.destination == str(dest)

    def test_raises_conflict_error_when_skill_exists_and_no_resolution(self, tmp_path):
        src = make_source(tmp_path, ["brainstorming"])
        dest = tmp_path / "graph"
        dest.mkdir()
        (dest / "brainstorming").mkdir()  # pre-existing
        req = ImportSkillsRequest(source="local", path=str(src), skill_names=["brainstorming"])
        with pytest.raises(SkillConflictError) as exc:
            import_skills(req, dest)
        assert "brainstorming" in exc.value.conflicts

    def test_skips_skill_when_resolution_is_skip(self, tmp_path):
        src = make_source(tmp_path, ["brainstorming"])
        dest = tmp_path / "graph"
        dest.mkdir()
        (dest / "brainstorming").mkdir()
        req = ImportSkillsRequest(
            source="local", path=str(src),
            skill_names=["brainstorming"],
            conflict_resolution={"brainstorming": "skip"},
        )
        result = import_skills(req, dest)
        assert result.skipped == ["brainstorming"]
        assert result.imported == []

    def test_overwrites_skill_when_resolution_is_overwrite(self, tmp_path):
        src = make_source(tmp_path, ["brainstorming"])
        dest = tmp_path / "graph"
        dest.mkdir()
        existing = dest / "brainstorming"
        existing.mkdir()
        (existing / "old.txt").write_text("old")
        req = ImportSkillsRequest(
            source="local", path=str(src),
            skill_names=["brainstorming"],
            conflict_resolution={"brainstorming": "overwrite"},
        )
        result = import_skills(req, dest)
        assert result.imported == ["brainstorming"]
        assert not (dest / "brainstorming" / "old.txt").exists()
        assert (dest / "brainstorming" / "SKILL.md").exists()

    def test_conflict_check_is_all_or_nothing_before_any_copy(self, tmp_path):
        src = make_source(tmp_path, ["a", "b"])
        dest = tmp_path / "graph"
        dest.mkdir()
        (dest / "a").mkdir()  # conflict on "a"
        req = ImportSkillsRequest(source="local", path=str(src), skill_names=["a", "b"])
        with pytest.raises(SkillConflictError):
            import_skills(req, dest)
        assert not (dest / "b").exists()  # "b" was NOT copied before conflict raised

    def test_raises_skill_missing_when_name_not_in_source(self, tmp_path):
        src = make_source(tmp_path, ["brainstorming"])
        dest = tmp_path / "graph"
        dest.mkdir()
        req = ImportSkillsRequest(source="local", path=str(src), skill_names=["nonexistent"])
        with pytest.raises(SkillMissingAtSourceError, match="nonexistent"):
            import_skills(req, dest)

    def test_empty_skill_names_returns_empty_result(self, tmp_path):
        src = make_source(tmp_path, [])
        dest = tmp_path / "graph"
        dest.mkdir()
        req = ImportSkillsRequest(source="local", path=str(src), skill_names=[])
        result = import_skills(req, dest)
        assert result.imported == []
        assert result.skipped == []

    def test_rejects_dotdot_component(self, tmp_path):
        req = ImportSkillsRequest(source="local", path=str(tmp_path), skill_names=["../evil"])
        with pytest.raises(ValueError, match="Invalid skill name"):
            import_skills(req, tmp_path)

    def test_allows_slash_in_skill_name(self, tmp_path):
        nested_src = tmp_path / "src" / "advanced" / "brainstorming"
        nested_src.mkdir(parents=True)
        (nested_src / "SKILL.md").write_text("")
        dest_root = tmp_path / "dest"
        dest_root.mkdir()
        req = ImportSkillsRequest(source="local", path=str(tmp_path / "src"), skill_names=["advanced/brainstorming"])
        result = import_skills(req, dest_root)
        assert "advanced/brainstorming" in result.imported
        assert (dest_root / "advanced" / "brainstorming").is_dir()

    def test_rejects_absolute_skill_name(self, tmp_path):
        req = ImportSkillsRequest(source="local", path=str(tmp_path), skill_names=["/etc/passwd"])
        with pytest.raises(ValueError, match="Invalid skill name"):
            import_skills(req, tmp_path)

    def test_rejects_empty_skill_name(self, tmp_path):
        req = ImportSkillsRequest(source="local", path=str(tmp_path), skill_names=[""])
        with pytest.raises(ValueError, match="Invalid skill name"):
            import_skills(req, tmp_path)

    def test_raises_value_error_on_path_traversal_in_skill_name(self, tmp_path):
        src = make_source(tmp_path, ["brainstorming"])
        dest = tmp_path / "graph"
        dest.mkdir()
        for bad_name in ["../escape", ".", ".."]:
            req = ImportSkillsRequest(source="local", path=str(src), skill_names=[bad_name])
            with pytest.raises(ValueError, match="Invalid skill name"):
                import_skills(req, dest)


class TestCloneToTempdir:
    def test_raises_runtime_error_on_nonzero_exit(self):
        mock_result = MagicMock()
        mock_result.returncode = 1
        mock_result.stderr = b"fatal: repository not found"
        with patch("skills_vis.skill_importer.subprocess.run", return_value=mock_result):
            with pytest.raises(RuntimeError, match="git clone failed"):
                _clone_to_tempdir("https://github.com/x/y")

    def test_raises_runtime_error_on_timeout(self):
        mock_proc = MagicMock()
        timeout_exc = subprocess.TimeoutExpired(cmd=["git"], timeout=60)
        timeout_exc.process = mock_proc
        with patch("skills_vis.skill_importer.subprocess.run", side_effect=timeout_exc):
            with pytest.raises(RuntimeError, match="timed out"):
                _clone_to_tempdir("https://github.com/x/y")
        mock_proc.kill.assert_called_once()
        mock_proc.wait.assert_called_once()


class TestImportSkillsRemote:
    def test_remote_source_calls_clone_and_copies(self, tmp_path):
        src = tmp_path / "fake_clone"
        src.mkdir()
        skill_dir = src / "brainstorming"
        skill_dir.mkdir()
        (skill_dir / "SKILL.md").write_text("---\ndescription: test\n---")
        dest = tmp_path / "graph"
        dest.mkdir()

        def fake_clone(url):
            return str(src), MagicMock(cleanup=MagicMock())

        with patch("skills_vis.skill_importer._clone_to_tempdir", side_effect=fake_clone):
            req = ImportSkillsRequest(
                source="github",
                url="https://github.com/org/repo",
                skill_names=["brainstorming"],
            )
            result = import_skills(req, dest)
        assert "brainstorming" in result.imported
        assert (dest / "brainstorming" / "SKILL.md").exists()


class TestScanGithub:
    def _make_tree_response(self, paths: list[str]) -> dict:
        return {"tree": [{"path": p, "type": "blob"} for p in paths]}

    def _make_contents_response(self, description: str) -> dict:
        content = f"---\ndescription: {description}\n---"
        return {
            "content": base64.b64encode(content.encode()).decode() + "\n",
            "encoding": "base64",
        }

    def test_returns_skills_at_root_level(self):
        tree = self._make_tree_response(["brainstorming/SKILL.md", "writing-plans/SKILL.md"])
        contents_a = self._make_contents_response("Use before coding")
        contents_b = self._make_contents_response("Use when planning")

        responses = [
            MagicMock(status_code=200, raise_for_status=MagicMock(), json=MagicMock(return_value=tree)),
            MagicMock(status_code=200, raise_for_status=MagicMock(), json=MagicMock(return_value=contents_a)),
            MagicMock(status_code=200, raise_for_status=MagicMock(), json=MagicMock(return_value=contents_b)),
        ]

        with patch("skills_vis.skill_importer.httpx") as mock_httpx:
            mock_httpx.get.side_effect = responses
            results = scan_github("https://github.com/org/repo")

        names = {s.name for s in results}
        assert "brainstorming" in names
        assert "writing-plans" in names

    def test_filters_by_prefix_and_includes_nested(self):
        tree = self._make_tree_response([
            "skills/brainstorming/SKILL.md",   # direct child of subfolder
            "other/brainstorming/SKILL.md",     # wrong prefix — excluded
            "skills/a/b/SKILL.md",              # nested under subfolder — included
        ])
        contents_a = self._make_contents_response("A skill")
        contents_b = self._make_contents_response("Nested skill")

        with patch("skills_vis.skill_importer.httpx") as mock_httpx:
            mock_httpx.get.side_effect = [
                MagicMock(raise_for_status=MagicMock(), json=MagicMock(return_value=tree)),
                MagicMock(raise_for_status=MagicMock(), json=MagicMock(return_value=contents_a)),
                MagicMock(raise_for_status=MagicMock(), json=MagicMock(return_value=contents_b)),
            ]
            results = scan_github("https://github.com/org/repo", subfolder="skills")

        names = {s.name for s in results}
        assert "brainstorming" in names
        assert "a/b" in names
        assert "brainstorming" not in {s.name for s in results if s.name.startswith("other")}

    def test_finds_nested_skill(self):
        """scan_github finds skills in subdirectories."""
        tree = self._make_tree_response(["skills/advanced/brainstorming/SKILL.md"])
        contents = self._make_contents_response("Nested")

        with patch("skills_vis.skill_importer.httpx") as mock_httpx:
            mock_httpx.get.side_effect = [
                MagicMock(raise_for_status=MagicMock(), json=MagicMock(return_value=tree)),
                MagicMock(raise_for_status=MagicMock(), json=MagicMock(return_value=contents)),
            ]
            results = scan_github("https://github.com/org/repo", subfolder="skills")
        assert any(s.name == "advanced/brainstorming" for s in results)

    def test_strips_git_suffix_from_url(self):
        tree = self._make_tree_response([])
        with patch("skills_vis.skill_importer.httpx") as mock_httpx:
            mock_httpx.get.return_value = MagicMock(raise_for_status=MagicMock(), json=MagicMock(return_value=tree))
            results = scan_github("https://github.com/org/repo.git")
        assert results == []

    def test_raises_value_error_for_unsupported_url(self):
        with pytest.raises(ValueError, match="Unsupported GitHub URL"):
            scan_github("https://github.com/org")

    def test_description_empty_when_fetch_fails(self):
        tree = self._make_tree_response(["skill-a/SKILL.md"])
        with patch("skills_vis.skill_importer.httpx") as mock_httpx:
            mock_httpx.get.side_effect = [
                MagicMock(raise_for_status=MagicMock(), json=MagicMock(return_value=tree)),
                Exception("network error"),
            ]
            results = scan_github("https://github.com/org/repo")
        assert results[0].name == "skill-a"
        assert results[0].description == ""


class TestScanGitlab:
    def _make_blob_entry(self, path: str) -> dict:
        """Create a blob entry for a SKILL.md file at the given path."""
        return {"name": "SKILL.md", "type": "blob", "path": path}

    def _make_tree_mock(self, tree_data, next_page=""):
        """Create a mock HTTP response for a GitLab tree API page."""
        headers = MagicMock()
        headers.get.return_value = next_page
        return MagicMock(
            raise_for_status=MagicMock(),
            json=MagicMock(return_value=tree_data),
            headers=headers,
        )

    def test_returns_skills_at_root_level(self):
        tree = [
            self._make_blob_entry("brainstorming/SKILL.md"),
            self._make_blob_entry("writing-plans/SKILL.md"),
        ]
        skill_a_raw = "---\ndescription: Use before coding\n---"
        skill_b_raw = "---\ndescription: Plan first\n---"

        with patch("skills_vis.skill_importer.httpx") as mock_httpx:
            mock_httpx.get.side_effect = [
                self._make_tree_mock(tree),
                MagicMock(status_code=200, raise_for_status=MagicMock(), text=skill_a_raw),
                MagicMock(status_code=200, raise_for_status=MagicMock(), text=skill_b_raw),
            ]
            results = scan_gitlab("https://gitlab.com/org/repo")

        assert {s.name for s in results} == {"brainstorming", "writing-plans"}

    def test_omits_path_param_when_no_subfolder(self):
        with patch("skills_vis.skill_importer.httpx") as mock_httpx:
            mock_httpx.get.return_value = MagicMock(
                raise_for_status=MagicMock(), json=MagicMock(return_value=[])
            )
            scan_gitlab("https://gitlab.com/org/repo")
        call_kwargs = mock_httpx.get.call_args[1]
        assert "path" not in call_kwargs.get("params", {})

    def test_includes_subfolder_in_path_param(self):
        with patch("skills_vis.skill_importer.httpx") as mock_httpx:
            mock_httpx.get.return_value = MagicMock(
                raise_for_status=MagicMock(), json=MagicMock(return_value=[])
            )
            scan_gitlab("https://gitlab.com/org/repo", subfolder="skills")
        call_kwargs = mock_httpx.get.call_args[1]
        assert call_kwargs.get("params", {}).get("path") == "skills"

    def test_skips_directory_if_skill_md_returns_404(self):
        tree = [self._make_blob_entry("some-skill/SKILL.md")]
        with patch("skills_vis.skill_importer.httpx") as mock_httpx:
            mock_httpx.get.side_effect = [
                self._make_tree_mock(tree),
                MagicMock(status_code=404, raise_for_status=MagicMock()),
            ]
            results = scan_gitlab("https://gitlab.com/org/repo")
        assert results == []

    def test_raises_value_error_for_deep_nesting(self):
        with pytest.raises(ValueError, match="nesting"):
            scan_gitlab("https://gitlab.com/a/b/c/d")

    def test_description_empty_when_fetch_raises(self):
        tree = [self._make_blob_entry("skill-a/SKILL.md")]
        with patch("skills_vis.skill_importer.httpx") as mock_httpx:
            mock_httpx.get.side_effect = [
                self._make_tree_mock(tree),
                Exception("network error"),
            ]
            results = scan_gitlab("https://gitlab.com/org/repo")
        assert results[0].name == "skill-a"
        assert results[0].description == ""

    def test_finds_nested_skill(self):
        """scan_gitlab finds skills in subdirectories with recursive=true."""
        tree = [self._make_blob_entry("advanced/brainstorming/SKILL.md")]
        with patch("skills_vis.skill_importer.httpx") as mock_httpx:
            mock_httpx.get.side_effect = [
                self._make_tree_mock(tree),
                MagicMock(status_code=200, raise_for_status=MagicMock(), text="---\ndescription: Deep\n---\n"),
            ]
            results = scan_gitlab("https://gitlab.com/org/repo")
        assert any(s.name == "advanced/brainstorming" for s in results)

    def test_paginates_using_x_next_page_header(self):
        """scan_gitlab fetches subsequent pages when X-Next-Page header is present."""
        tree_page1 = [self._make_blob_entry("skill-a/SKILL.md")]
        tree_page2 = [self._make_blob_entry("skill-b/SKILL.md")]
        skill_a_raw = "---\ndescription: Skill A\n---"
        skill_b_raw = "---\ndescription: Skill B\n---"

        with patch("skills_vis.skill_importer.httpx") as mock_httpx:
            mock_httpx.get.side_effect = [
                self._make_tree_mock(tree_page1, next_page="2"),
                MagicMock(status_code=200, raise_for_status=MagicMock(), text=skill_a_raw),
                self._make_tree_mock(tree_page2, next_page=""),
                MagicMock(status_code=200, raise_for_status=MagicMock(), text=skill_b_raw),
            ]
            results = scan_gitlab("https://gitlab.com/org/repo")

        names = {s.name for s in results}
        assert "skill-a" in names
        assert "skill-b" in names


class TestGetSourceLabel:
    def test_local_returns_path(self):
        assert get_source_label("local", None, "/tmp/skills", None) == "/tmp/skills"

    def test_repo_without_subfolder(self):
        label = get_source_label("github", "https://github.com/org/repo", None, None)
        assert label == "org/repo"

    def test_repo_with_subfolder(self):
        label = get_source_label("github", "https://github.com/org/repo", None, "skills/")
        assert label == "org/repo • skills/"

    def test_gitlab_nested_group(self):
        label = get_source_label("gitlab", "https://gitlab.com/org/group/repo", None, None)
        assert label == "org/group/repo"


class TestScanSkills:
    def test_local_source_calls_scan_local(self, tmp_path):
        (tmp_path / "my-skill").mkdir()
        (tmp_path / "my-skill" / "SKILL.md").write_text("---\ndescription: A skill\n---")
        results = scan_skills("local", None, str(tmp_path), None)
        assert any(s.name == "my-skill" for s in results)

    def test_local_raises_file_not_found_for_missing_path(self):
        with pytest.raises(FileNotFoundError):
            scan_skills("local", None, "/nonexistent/path/xyz", None)

    def test_github_source_calls_scan_github(self):
        with patch("skills_vis.skill_importer.scan_github", return_value=[]) as mock_gh:
            scan_skills("github", "https://github.com/org/repo", None, None)
        mock_gh.assert_called_once()

    def test_github_falls_back_to_clone_on_api_failure(self):
        with patch("skills_vis.skill_importer.scan_github", side_effect=Exception("rate limited")):
            with patch("skills_vis.skill_importer.scan_via_clone", return_value=[]) as mock_clone:
                scan_skills("github", "https://github.com/org/repo", None, None)
        mock_clone.assert_called_once()

    def test_gitlab_source_calls_scan_gitlab(self):
        with patch("skills_vis.skill_importer.scan_gitlab", return_value=[]) as mock_gl:
            scan_skills("gitlab", "https://gitlab.com/org/repo", None, None)
        mock_gl.assert_called_once()

    def test_gitlab_falls_back_to_clone_on_api_failure(self):
        with patch("skills_vis.skill_importer.scan_gitlab", side_effect=Exception("forbidden")):
            with patch("skills_vis.skill_importer.scan_via_clone", return_value=[]) as mock_clone:
                scan_skills("gitlab", "https://gitlab.com/org/repo", None, None)
        mock_clone.assert_called_once()

    def test_unknown_host_goes_straight_to_clone(self):
        with patch("skills_vis.skill_importer.scan_via_clone", return_value=[]) as mock_clone:
            scan_skills("github", "https://self-hosted.example.com/org/repo", None, None)
        mock_clone.assert_called_once()


class TestScanViaClone:
    def test_raises_file_not_found_for_missing_subfolder(self, tmp_path):
        fake_clone = tmp_path / "repo"
        fake_clone.mkdir()
        from unittest.mock import MagicMock
        with patch("skills_vis.skill_importer._clone_to_tempdir",
                   return_value=(str(fake_clone), MagicMock(cleanup=MagicMock()))):
            with pytest.raises(FileNotFoundError, match="no-such-folder"):
                scan_via_clone("https://example.com/repo", subfolder="no-such-folder")
