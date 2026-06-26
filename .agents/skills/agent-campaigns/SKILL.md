---
name: agent-campaigns
description: Use when reviewing scheduled-email readiness or running approval-gated send-due scheduled-email processing through local MCP tools.
---

# Agent Scheduled Emails

## When To Use

Use this skill for scheduled-email readiness checks and approval-gated processing of due ready scheduled emails. Scheduled-email draft and schedule MCP tools are deferred; use the web UI or wait for those MCP tools for those workflows.

## MCP tools

- `get_agent_capabilities`
- `get_scheduler_readiness`
- `prepare_send_due_campaigns`
- `commit_send_due_campaigns`

## Deferred MCP tools

- `list_campaigns`
- `get_campaign`
- `create_campaign_draft`
- `render_campaign_preview`
- `prepare_campaign_approval`
- `commit_campaign_approval`
- `prepare_campaign_schedule`
- `commit_campaign_schedule`

## Procedure

1. Call `get_agent_capabilities` first.
2. Use MCP tools only.
3. Do not read or edit runtime database files.
4. For risky actions, call `prepare_*`, show the approval packet to the user, and only call `commit_*` with the exact confirmation text returned by the app after the user provides it.
5. Use `get_scheduler_readiness` before preparing scheduled email sends.
6. Use `prepare_send_due_campaigns` to create the approval packet for due ready scheduled emails.
7. Show the approval packet, including due counts, warnings, skipped recipients, and the returned confirmation text, before any commit.
8. Call `commit_send_due_campaigns` only after the user provides the exact confirmation text returned by the app.
9. Summarize object ids, warnings, skipped recipients, and next actions.

## Output

Report approval ids, campaign ids when returned, delivery counts, skipped recipients, send-once warnings, scheduler blockers, and next actions.
