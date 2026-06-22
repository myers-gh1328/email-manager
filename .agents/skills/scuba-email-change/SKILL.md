---
name: scuba-email-change
description: Use when changing Training Communications Studio application behavior, routes, server helpers, settings, persistence, templates, or tests.
paths:
  - "src/**"
  - "tests/**"
  - "docs/**"
---

# Scuba Email Change

## When To Use

Use this skill for normal feature work, bug fixes, refactors, and documentation updates that describe app behavior.

Do not use it as a replacement for the narrower send-safety or UI workflow skills. If a change touches scheduled sending, SMTP, campaign deliveries, communications, or email test mode, use `scuba-send-safety` too. If a change affects route layout, navigation, forms, or visible workflow state, use `scuba-ui-workflow` too.

## Procedure

1. Read `AGENTS.md`.
2. Read `docs/ARCHITECTURE.md` if the change touches persistence, scheduling, auth, SMTP, AI, template rendering, or deployment.
3. Read the owning route and the server helper it calls before editing.
4. Keep route-specific form actions in the owning `+page.server.ts`.
5. Move shared behavior into `src/lib/server` only when it is reused, security-sensitive, background-capable, or worth testing without SvelteKit request plumbing.
6. Add or update focused tests for changed invariants.
7. Update docs in the same change when a future agent would otherwise make a wrong decision.
8. Run `npm run agent:check` before claiming completion.

## Output

Report:

- Files changed.
- Behavior changed.
- Tests or checks run.
- Any residual risk or intentionally deferred follow-up.

## Common Pitfalls

- Do not submit broad forms that resave unrelated settings.
- Do not import server-only modules into browser components.
- Do not put SQLite SQL in routes or Svelte components.
- Do not leak decrypted secrets through load data, logs, or browser state.
- Do not rely on AI for core workflows; the app must work without an AI endpoint.
