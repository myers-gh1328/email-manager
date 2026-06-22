---
name: agent-smoke-test
description: Verify that a fresh agent can find the repo purpose, boundaries, skills, validation, and send-safety invariant.
agent: agent
tools: ["codebase", "terminal"]
---

Run a cold-start smoke test for Training Communications Studio.

Check:

1. Can you identify the app purpose from `AGENTS.md` and `README.md`?
2. Can you find the architecture and send-once invariant?
3. Can you choose the right skill for a UI workflow change?
4. Can you choose the right skill for a scheduled-email or SMTP change?
5. Can you name the exact full validation command?
6. Can you find the browser-inspection dev environment?
7. Can you explain where agent governance and review policy lives?

Return:

- Pass/fail for each check.
- Confusing or stale instructions.
- Specific files that need updates.
