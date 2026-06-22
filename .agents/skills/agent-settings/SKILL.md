---
name: agent-settings
description: Use when checking local agent permissions, scheduler readiness, and settings readiness through available MCP tools.
---

# Agent Settings

## When To Use

Use this skill when the user asks what the agent can do, why an MCP workflow is unavailable, whether scheduled sending is ready, or which settings need human attention.

## MCP tools

- `get_agent_capabilities`
- `get_scheduler_readiness`
- `get_app_overview`

## Deferred MCP tools

- `get_settings_readiness`
- grouped non-secret setting update tools
- approval-gated secret or security-sensitive setting tools

## Procedure

1. Call `get_agent_capabilities` first.
2. Use MCP tools only.
3. Do not read or edit runtime database files.
4. For risky actions, call `prepare_*`, show the approval packet to the user, and only call `commit_*` with the exact confirmation text returned by the app after the user provides it.
5. Use `get_scheduler_readiness` to inspect scheduler, SMTP, test mode, and due-send blockers.
6. Use `get_app_overview` for non-secret app state and configured vocabulary labels.
7. Do not request, reveal, or infer decrypted SMTP passwords, AI API keys, admin passwords, app secrets, session tokens, raw SQL, or database paths.
8. Summarize object ids, warnings, skipped recipients, and next actions.

## Output

Report enabled permissions, unavailable operations, scheduler blockers, settings warnings, and the next safest human or MCP action.
