# Changelog

All notable changes to this project will be documented in this file.

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
