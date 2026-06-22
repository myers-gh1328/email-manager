# Agent Notes

## Project

Training Communications Studio is a local-first SvelteKit app for instructors and training providers. It manages reusable contacts, course types, dated class sessions, personalized email templates, campaign previews, and one-time scheduled SMTP sends.

## Stack

- SvelteKit 2 / Svelte 5 / TypeScript
- Node adapter
- Built-in `node:sqlite` through `DatabaseSync`
- Vitest for unit/integration tests
- Nodemailer for SMTP

## Required Commands

Install dependencies with:

```bash
npm install
```

Run these before claiming changes are complete:

```bash
npm test
npm run check
npm run build
```

The CI-equivalent local gate is:

```bash
npm run agent:check
```

If you change documentation only, still run `npm run check` when practical because SvelteKit type generation can catch stale route/action references in nearby edits. For deploys, use `npm run deploy:local`; it builds a timestamped local release and can run a configured `SCUBA_RESTART_COMMAND`.

Compatibility note: runtime names such as `SCUBA_EMAIL_*`, `SCUBA_*`, `scuba-email.sqlite`, and `scuba_email_*` cookies remain intentionally unchanged during the product-neutral documentation rename.

## Local Data

Runtime data lives under `data/` by default and must not be committed. The SQLite database may contain student contact details, encrypted SMTP secrets, sessions, and app settings.

## Architecture

- `src/lib/server/repository/` owns SQLite schema and persistence. Add schema changes in `schema.ts`, public repository methods in `index.ts`, row mappers in `mappers.ts`, and domain-specific queries in the matching repository module.
- `src/lib/server/background.ts` owns due-campaign sending and background scheduling.
- `src/lib/server/mailer.ts` owns SMTP delivery, email test mode routing, signatures, and provider transport setup.
- `src/lib/server/settings.ts` owns app setting reads and grouped setting update helpers. Keep page-specific actions in the page server file and shared setting persistence here.
- `src/lib/server/page-data.ts` owns shared page-load data composition.
- `src/lib/shared/template.ts` owns template variable parsing/rendering.
- SvelteKit pages are intentionally split by workflow:
  - `/` dashboard
  - `/contacts`
  - `/classes`
  - `/templates`
  - `/campaigns`
  - `/communications`
  - `/test-audit`
  - `/settings`
- Keep server-only code under `src/lib/server`.
- Read `docs/ARCHITECTURE.md` before changing persistence, scheduling, auth, SMTP, AI, or template rendering.
- Read `docs/AI-MAINTAINER.md` before broad refactors, deployment work, or changes that cross more than one route.
- Read `docs/AGENTIC-OPERATING-MODEL.md` before changing agent instructions, skills, scoped rules, prompts, hooks, validation scripts, or repository governance.
- Use the repo-local skills in `.agents/skills/` when they match the work:
  - `agent-orientation` for MCP app overview, scheduler readiness, navigation, and capability discovery.
  - `agent-contacts` for MCP contact search, creation, and updates.
  - `agent-classes` for MCP class sessions, rosters, enrollments, and checklist state.
  - `agent-templates` for MCP reusable email template workflows.
  - `agent-campaigns` for MCP campaign readiness and approval-gated send-due processing.
  - `agent-communications` for MCP direct email preparation and approval-gated sends.
  - `agent-settings` for MCP settings readiness, permissions, and scheduler blockers.
  - `add-external-event-pubsub` for optional user-configured external event or pub/sub ingestion changes.
  - `scuba-email-change`, `scuba-send-safety`, and `scuba-ui-workflow` remain as legacy compatibility names while older agent configurations migrate.
- Reusable prompts live in `.github/prompts/`; specialized review agents live in `.codex/agents/`.

## Route And Action Boundaries

- Keep page-specific form actions in the owning `+page.server.ts`.
- Move behavior into `src/lib/server` only when it is reused across routes, needs tests without a SvelteKit request, or touches secrets/persistence/background work.
- Avoid one action that saves unrelated settings. Settings pages should submit grouped forms to grouped actions.
- Browser components must not import server-only modules or receive decrypted secrets in load data.

## Safety Rules

- Never make successful campaign deliveries resend. Preserve the `campaign_deliveries` uniqueness/idempotency behavior.
- Do not log SMTP passwords, AI API keys, admin passwords, or decrypted secrets.
- Keep AI assistance optional. The app must work without an AI endpoint.
- Remote exposure is deployment documentation/settings, not a Cloudflare API dependency.
- Do not treat sandboxed network failures as production health failures. If a network command is blocked by sandboxing, either run the project deploy script with the required approval or report that local health could not be checked from the sandbox.
- Do not commit runtime data, local secrets, build output, dependency folders, cache folders, or local process-manager files.
- Treat this repo as an open-source candidate. Before adding docs, examples,
  scripts, fixtures, or operational notes, check `docs/OPEN-SOURCE-READINESS.md`
  and avoid private hostnames, local paths, real data, account details, secrets,
  or owner-only infrastructure assumptions.

## Repository Workflow

This repo currently allows focused local commits on `main` unless the user says
to use a branch or PR. Do not assume this rule applies to sibling repos. Related repos may use different commit rules; read each repo's own `AGENTS.md` before editing or committing there.
## Ownership And Review

- Agent-facing assets are operational configuration. Changes to `AGENTS.md`, `.agents/`, `.cursor/`, `.codex/`, `.github/prompts/`, `docs/AGENTIC-OPERATING-MODEL.md`, and `scripts/agent/` must be reviewed with the same care as code.
- If a change affects scheduled sending, delivery history, secrets, authentication, or remote exposure, use a focused reviewer or subagent before committing.
- Re-score the repo against the repo-scorer rubric, if available, after major workflow, validation, or agent-asset changes.
