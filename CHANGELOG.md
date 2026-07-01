# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [0.2.1] - 2026-07-01

### Added

- **i18n**: full English and Traditional Chinese (zh-TW) support across all UI components, with a Toolbar toggle button; language preference is persisted in localStorage
- **i18n**: initial locale is automatically detected from the browser's language setting, falling back to English when no preference is saved
- **Server**: `--no-browser` flag suppresses the automatic browser launch on startup

## [0.1.5] - 2026-06-16

### Added

- **Skills drawer**: Cursor (`~/.cursor/skills`) and Agent (`~/.agent/skills`) starter skill paths now appear as one-click starter options
- **Skills monitor skill**: the agent can now stop its own recording session (on user request or at the end of a conversation) via the `stop_recording_session` MCP tool or a direct HTTP fallback

### Fixed

- **Graph sorting**: "Recently modified" (renamed from "Recently used") now sorts and labels items by `mtime` only, instead of falling back to `atime`
- **Context menu & canvas dark mode**: context menu and buttons now use theme CSS variables, and canvas colors were adjusted for better dark mode rendering
- **Skills monitor skill**: clarified that the session's agent identifier should reflect the actual tool in use rather than a literal `claude-code` placeholder, and the stop call is now skipped when `SESSION_ID` is null

### Docs

- Added bilingual (English / Traditional Chinese) user guides under `docs/user-guide/` and linked them from the README

## [0.1.4] - 2026-06-06

### Fixed

- **Search results**: search now matches only the node name, not the full path — previously, searching for a folder name would show every descendant as a match
- **Collapse during search**: folders highlighted by search can now be collapsed by the user; the search auto-expand no longer overrides an explicit collapse
- **Save current root**: the "Save current root" quick action now pre-fills the path input with the currently loaded root, making it distinct from "New skill folder"
- **File viewer path**: the path shown in the file viewer header now uses `~` instead of the full home directory

### Added

- `python -m skills_vis` can now be used to launch the server (in addition to the `skills-vis` CLI entry point)

### Docs

- Added screenshots to README covering graph view, file viewer, skills drawer, recording sessions, and importing skills from GitHub

## [0.1.2] - 2026-06-03

### Fixed

- **Skills drawer UX**: clicking a saved workspace entry no longer creates a duplicate unsaved row; the saved row is highlighted directly
- **Edit form**: saving an edited workspace entry now closes the form immediately (optimistic close)
- **Graph search expand**: folders that have never been opened can now be expanded while a search is active
- **Skills monitor skill**: the agent now creates a session via `POST /api/usage/sessions` and uses the server-returned ID instead of inventing one; port/connection errors are reported to the user rather than silently skipped

### Added

- **Server launch directory**: the directory where `skills-vis` was started always appears in the skills drawer as a non-dismissible entry, even if it is not in the saved list
- Clicking a workspace entry in the drawer loads the graph without closing the drawer

## [0.1.1] - 2026-06-02

### Changed

- Build system now derives the package version from git tags via `hatch-vcs`
- CI workflow builds the wheel directly from source so that gitignored static files are included in the package

### Fixed

- Publish job no longer runs a redundant checkout step

### Docs

- README badges now use absolute logo URL and include PyPI version and license badges
- Minimum Python version corrected to 3.10

## [0.1.0] - 2026-06-02

### Added

- Initial release
