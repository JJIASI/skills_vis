from typing import Literal

from pydantic import BaseModel, model_validator


class SaveFileRequest(BaseModel):
    path: str
    content: str


class RenameRequest(BaseModel):
    old: str
    new: str


class CreateFileRequest(BaseModel):
    path: str
    content: str


class CreateFolderRequest(BaseModel):
    path: str


class CreateSkillRequest(BaseModel):
    label: str | None = None
    path: str


class UpdateSkillRequest(BaseModel):
    label: str | None = None
    path: str


def _validate_source_fields(source: str, url: str | None, path: str | None) -> None:
    if source in ("github", "gitlab") and not url:
        raise ValueError("url is required for github/gitlab sources")
    if source == "local" and not path:
        raise ValueError("path is required for local source")


class ScanSkillsRequest(BaseModel):
    source: Literal["github", "gitlab", "local"]
    url: str | None = None
    path: str | None = None
    subfolder: str | None = None

    @model_validator(mode="after")
    def check_source_fields(self):
        _validate_source_fields(self.source, self.url, self.path)
        return self


class ImportSkillsRequest(BaseModel):
    source: Literal["github", "gitlab", "local"]
    url: str | None = None
    path: str | None = None
    subfolder: str | None = None
    skill_names: list[str]
    conflict_resolution: dict[str, Literal["overwrite", "skip"]] = {}

    @model_validator(mode="after")
    def check_source_fields(self):
        _validate_source_fields(self.source, self.url, self.path)
        return self


class StartSessionRequest(BaseModel):
    agent: str | None = None
    graph_root: str | None = None


class RecordEventRequest(BaseModel):
    session_id: str | None = None
    skill_path: str
    skill_name: str
    metadata: dict | None = None
