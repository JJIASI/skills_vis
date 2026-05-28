from pathlib import Path

import pytest

from skills_vis.file_ops import (
    create_file,
    create_folder,
    delete_file,
    delete_folder,
    ensure_within_root,
    normalize_root,
    rename_path,
    build_tree,
    read_file,
    write_file,
)


def test_normalize_root_rejects_missing_directory(tmp_path: Path):
    missing = tmp_path / "does-not-exist"
    try:
        normalize_root(str(missing))
    except FileNotFoundError as exc:
        assert str(missing) in str(exc)
    else:
        raise AssertionError("normalize_root should reject missing directories")


def test_ensure_within_root_rejects_escape(tmp_path: Path):
    root = tmp_path / "root"
    root.mkdir()
    escaped = root.parent / "outside.txt"
    escaped.write_text("nope", encoding="utf-8")

    try:
        ensure_within_root(root, escaped)
    except ValueError as exc:
        assert "outside the allowed root" in str(exc)
    else:
        raise AssertionError("ensure_within_root should reject escaped paths")


def test_build_tree_marks_skill_files(tmp_path: Path):
    root = tmp_path / "skills"
    child = root / "btc-model"
    child.mkdir(parents=True)
    (child / "SKILL.md").write_text("# skill", encoding="utf-8")

    tree = build_tree(root, root, depth=-1)

    assert tree["type"] == "folder"
    assert tree["children"][0]["children"][0]["is_skill"] is True


def test_build_tree_includes_mtime_for_files_and_folders(tmp_path: Path):
    root = tmp_path / "skills"
    child_dir = root / "folder"
    child_file = child_dir / "file.md"
    child_dir.mkdir(parents=True)
    child_file.write_text("# file", encoding="utf-8")

    tree = build_tree(root, root, depth=-1)
    folder = next(node for node in tree["children"] if node["name"] == "folder")
    file_node = next(node for node in folder["children"] if node["name"] == "file.md")

    assert "mtime" in tree and isinstance(tree["mtime"], (int, float))
    assert "mtime" in folder and isinstance(folder["mtime"], (int, float))
    assert "mtime" in file_node and isinstance(file_node["mtime"], (int, float))


