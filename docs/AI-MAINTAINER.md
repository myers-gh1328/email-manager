# AI Maintainer Guide

This guide is for AI coding agents and future maintainers landing cold in Training Communications Studio. After reading it, you should be able to make a scoped code or documentation change, choose the right module boundary, validate it, and avoid the app's high-risk failure modes.

## Operating Model

Training Communications Studio is a local-first, single-user SvelteKit app. It stores contact, class, template, campaign, communication, session, and settings data in local SQLite. It sends mail through the instructor's or training provider's SMTP account and can optionally call an OpenAI-compatible local AI endpoint for drafting and roster extraction.

The app is intentionally not a hosted SaaS product. Do not add remote provider dependencies for core workflows unless the user explicitly asks for a new integration and the design is reviewed.

Runtime compatibility names such as `SCUBA_EMAIL_*`, `SCUBA_*`, `scuba-email.sqlite`, and `scuba_email_*` cookies are intentionally retained until a dedicated compatibility slice changes them.

## First Files To Read

Read these before broad work:

- `AGENTS.md` for mandatory commands, safety rules, and route boundaries.
- `docs/ARCHITECTURE.md` before persistence, scheduler, SMTP, auth, AI, template, or deployment changes.
- `docs/AGENTIC-OPERATING-MODEL.md` before changing agent guidance, scoped rules, skills, prompts, review agents, or validation policy.
- `README.md` when changing user-facing setup, settings, SMTP, remote access, or production run behavior.

For narrow work, read the owning route and the server helper it calls. Avoid scanning the entire app as a substitute for understanding the relevant boundary.

## Repository Map

### Browser And Routes

- `src/routes/+layout.svelte` owns the authenticated shell, navigation, busy overlay trigger, and test-mode banner.
- `src/routes/+layout.server.ts` provides authenticated layout settings.
- `src/routes/+page.*` is the dashboard and manual send-due control.
- `src/routes/contacts/` owns reusable student records, roster import entry points, and contact history display.
- `src/routes/classes/` owns course types, locations, dated sessions, enrollments, default templates, and class email scheduling.
- `src/routes/templates/` owns reusable templates and AI draft review.
- `src/routes/campaigns/` owns campaign preview, approval, scheduling, detail, delivery status, and draft deletion.
- `src/routes/communications/` owns direct email compose, preview, send, and communication history filtering.
- `src/routes/settings/` owns settings forms, Microsoft OAuth start/callback endpoints, SMTP test, and admin password changes.
- `src/routes/test-audit/` shows email test-mode audit records.
- `src/routes/setup/`, `src/routes/login/`, and `src/routes/logout/` own single-user authentication entry points.

Keep route-specific form actions in the owning `+page.server.ts`. Move code into `src/lib/server` only when it is reused, security-sensitive, background-capable, or valuable to test without a SvelteKit request.

### Server Modules

- `src/lib/server/app.ts` creates the singleton repository using the configured SQLite path.
- `src/lib/server/auth.ts` owns admin password hashing, sessions, setup cookies, and route redirects.
- `src/lib/server/background.ts` owns the minute-based scheduled-send loop and due-campaign processing.
- `src/lib/server/scheduler.ts` owns pure delivery-planning helpers.
- `src/lib/server/mailer.ts` owns SMTP delivery, Microsoft OAuth2 SMTP support, test mode rerouting, signatures, and HTML conversion.
- `src/lib/server/settings.ts` owns settings reads and grouped settings persistence.
- `src/lib/server/microsoft-oauth.ts` owns Microsoft authorization URLs, callback token exchange, refresh token storage, and SMTP access tokens.
- `src/lib/server/llm.ts` owns optional AI calls and parsing of model responses.
- `src/lib/server/roster-import.ts` owns CSV/image roster extraction and contact/class import behavior.
- `src/lib/server/direct-email.ts` owns direct email preview tokens and direct-send behavior.
- `src/lib/server/agent/` owns the optional local MCP workflow surface, permission checks, approval packets, and agent audit helpers.
- `src/mcp/` owns the stdio MCP entry point and tool registration.
- `src/lib/server/page-data.ts` composes shared page-load data.
- `src/lib/server/form-utils.ts` owns common form parsing and template variables.
- `src/lib/server/crypto.ts` owns secret encryption/decryption.

### Repository Layer

The repository folder is the only place that should know SQLite details.

- `schema.ts` creates and migrates tables.
- `index.ts` exposes the public `AppRepository` surface used by routes and server helpers.
- `types.ts` defines repository input/history shapes.
- `mappers.ts` converts SQLite rows into app objects.
- `contacts.ts`, `templates.ts`, `campaigns.ts`, `communications.ts`, `course-defaults.ts`, and `settings.ts` hold domain-specific SQL.
- `ids.ts` creates IDs and timestamps.

