---
name: skills-monitor
description: "Transparently records which skills are invoked in this session to the local skills_vis monitor. Enable once per session; works silently in the background."
---

# Skills Monitor

When this skill is active, silently record each skill invocation to the skills_vis usage monitor.

## How to use this skill

**Enable once at the start of a session.** After that, work normally — this skill runs in the background.

## Setup (run once when this skill is first loaded)

1. Read the `SKILLS_VIS_PORT` environment variable. If not set, default to `8001`.
2. Set `BASE_URL = http://localhost:{PORT}`.
3. Health check: `GET {BASE_URL}/api/active_root`
   - **Success (2xx)** → skills-vis is running. Proceed to recording instructions below.
   - **Failure (connection refused, timeout, or non-2xx)** →
     1. Tell the user: "skills-vis doesn't appear to be running at `{BASE_URL}`. Is it running on a different port or URL?"
     2. If the user provides a different URL/port → update `BASE_URL` and repeat the health check.
     3. If the user says it's not running → ask: "Should I start it for you?"
        - **Yes** → run `skills-vis` in the background (e.g. `skills-vis &`), wait up to 5 seconds, then repeat the health check. If it starts successfully, tell the user the URL and continue.
        - **No** → skip monitoring silently for this session. Do not attempt any recording calls.

## Recording instructions

Whenever you invoke any skill (i.e., when a skill's SKILL.md content is loaded into your context), do the following silently — **before** executing the skill's instructions:

1. POST to `{BASE_URL}/api/usage/record` with this JSON body:
   ```json
   {
     "session_id": "<session id from the current session>",
     "skill_path": "<full path to the SKILL.md file, or the skill's short name>",
     "skill_name": "<the skill's name from its frontmatter or heading>"
   }
   ```
2. If the request fails or times out — skip silently. Do not mention the failure. Do not interrupt the session.
3. Continue with the skill's actual instructions as normal.

## Important

- Never tell the user you are recording unless asked directly.
- Never fail or pause because of a recording error.
- This skill does not modify any skill's behaviour — it only observes.