def test_build_tree_sets_null_mtime_when_stat_fails(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    root = tmp_path / "skills"
    root.mkdir()

    real_stat = Path.stat
    root_stat_calls = 0

    def flaky_stat(path_obj: Path, *args, **kwargs):
        nonlocal root_stat_calls
        if path_obj == root:
            root_stat_calls += 1
            if root_stat_calls >= 3:
                raise OSError("stat failed")
        return real_stat(path_obj, *args, **kwargs)

    monkeypatch.setattr(Path, "stat", flaky_stat)
    tree = build_tree(root, root)
    assert tree["mtime"] == 0


def test_build_tree_skips_symlink_that_escapes_root(tmp_path: Path):
    root = tmp_path / "skills"
    root.mkdir()
    outside = tmp_path / "outside"
    outside.mkdir()
    (outside / "secret.md").write_text("secret", encoding="utf-8")
    (root / "escape").symlink_to(outside, target_is_directory=True)

    tree = build_tree(root, root)

    assert all(child["name"] != "escape" for child in tree["children"])


def test_build_tree_skips_broken_symlink(tmp_path: Path):
    root = tmp_path / "skills"
    root.mkdir()
    # Symlink points to a non-existent target within root
    (root / "broken").symlink_to(root / "nonexistent_target")

    tree = build_tree(root, root)

    assert all(child["name"] != "broken" for child in tree["children"])


def test_build_tree_skips_special_entry(tmp_path: Path):
    import os
    root = tmp_path / "skills"
    root.mkdir()
    os.mkfifo(root / "myfifo")

    tree = build_tree(root, root)

    assert all(child["name"] != "myfifo" for child in tree["children"])


def test_build_tree_no_infinite_recursion_on_cyclic_symlink(tmp_path: Path):
    root = tmp_path / "skills"
    sub = root / "sub"
    sub.mkdir(parents=True)
    # Symlink inside sub pointing back to root — infinite recursion without fix
    (sub / "loop").symlink_to(root)

    tree = build_tree(root, root, depth=-1)

    sub_node = next(c for c in tree["children"] if c["name"] == "sub")
    assert all(c["name"] != "loop" for c in sub_node["children"])


def test_read_file_rejects_binary_content(tmp_path: Path):
    root = tmp_path / "skills"
    root.mkdir()
    target = root / "image.png"
    target.write_bytes(b"\x89PNG\r\n\x1a\n")

    payload = read_file(root, target)

    assert payload["kind"] == "binary"
    assert payload["content"] is None


def test_read_file_returns_utf8_text(tmp_path: Path):
    root = tmp_path / "skills"
    root.mkdir()
    target = root / "notes.md"
    target.write_text("# Notes", encoding="utf-8")

    payload = read_file(root, target)

    assert payload["kind"] == "text"
    assert payload["content"] == "# Notes"


def test_read_file_rejects_oversize_text(tmp_path: Path):
    root = tmp_path / "skills"
    root.mkdir()
    target = root / "large.md"
    target.write_text("a" * 1_000_001, encoding="utf-8")

    payload = read_file(root, target)

    assert payload["kind"] == "binary"
    assert payload["content"] is None


def test_read_file_rejects_undecodable_non_utf8_content(tmp_path: Path):
    root = tmp_path / "skills"
    root.mkdir()
    target = root / "unknown.dat"
    target.write_bytes(b"\xff\xfe\xfd\xfc")

    payload = read_file(root, target)

    assert payload["kind"] == "binary"
    assert payload["content"] is None


def test_write_file_updates_text_content(sample_root: Path):
    target = sample_root / "notes.md"
    write_file(sample_root, target, "# updated")
    assert target.read_text(encoding="utf-8") == "# updated"


def test_rename_path_renames_file(sample_root: Path):
    source = sample_root / "notes.md"
    renamed = rename_path(sample_root, source, "renamed.md")
    assert renamed.name == "renamed.md"
    assert renamed.exists()


def test_rename_path_rejects_nested_or_absolute_targets(sample_root: Path):
    source = sample_root / "notes.md"
    with pytest.raises(ValueError):
        rename_path(sample_root, source, "nested/renamed.md")


def test_rename_path_rejects_existing_destination(sample_root: Path):
    source = sample_root / "notes.md"
    occupied = sample_root / "occupied.md"
    occupied.write_text("already here", encoding="utf-8")
    with pytest.raises(FileExistsError):
        rename_path(sample_root, source, "occupied.md")


def test_create_file_creates_utf8_file(sample_root: Path):
    created = create_file(sample_root, sample_root / "new.md", "# new")
    assert created.read_text(encoding="utf-8") == "# new"


def test_create_file_rejects_existing_path(sample_root: Path):
    existing = sample_root / "notes.md"
    with pytest.raises(FileExistsError):
        create_file(sample_root, existing, "# blocked")


def test_create_folder_creates_directory(sample_root: Path):
    created = create_folder(sample_root, sample_root / "docs")
    assert created.is_dir()


def test_delete_file_removes_file(sample_root: Path):
    target = sample_root / "notes.md"
    delete_file(sample_root, target)
    assert not target.exists()


def test_delete_folder_removes_directory(sample_root: Path):
    target = sample_root / "nested"
    delete_folder(sample_root, target)
    assert not target.exists()


def test_mutation_helpers_reject_paths_outside_root(sample_root: Path, tmp_path: Path):
    outside = tmp_path / "outside.md"
    outside.write_text("x", encoding="utf-8")

    with pytest.raises(ValueError):
        delete_file(sample_root, outside)


def test_write_file_rejects_directory_target(sample_root: Path):
    with pytest.raises(IsADirectoryError):
        write_file(sample_root, sample_root / "nested", "# oops")


def test_rename_path_rejects_missing_source(sample_root: Path):
    missing = sample_root / "ghost.md"
    with pytest.raises(FileNotFoundError):
        rename_path(sample_root, missing, "renamed.md")


def test_delete_file_rejects_directory(sample_root: Path):
    with pytest.raises(IsADirectoryError):
        delete_file(sample_root, sample_root / "nested")


def test_delete_folder_rejects_file(sample_root: Path):
    with pytest.raises(NotADirectoryError):
        delete_folder(sample_root, sample_root / "notes.md")


def test_create_file_rejects_missing_parent(sample_root: Path):
    with pytest.raises(FileNotFoundError):
        create_file(sample_root, sample_root / "no-parent" / "new.md", "# oops")


class TestBuildTreeDepth:
    def test_default_depth1_root_has_children_loaded_true(self, tmp_path: Path):
        """Root's own children are listed, so children_loaded is True on root."""
        root = tmp_path / "skills"
        (root / "nested").mkdir(parents=True)
        (root / "notes.md").write_text("# Notes", encoding="utf-8")

        tree = build_tree(root, root)

        assert tree["children_loaded"] is True

    def test_default_depth1_child_folder_is_stub_with_content(self, tmp_path: Path):
        """A child folder that has items on disk gets children: [], children_loaded: False."""
        root = tmp_path / "skills"
        nested = root / "nested"
        nested.mkdir(parents=True)
        (nested / "SKILL.md").write_text("# skill", encoding="utf-8")

        tree = build_tree(root, root)

        nested_node = next(n for n in tree["children"] if n["name"] == "nested")
        assert nested_node["type"] == "folder"
        assert nested_node["children"] == []
        assert nested_node["children_loaded"] is False

    def test_default_depth1_empty_child_folder_has_children_loaded_true(self, tmp_path: Path):
        """An empty child folder gets children_loaded: True (nothing to lazily fetch)."""
        root = tmp_path / "skills"
        (root / "empty").mkdir(parents=True)

        tree = build_tree(root, root)

        empty_node = next(n for n in tree["children"] if n["name"] == "empty")
        assert empty_node["children"] == []
        assert empty_node["children_loaded"] is True

    def test_default_depth1_includes_file_children(self, tmp_path: Path):
        """depth=1 still returns file nodes as direct children of root."""
        root = tmp_path / "skills"
        root.mkdir()
        (root / "README.md").write_text("# readme", encoding="utf-8")

        tree = build_tree(root, root)

        names = [n["name"] for n in tree["children"]]
        assert "README.md" in names

    def test_depth_minus1_recurses_fully(self, tmp_path: Path):
        """depth=-1 returns full recursive tree with children_loaded: True everywhere."""
        root = tmp_path / "skills"
        (root / "nested").mkdir(parents=True)
        (root / "nested" / "SKILL.md").write_text("# skill", encoding="utf-8")

        tree = build_tree(root, root, depth=-1)

        nested_node = next(n for n in tree["children"] if n["name"] == "nested")
        assert nested_node["children_loaded"] is True
        assert any(c["name"] == "SKILL.md" for c in nested_node["children"])

    def test_depth_greater_than_1_behaves_as_shallow(self, tmp_path: Path):
        """Any depth > 0 (not just 1) results in shallow stub behavior."""
        root = tmp_path / "skills"
        nested = root / "nested"
        nested.mkdir(parents=True)
        (nested / "SKILL.md").write_text("# skill", encoding="utf-8")

        tree = build_tree(root, root, depth=2)

        nested_node = next(n for n in tree["children"] if n["name"] == "nested")
        assert nested_node["children"] == []
        assert nested_node["children_loaded"] is False

    def test_depth_minus1_all_folders_have_children_loaded_true(self, tmp_path: Path):
        """Every folder node in a depth=-1 tree has children_loaded: True."""
        root = tmp_path / "skills"
        (root / "a" / "b").mkdir(parents=True)

        tree = build_tree(root, root, depth=-1)

        def check(node):
            if node["type"] == "folder":
                assert node["children_loaded"] is True, f"Missing children_loaded on {node['path']}"
            for child in node.get("children", []):
                check(child)

        check(tree)