When adding or changing persistent data, update schema, types, mappers, repository methods, and repository tests together.

### Shared Client-Safe Code

- `src/lib/shared/template.ts` is deterministic template parsing/rendering. Keep it free of server-only imports, persistence, network calls, and AI behavior.
- `src/lib/shared/phone.ts` is client-safe phone formatting.
- `src/lib/SearchSelect.svelte`, `src/lib/EmailBodyEditor.svelte`, and `src/lib/BusyOverlay.svelte` are reusable browser components.

## High-Risk Invariants

### Send Once

Successful campaign deliveries must not resend. Preserve all of these:

- Campaign delivery rows are unique by campaign and recipient.
- Delivery planning excludes recipients with successful delivery status.
- Failed deliveries may retry, but successful deliveries must remain terminal.
- Manual send-due and background send-due paths must use the same delivery logic.

Any change to campaigns, delivery planning, background sending, or repository delivery status needs tests.

### Secrets Stay Server-Side

Never send decrypted SMTP passwords, Microsoft secrets, refresh tokens, AI API keys, admin password hashes, session tokens, or app secrets to browser load data. Never log decrypted secrets.

Use configured/not-configured booleans for UI state. Preserve the "blank secret input means keep the existing secret" pattern.

### Optional AI

The app must work without an AI endpoint. AI may draft text or extract roster rows, but it must not approve campaigns, schedule campaigns, or send email without user review.

AI parsing should tolerate common model response wrappers where practical. If parsing fails, return a useful error without leaking prompts or keys.

### Optional Local MCP

Agent access is optional and local-only. The MCP server exposes workflow tools for orientation, contacts, classes, templates, direct-email prepare/commit, and send-due campaign prepare/commit. Campaign approval and campaign schedule tools are deferred until their review flow is implemented.

Agent permissions are app workflow controls, not a sandbox boundary. They do not protect against filesystem access already granted to a coding agent, so agents must not read or edit runtime database files directly. MCP tools must not expose raw SQL, database paths, or decrypted secrets.

Schedule and send actions require approval packets and exact confirmation text before commit tools run. Direct email and send-due commits must continue to call the existing server helpers so send-once delivery and communication history behavior stay centralized.

### Route Boundaries

Do not collapse the app into a single workflow page. Routes are intentionally split by instructor workflow so form actions, validation, and page data stay small.

Avoid broad "save everything" actions. Settings and similar pages should submit grouped forms to actions that update only that group.

### Operator Visibility

The UI must make send state auditable without requiring database knowledge or guessing:

- Dashboard shows scheduler readiness, blockers, due approved count, and next approved send.
- Course type defaults are bulk operational settings: saving them creates, updates, or removes unsent default campaign schedules across existing classes of that course type, while preserving already-sent history.
- Class detail shows course-type email defaults and actual scheduled sends for that class.
- Communications shows complete outbound email history across direct and campaign sends.
- Test audit appears in navigation only while email test mode is enabled; historical direct URL access must say test mode is off.
- Settings use searchable collapsible sections and grouped saves so users can find agent, SMTP, scheduler, remote access, AI, vocabulary, and password controls without rewriting unrelated settings.
- AI model selection should discover models from the configured `/models` endpoint when available.

When a change affects these rules, update tests or extract pure helpers so the contract is covered outside manual visual inspection.

### Visual Dev Loop

Use `docs/AGENT-DEV-ENV.md` when a change affects layout, navigation, forms, scheduling visibility, or settings. The `dev:agent` scripts provide a seeded test-mode database and suppressed background scheduler so agents can inspect the app in a browser without touching local production data.

## Common Change Recipes

### Add A New Setting

1. Add the setting to the `AppSettings` shape.
2. Read it in `getSettings` with a sensible default.
3. Add it to a grouped update helper, or create a new helper if it belongs to a new settings group.
4. Add the form control to the owning settings panel.
5. Keep the server action page-specific unless another route needs to write the same group.
6. If it is a secret, store only encrypted values and expose only a configured flag.
7. Run the required validation commands.

### Add Persistent Data

1. Add or migrate the table/column in the schema module.
2. Add or update repository types.
3. Add mappers for row shape changes.
4. Add public repository methods in `AppRepository`.
5. Add route/server behavior that uses repository methods rather than SQL directly.
6. Add repository tests for create/read/update/delete or the relevant invariant.
7. Run the required validation commands.

### Add A Route Action

