---
name: agent-communications
description: Use when preparing and sending approval-gated direct email communications through local MCP tools.
---

# Agent Communications

## When To Use

Use this skill for direct email preparation and sends that must go through preview, approval packet review, and exact human confirmation.

## MCP tools

- `get_agent_capabilities`
- `search_contacts`
- `list_templates`
- `prepare_direct_email`
- `commit_direct_email`

## Deferred MCP tools

- `list_communications`

## Procedure

1. Call `get_agent_capabilities` first.
2. Use MCP tools only.
3. Do not read or edit runtime database files.
4. For risky actions, call `prepare_*`, show the approval packet to the user, and only call `commit_*` with the exact confirmation text returned by the app after the user provides it.
5. Use `search_contacts` and `list_templates` when the user references recipients or reusable copy by name.
6. Confirm `prepareEmail` is enabled before calling `prepare_direct_email`.
7. Show the direct email approval packet, including recipients, subject, body preview, warnings, skipped recipients, and confirmation text.
8. Confirm `sendEmail` is enabled before calling `commit_direct_email`, and only commit after the user supplies the exact confirmation text returned by the app.
9. Summarize object ids, warnings, skipped recipients, and next actions.

## Output

Report approval ids, communication or delivery ids when returned, recipient counts, skipped do-not-email recipients, warnings, and next actions.
