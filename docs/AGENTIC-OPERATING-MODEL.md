# Agentic Operating Model

This document defines how AI agents should work in Training Communications Studio and how the repository stays aligned with the repo-scorer rubric.

## Canonical Entry Points

- `AGENTS.md` is the root instruction file for all agents.
- `docs/ARCHITECTURE.md` is the product and system boundary reference.
- `docs/AI-MAINTAINER.md` is the cold-start maintainer guide.
- `docs/AGENT-DEV-ENV.md` is the browser-inspection workflow for UI changes.
- `.agents/skills/` contains reusable project workflows.
- `.cursor/rules/` contains path-scoped implementation rules.
- `.codex/agents/` contains focused review agents.
- `.github/prompts/` contains repeatable human-invoked prompts.

Avoid duplicating the same rule in many places. Put the durable rule in the canonical file and link to it from tool-specific assets.

## Rubric Alignment

The repo-scorer rubric values a layered operating model:

1. Persistent guidance: `AGENTS.md`, this document, and the maintainer/architecture docs.
2. Scoped rules: `.cursor/rules/*.mdc` for Svelte route work, server boundaries, and tests.
3. Skills: `.agents/skills/*/SKILL.md` for repeated repo-specific workflows.
4. Specialized agents: `.codex/agents/*.agent.md` for send-safety, UI workflow, and docs-score review.
5. Reusable prompts: `.github/prompts/*.prompt.md` for smoke tests and safety reviews.
6. Validation: `npm run agent:check` and `tests/agent-assets.test.ts`.
7. Governance: ownership, review cadence, and change controls in this file.

## Optional Local MCP Agent Access

Training Communications Studio exposes an optional local MCP server for AI assistants. The MCP surface is workflow-shaped, local-only, and governed by app settings, agent permissions, approval packets, and audit records. It must not expose raw SQL, database file paths, decrypted secrets, or generic filesystem access.

Agent permissions are workflow controls, not a filesystem sandbox. They do not protect against runtime database or file access already granted to a coding agent by the operating environment. Agents should use MCP workflow tools and must not read or edit runtime database files directly.

Runtime compatibility names such as `SCUBA_EMAIL_*`, `SCUBA_*`, `scuba-email.sqlite`, and `scuba_email_*` cookies are intentionally retained until a dedicated compatibility slice changes them.

## Tool And MCP Policy

Agents may use:

- Local shell commands inside the repository.
- `npm run dev:agent` and `agent-browser` for UI inspection.
- GitHub tools when working on issues or PRs.
- The local MCP tools for orientation, scheduler readiness, navigation, capabilities, contacts, classes, templates, direct email prepare/commit, and send-due campaign prepare/commit.

Campaign approval and campaign schedule MCP tools are deferred. Schedule and send actions require a `prepare_*` approval packet and the exact confirmation text in the matching `commit_*` tool. Do not add external MCP configuration unless a repeated workflow needs an external system. Any app-owned MCP surface must document the server purpose, owner, required environment variables, package version pinning, read/write scope, and approval requirements in this file.

## Hooks And Deterministic Controls

The repository-level deterministic gate is `npm run agent:check`. It runs:

1. `git diff --check`
2. `npm test`
3. `npm run check`
4. `npm run mcp:build`
5. `npm run mcp:smoke`
6. `npm run build`

Agent environments may also run global stop hooks or secret checks. Do not depend on personal hooks as the only enforcement path; any required project gate belongs in `scripts/agent/` and should be referenced from `package.json`.

Keep repository automation out of scope unless the repository owner explicitly asks for it.

## Review Controls

Agent-facing assets are operational configuration. Review changes to these paths like code:

- `AGENTS.md`
- `.agents/**`
- `.cursor/**`
- `.codex/**`
- `.github/prompts/**`
- `docs/AGENTIC-OPERATING-MODEL.md`
- `scripts/agent/**`
- `tests/agent-assets.test.ts`

Before merging changes to scheduler, campaigns, mailer, communications, test mode, secrets, auth, or remote exposure, invoke the relevant focused review agent or perform the same checklist manually.

## Observability And Audit Signals

Track recurring failure categories in issue or PR notes when they happen:

- Send-once or scheduling regressions.
- UI workflow confusion, especially mobile layout, navigation collapse, or hidden send state.
- Secret exposure or logging risk.
- Test gaps where an expected behavior was not protected.
- Agent instruction conflicts or stale docs.

Campaign and direct-email history belongs in the product database. MCP approval and audit records belong in the product database. Other agent execution history belongs in PRs, commits, issue comments, and local tool logs.

## Periodic Review

After major app workflow changes, and at least quarterly for active development:

1. Run `npm run agent:check`.
2. Review `AGENTS.md`, `.agents/skills/`, `.cursor/rules/`, `.codex/agents/`, and `.github/prompts/` for stale commands or conflicts.
3. Re-run the repo-scorer rubric, if available.
4. Update this document with any accepted exceptions, new tool policies, or new recurring workflows.

## Agent Smoke Test

Use `.github/prompts/agent-smoke-test.prompt.md` after substantial agent-instruction or workflow changes. The smoke test should prove a fresh agent can:

- Find the app purpose and architecture boundaries.
- Identify the correct skill for a UI or send-safety change.
- Name the exact validation command.
- Explain where browser inspection guidance lives.
- Explain why successful campaign deliveries must not resend.