1. Keep the action in the owning page server file.
2. Parse required fields with existing form helpers.
3. Call server helper modules for reused behavior.
4. Return `fail(400, ...)` for user-correctable validation errors.
5. Do not bypass preview tokens for send/schedule flows.
6. Do not import browser-only modules into server files.
7. Add tests if the action changes a core invariant or a reusable server helper.

### Change SMTP Or Sending

1. Read the architecture SMTP and send-once sections.
2. Preserve email test mode behavior: outbound mail routes to the configured safe recipient and automatic scheduled sends pause while test mode is enabled.
3. Preserve communication history recording for direct and campaign sends.
4. Preserve provider-message/error-message capture without logging secrets.
5. Run mailer, direct-email, scheduler, background, and repository campaign tests.

### Change Templates

1. Keep template rendering deterministic and client-safe.
2. Preserve missing-variable reporting before send/schedule.
3. Do not add AI or network calls to template rendering.
4. Update template tests for parsing/rendering behavior.

### Change Deployment

1. Read the local deploy script before running it.
2. The local deploy builds a timestamped release, switches a current link, optionally runs `SCUBA_RESTART_COMMAND`, and health-checks the local port.
3. The deploy script writes release artifacts and may restart a service, so it requires approval in sandboxed agent environments.
4. Do not treat sandbox-blocked network checks as proof the app is down. Use the deploy script result, service logs, and process state appropriately.
5. Do not commit runtime data, local secrets, build output, dependency folders, cache folders, or local service plist files.

### Change Desktop Packaging

1. Keep Electron packaging additive. Do not break `npm run build`, `node build`, or `npm run deploy:local`.
2. The Electron shell starts the existing SvelteKit Node server from `build/index.js`; do not duplicate app workflow logic in Electron.
3. Packaged desktop data defaults to the OS app-data directory, while `SCUBA_EMAIL_DATA_DIR` and `SCUBA_EMAIL_DB` remain valid overrides.
4. Scheduled sends run only while the desktop app process is running unless a dedicated tray/background design is added later.
5. Validate desktop packaging with `npm run desktop:build` when packaging code changes.

## Validation Matrix

Always run before claiming code changes are complete:

```bash
npm test
npm run check
npm run mcp:build
npm run mcp:smoke
npm run build
```

The single local validation command is:

```bash
npm run agent:check
```

Use narrower tests while iterating:

- Template behavior: `npm test -- tests/template.test.ts`
- Phone formatting: `npm test -- tests/phone.test.ts`
- Auth routing: `npm test -- tests/auth-routing.test.ts`
- Mailer behavior: `npm test -- tests/mailer.test.ts`
- Direct email behavior: `npm test -- tests/direct-email.test.ts`
- Scheduler planning: `npm test -- tests/scheduler.test.ts`
- Background campaign communications: `npm test -- tests/background.communications.test.ts`
- Repository contacts/templates/campaigns/communications: run the matching repository test file.
- AI parsing and optional endpoint behavior: `npm test -- tests/llm.test.ts`
- Roster imports: `npm test -- tests/roster-import.test.ts`

For documentation-only changes, run `npm run check` at minimum when practical. If docs describe commands, deployment, or architecture that changed with code, run the full gate.

## Deployment Notes For Agents

The package exposes `npm run deploy:local`. The script:

1. Creates a release under the configured release root.
2. Links the repo's dependencies and runtime data into the release.
3. Builds the SvelteKit app into the release.
4. Moves the current link to the new release.
5. Runs `SCUBA_RESTART_COMMAND` when configured.
6. Checks `SCUBA_HEALTH_URL`, or `http://127.0.0.1:${SCUBA_DEPLOY_PORT:-3010}` by default.

The script is process-manager-neutral. Configure `SCUBA_RESTART_COMMAND` for launchd, Task Scheduler, NSSM, systemd, or another local process manager. In a sandboxed environment, direct network checks may fail unless approved. Do not retry random network commands. If the user asks for deployment, run the deploy script with the required approval and report exactly what it returned.

## Documentation Expectations

Keep documentation concise and operational:

- Put repo-wide agent rules in `AGENTS.md`.
- Put durable architecture and invariants in `docs/ARCHITECTURE.md`.
- Put AI workflow, change recipes, and validation guidance in this guide.
- Put agent operating policy, scorer alignment, and governance in `docs/AGENTIC-OPERATING-MODEL.md`.
- Keep user setup and product behavior in `README.md`.
- Keep public-readiness rules in `docs/OPEN-SOURCE-READINESS.md`.
- Keep branch, version, and release rules in `docs/RELEASES.md`.
- Link new docs from an existing entry point so they are discoverable.

When behavior changes, update docs in the same change if a future agent or user would otherwise make the wrong decision.
