---
name: send-safety-review
description: Review a branch for send-once, test-mode, SMTP, scheduler, and communication-history risks.
agent: agent
tools: ["codebase", "terminal"]
---

Review the current branch for email send-safety.

Use:

- `docs/ARCHITECTURE.md`
- `.agents/skills/scuba-send-safety/SKILL.md`
- `.codex/agents/send-safety-review.agent.md`

Check:

1. Successful campaign deliveries cannot resend.
2. Test mode cannot send real email and remains auditable.
3. Scheduled-send blockers are visible.
4. Direct and campaign sends record communication history.
5. Secrets stay server-side and out of logs.
6. Focused tests cover changed behavior.

Return findings first, ordered by severity, with file references.
