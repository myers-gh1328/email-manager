---
name: agent-contacts
description: Use when searching, creating, or updating reusable contacts through the local MCP workflow tools.
---

# Agent Contacts

## When To Use

Use this skill for contact lookup, contact cleanup, and contact record creation or updates through approved app workflows.

## MCP tools

- `get_agent_capabilities`
- `search_contacts`
- `create_contact`
- `update_contact`

## Procedure

1. Call `get_agent_capabilities` first.
2. Use MCP tools only.
3. Do not read or edit runtime database files.
4. For risky actions, call `prepare_*`, show the approval packet to the user, and only call `commit_*` with the exact confirmation text returned by the app after the user provides it.
5. Search existing contacts before creating a new contact to avoid duplicates.
6. Confirm `editRecords` is enabled before calling `create_contact` or `update_contact`.
7. Preserve do-not-email status unless the user explicitly asks to change it.
8. Summarize object ids, warnings, skipped recipients, and next actions.

## Output

Report created or updated contact ids, duplicate candidates, do-not-email state, warnings, and any suggested follow-up searches or updates.
