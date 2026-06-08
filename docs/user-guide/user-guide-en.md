# Skills Vis — User Guide

Skills Vis is an interactive browser for your AI agent skill libraries. It lets you visualize your skills as a graph, edit them directly in the browser, monitor which skills your agent uses in real time, and import skills from remote repositories.

This guide walks you through everything you need to get started and make full use of every feature.

---

## Requirements

- Python 3.10 or higher
- A modern web browser (Chrome, Firefox, Safari, Edge)

---

## Installation

Install Skills Vis from PyPI:

```bash
pip install skills-vis
```

---

## Launch the App

Start the server from your terminal:

```bash
skills-vis
```

You can also launch it as a Python module:

```bash
python -m skills_vis
```

Then open your browser and go to:

```
http://127.0.0.1:8001
```

---

## Load Your Skills Folder

When the app opens, you will see a path input at the top of the page.

1. Paste the path to your skills folder (e.g. `~/.claude/plugins/my-skills`).
2. Click **Load**.

The graph will appear, showing your skills folder as a tree of nodes.

> **Tip:** The directory where you launched `skills-vis` is always available in the Skills drawer as a quick-load entry — no need to retype it.

---

## Browse Your Skills

![Graph view](../../static/screenshots/01_graph.png)

The graph displays your skills folder as a left-to-right tree:

- **Expand / collapse folders** — click the arrow on any folder node, or click the folder name.
- **Select a skill** — click any file node to open it in the viewer panel on the right.
- **Search** — press `⌘K` (Mac) or `Ctrl+K` (Windows/Linux) to open the search bar. Type to filter nodes by name. Matching nodes are highlighted; non-matching nodes are dimmed. You can still collapse a highlighted folder manually.

---

## Open and Edit a Skill

![File viewer](../../static/screenshots/03_editor.png)

Click any file node in the graph to open it in the file viewer:

- **Rendered preview** — the skill's Markdown content is rendered with syntax highlighting and a live table of contents on the right.
- **Edit mode** — click the **Edit** button (pencil icon) to switch to the code editor. Make your changes and click **Save** to write them to disk.

---

## Manage Your Workspaces

![Skills drawer](../../static/screenshots/02_drawer.png)

Click the drawer icon (top-left) to open the **Skills drawer**. Here you can:

- **Switch workspaces** — click any saved workspace entry to load that folder into the graph instantly. The drawer stays open so you can keep switching.
- **Save the current folder** — use the **Save current root** quick action to bookmark the folder you currently have loaded.
- **Add a new folder** — use **New skill folder** to type in a new path and save it.
- **Edit or remove** saved entries using the icons next to each entry.
- **Starter library** — browse a curated set of starter skills and add them directly to your workspace.

---

## Monitor Your Agent in Real Time

![Recording sessions](../../static/screenshots/04_monitor.png)

Skills Vis can highlight skill invocations on the graph as your AI agent works.

### Start a recording session

1. Click **⏺ Record** in the toolbar to start a new session.
2. Load the `skills-monitor/SKILL.md` skill into your agent session (add it to the skills folder your agent reads from).
3. Work normally in your agent. Every skill it invokes will glow **green** on the graph for a few seconds.
4. Click **Recording…** in the toolbar to stop the session.

### Replay a past session

Past sessions are saved automatically. Open the **Skills drawer** and find the session under the **Recordings** section. Click it to replay the sequence of skill invocations on the graph.

---

## Import Skills from GitHub / GitLab

![Import skills](../../static/screenshots/05_import.png)

You can pull skills from any GitHub or GitLab repository, or from a local path.

1. Click the **Browse…** button, or the import icon in the toolbar.
2. Paste a URL or path — for example:
   - `https://github.com/mattpocock/skills`
   - `https://gitlab.com/example/skills-repo`
   - `/Users/you/projects/shared-skills`
3. Skills Vis scans the repository for `SKILL.md` files and lists them.
4. Click any skill to **preview** its content.
5. Check the skills you want, then click **Copy selected** to import them into your active workspace folder.

> **Conflict detection:** If a skill with the same name already exists in your workspace, Skills Vis will warn you before overwriting.

---

## Tips and Keyboard Shortcuts

| Shortcut              | Action                             |
| --------------------- | ---------------------------------- |
| `⌘K` / `Ctrl+K`       | Open search                        |
| Click folder arrow    | Expand / collapse folder           |
| Click file node       | Open skill in viewer               |
| Click workspace entry | Load workspace (drawer stays open) |

- **Launch directory:** The folder where you ran `skills-vis` always appears at the top of the Skills drawer, even if you haven't saved it.
- **Python module launch:** `python -m skills_vis` works identically to `skills-vis` — useful if the CLI entry point is not on your PATH.
