"""
MCP server for the skills usage monitor.

Exposes 4 tools that call the skills_vis REST API over loopback:
  - start_recording_session
  - record_skill_usage
  - stop_recording_session
  - get_session_history

Run as: python3 -m skills_vis.mcp_server
The REST API port is read from SKILLS_VIS_PORT env var (default: 8001).
"""
import json
import os
import httpx
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp import types

_DEFAULT_PORT = int(os.environ.get("SKILLS_VIS_PORT", "8001"))


# ---------------------------------------------------------------------------
# Pure implementation functions (testable without MCP machinery)
# ---------------------------------------------------------------------------

def _base_url(port: int) -> str:
    return f"http://localhost:{port}/api"


def start_recording_session_impl(
    agent: str | None, graph_root: str | None, port: int = _DEFAULT_PORT
) -> dict:
    resp = httpx.post(
        f"{_base_url(port)}/usage/sessions",
        json={"agent": agent, "graph_root": graph_root},
        timeout=5,
    )
    resp.raise_for_status()
    return resp.json()


def record_skill_usage_impl(
    session_id: str | None,
    skill_path: str,
    skill_name: str,
    metadata: dict | None,
    port: int = _DEFAULT_PORT,
) -> dict:
    resp = httpx.post(
        f"{_base_url(port)}/usage/record",
        json={
            "session_id": session_id,
            "skill_path": skill_path,
            "skill_name": skill_name,
            "metadata": metadata,
        },
        timeout=5,
    )
    resp.raise_for_status()
    return {"ok": True}


def stop_recording_session_impl(session_id: str, port: int = _DEFAULT_PORT) -> dict:
    resp = httpx.put(
        f"{_base_url(port)}/usage/sessions/{session_id}/stop",
        timeout=5,
    )
    resp.raise_for_status()
    return resp.json()


def get_session_history_impl(port: int = _DEFAULT_PORT) -> list:
    resp = httpx.get(f"{_base_url(port)}/usage/sessions", timeout=5)
    resp.raise_for_status()
    return resp.json()


# ---------------------------------------------------------------------------
# MCP server wiring
# ---------------------------------------------------------------------------

server = Server("skills-vis-monitor")


@server.list_tools()
async def list_tools() -> list[types.Tool]:
    return [
        types.Tool(
            name="start_recording_session",
            description="Start a new skill usage recording session.",
            inputSchema={
                "type": "object",
                "properties": {
                    "agent": {"type": "string", "description": "Agent identifier, e.g. 'custom'"},
                    "graph_root": {"type": "string", "description": "Absolute path of the skill tree root"},
                },
            },
        ),
        types.Tool(
            name="record_skill_usage",
            description="Record that a skill was invoked.",
            inputSchema={
                "type": "object",
                "required": ["skill_path", "skill_name"],
                "properties": {
                    "session_id": {"type": "string"},
                    "skill_path": {"type": "string", "description": "Filesystem path or short skill ID"},
                    "skill_name": {"type": "string", "description": "Human-readable skill name"},
                    "metadata": {"type": "object"},
                },
            },
        ),
        types.Tool(
            name="stop_recording_session",
            description="End an active recording session.",
            inputSchema={
                "type": "object",
                "required": ["session_id"],
                "properties": {
                    "session_id": {"type": "string"},
                },
            },
        ),
        types.Tool(
            name="get_session_history",
            description="List all past recording sessions.",
            inputSchema={"type": "object", "properties": {}},
        ),
    ]


@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[types.TextContent]:
    port = _DEFAULT_PORT
    if name == "start_recording_session":
        result = start_recording_session_impl(
            agent=arguments.get("agent"),
            graph_root=arguments.get("graph_root"),
            port=port,
        )
    elif name == "record_skill_usage":
        result = record_skill_usage_impl(
            session_id=arguments.get("session_id"),
            skill_path=arguments["skill_path"],
            skill_name=arguments["skill_name"],
            metadata=arguments.get("metadata"),
            port=port,
        )
    elif name == "stop_recording_session":
        result = stop_recording_session_impl(
            session_id=arguments["session_id"], port=port
        )
    elif name == "get_session_history":
        result = get_session_history_impl(port=port)
    else:
        raise ValueError(f"Unknown tool: {name}")

    return [types.TextContent(type="text", text=json.dumps(result))]


if __name__ == "__main__":
    import asyncio

    async def main():
        async with stdio_server() as (read_stream, write_stream):
            await server.run(read_stream, write_stream, server.create_initialization_options())

    asyncio.run(main())
