---
name: agent-templates
description: Use when listing, creating, or updating reusable email templates through local MCP tools.
---

# Agent Templates

## When To Use

Use this skill for reusable email template discovery, drafting, and edits through app-owned MCP workflows.

## MCP tools

- `get_agent_capabilities`
- `list_templates`
- `create_template`
- `update_template`

## Procedure

1. Call `get_agent_capabilities` first.
2. Use MCP tools only.
3. Do not read or edit runtime database files.
4. For risky actions, call `prepare_*`, show the approval packet to the user, and only call `commit_*` with the exact confirmation text returned by the app after the user provides it.
5. List existing templates before creating a new template to avoid duplicate reusable content.
6. Confirm `editRecords` is enabled before calling `create_template` or `update_template`.
7. Keep template variables explicit and do not assume rendered recipient data unless a preview tool returns it.
8. Summarize object ids, warnings, skipped recipients, and next actions.

## Output

Report template ids, changed subjects or names, known variable concerns, warnings, and next actions such as preparing a direct email preview.
