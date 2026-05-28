"""Tests for ScanSkillsRequest and ImportSkillsRequest."""
import pytest
from pydantic import ValidationError

from skills_vis.schemas import ImportSkillsRequest, ScanSkillsRequest


class TestScanSkillsRequest:
    def test_github_requires_url(self):
        with pytest.raises(ValidationError, match="url is required"):
            ScanSkillsRequest(source="github")

    def test_gitlab_requires_url(self):
        with pytest.raises(ValidationError, match="url is required"):
            ScanSkillsRequest(source="gitlab")

    def test_local_requires_path(self):
        with pytest.raises(ValidationError, match="path is required"):
            ScanSkillsRequest(source="local")

    def test_github_valid_minimal(self):
        req = ScanSkillsRequest(source="github", url="https://github.com/org/repo")
        assert req.source == "github"
        assert req.subfolder is None

    def test_github_valid_with_subfolder(self):
        req = ScanSkillsRequest(source="github", url="https://github.com/org/repo", subfolder="skills/")
        assert req.subfolder == "skills/"

    def test_local_valid(self):
        req = ScanSkillsRequest(source="local", path="/tmp/skills")
        assert req.path == "/tmp/skills"


class TestImportSkillsRequest:
    def test_github_requires_url(self):
        with pytest.raises(ValidationError, match="url is required"):
            ImportSkillsRequest(source="github", skill_names=["a"])

    def test_local_requires_path(self):
        with pytest.raises(ValidationError, match="path is required"):
            ImportSkillsRequest(source="local", skill_names=["a"])

    def test_valid_with_conflict_resolution(self):
        req = ImportSkillsRequest(
            source="github",
            url="https://github.com/org/repo",
            skill_names=["a", "b"],
            conflict_resolution={"a": "overwrite"},
        )
        assert req.conflict_resolution == {"a": "overwrite"}
        assert req.skill_names == ["a", "b"]

    def test_conflict_resolution_defaults_to_empty(self):
        req = ImportSkillsRequest(source="local", path="/tmp/skills", skill_names=[])
        assert req.conflict_resolution == {}
