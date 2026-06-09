---
name: skills-monitor
description: "Records skill invocations to the skills_vis monitor. Owns the full session lifecycle — starts at setup, stops at session end or on user request."
---

# Skills Monitor

When this skill is active, silently record each skill invocation to the skills_vis usage monitor.

## How to use this skill

**Enable once at the start of a session.** After that, work normally — this skill runs in the background.

## Setup (run once when this skill is first loaded)

1. Read the `SKILLS_VIS_PORT` environment variable. If not set, default to `8001`.
2. Set `BASE_URL = http://localhost:{PORT}`.
3. Health check: `GET {BASE_URL}/api/active_root`
   - **Success (2xx)** → skills-vis is running. Proceed to step 4.
   - **Any failure (connection refused, timeout, or non-2xx)** →
     1. Tell the user: "skills-vis doesn't appear to be running at `{BASE_URL}`. Is it running on a different port or URL?"
     2. If the user provides a different URL/port → update `BASE_URL` and repeat step 3.
     3. If the user says it's not running → ask: "Should I start it for you?"
        - **Yes** → run `skills-vis &` in the background, wait up to 5 seconds, repeat step 3. Tell the user the URL if it starts.
        - **No** → tell the user monitoring will be skipped for this session. **Stop here — do not proceed to step 4 or attempt any recording calls.**

4. Create a session: `POST {BASE_URL}/api/usage/sessions` with body:
   ```json
   { "agent": "claude-code", "graph_root": "<current working directory>" }
   ```
   - **Success** → store the `session_id` string returned in the response body. Use this exact value for all record calls this session.
   - **Failure** → store `SESSION_ID = null`. Recording will still work (server auto-assigns to the open session).

## Recording instructions

Whenever you invoke any skill (i.e., when a skill's SKILL.md content is loaded into your context), do the following silently — **before** executing the skill's instructions:

1. POST to `{BASE_URL}/api/usage/record` with this JSON body:
   ```json
   {
     "session_id": "<SESSION_ID stored in setup step 4>",
     "skill_path": "<full path to the SKILL.md file, or the skill's short name>",
     "skill_name": "<the skill's name from its frontmatter or heading>"
   }
   ```
2. If the request fails or times out — skip silently. Do not mention the failure. Do not interrupt the session.
3. Continue with the skill's actual instructions as normal.

## Important

- `SESSION_ID` **must** be the value returned by `POST /api/usage/sessions` in step 4. Never invent a session id, never use a date string, and never use a Claude conversation identifier — these are not valid and will cause a 404 error.
- Never tell the user you are recording unless asked directly.
- Never fail or pause because of a recording error.
- This skill does not modify any skill's behaviour — it only observes.

## Stopping the session

Stop the active recording session in either of these situations:

1. **On demand** — the user explicitly asks to stop monitoring (e.g., "stop recording", "end session", "stop monitoring").
2. **At conversation close** — the conversation is naturally ending: user says goodbye, "thanks, that's all", "we're done", signs off, or there is no more work to do.

### Stop procedure

If `SESSION_ID` is null (session creation failed during setup), skip the stop call entirely.

- If the `stop_recording_session` MCP tool is available in your tool list → call it with `session_id: <SESSION_ID>`
- Otherwise → make this HTTP call:
  ```
  PUT {BASE_URL}/api/usage/sessions/{SESSION_ID}/stop
  ```

After stopping:
- Clear `SESSION_ID` — set it to null.
- Do not attempt further record calls for this session.
- If the stop call fails or times out — skip silently. Never interrupt the user over a recording error.
