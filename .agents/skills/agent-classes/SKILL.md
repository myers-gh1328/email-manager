---
name: agent-classes
description: Use when managing class sessions, rosters, enrollments, or student checklist state through local MCP tools.
---

# Agent Classes

## When To Use

Use this skill for class session lookup, class session edits, roster enrollment, and checklist completion workflows.

## MCP tools

- `get_agent_capabilities`
- `list_class_sessions`
- `get_class_session`
- `create_class_session`
- `update_class_session`
- `enroll_contact`
- `set_enrollment_checklist_completion`

## Procedure

1. Call `get_agent_capabilities` first.
2. Use MCP tools only.
3. Do not read or edit runtime database files.
4. For risky actions, call `prepare_*`, show the approval packet to the user, and only call `commit_*` with the exact confirmation text returned by the app after the user provides it.
5. Use `list_class_sessions` and `get_class_session` before changing a class session or roster.
6. Confirm `editRecords` is enabled before calling create, update, enroll, or checklist tools.
7. Use stable ids from MCP responses for class sessions, contacts, and checklist items.
8. Summarize object ids, warnings, skipped recipients, and next actions.

## Output

Report class session ids, enrolled contact ids, checklist item ids, warnings, and any next actions such as previewing communications or reviewing the roster.
