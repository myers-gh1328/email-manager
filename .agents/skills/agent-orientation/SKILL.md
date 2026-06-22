---
name: agent-orientation
description: Use when an agent needs to understand Training Communications Studio state, navigation, scheduler readiness, or available MCP permissions.
---

# Agent Orientation

## When To Use

Use this skill at the start of MCP-assisted app work and whenever you need current app readiness, workflow availability, vocabulary labels, or agent permissions.

## MCP tools

- `get_agent_capabilities`
- `get_app_overview`
- `get_scheduler_readiness`

## Procedure

1. Call `get_agent_capabilities` first.
2. Use MCP tools only.
3. Do not read or edit runtime database files.
4. For risky actions, call `prepare_*`, show the approval packet to the user, and only call `commit_*` with the exact confirmation text returned by the app after the user provides it.
5. Use `get_app_overview` for dashboard-style state and configured vocabulary labels.
6. Use `get_scheduler_readiness` for scheduled sending readiness, blockers, due approved count, and next approved send.
7. Summarize object ids, warnings, skipped recipients, and next actions.

## Output

Report the current workflow state, disabled permissions, warnings, scheduler blockers, and recommended next MCP tools without exposing database paths or decrypted secrets.
