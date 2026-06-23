# Architecture

This document is for future maintainers and coding agents. After reading it, you should be able to safely change the app without breaking the send-once guarantee, leaking secrets, or mixing server-only code into browser routes.

## Product Shape

Training Communications Studio is a single-user, local-first SvelteKit app. It is not a hosted service. Each instructor or training provider runs their own installation with their own local SQLite database, SMTP account, admin password, and optional AI endpoint.

The core workflow is:

1. Create reusable contacts.
2. Create reusable course types.
3. Create dated class sessions.
4. Enroll contacts into class sessions.
5. Create templates with variables.
6. Preview a campaign for every recipient.
7. Approve and schedule the campaign.
8. Send each recipient exactly once after the scheduled time.

## Runtime Architecture

The app is a SvelteKit Node application.

- Browser pages render forms and lists for each workflow.
- Server actions validate form data and call server modules.
- The repository module owns all SQLite reads and writes.
- The background scheduler wakes up every minute inside the Node process.
- SMTP delivery happens only from server-side code.
- Optional IMAP reply sync runs from server-side code and only imports replies
  to outbound messages already recorded by the app.
- Optional AI drafting calls an OpenAI-compatible endpoint from server-side code.
- Optional external event ingestion may import contacts, classes, and class
  enrollments from a user-configured source.
- Optional local MCP agent access exposes workflow-shaped tools for AI assistants. MCP must stay local-only, settings-governed, approval-gated for schedule/send actions, and must not expose SQL, database file paths, generic filesystem access, or decrypted secrets.
- Optional Electron desktop packaging wraps the existing SvelteKit Node server. The desktop shell starts the local server on `127.0.0.1`, opens an app window, and stores packaged-app runtime data under the user's OS app-data directory unless environment variables override it.

Keep server-only modules under the server library area. Browser components should receive data from page loads and submit forms to server actions.

The useful boundary test is: if behavior needs secrets, persistence, SMTP, AI, sessions, or background execution, it belongs in a server module or page server action. If behavior is deterministic formatting or rendering that can safely run in the browser, it can live in shared code.

## Route Model

Routes are split by user workflow:

- Dashboard: operational overview and manual "send due now".
- Contacts: reusable student records.
- Classes: course types, sessions, and enrollments.
- Templates: template creation and AI drafting.
- Campaigns: preview and scheduling.
- Communications: direct email composer and contact-centered outbound history.
- Settings: searchable collapsible SMTP, reply sync, AI, scheduler, remote access, agent access, vocabulary, and password controls.
- Setup and login: first-run password setup and authentication.

Avoid rebuilding this as one large page. The route split keeps each workflow small enough to reason about and test.

Page-specific form actions should stay in the owning page server file. Shared behavior should move to server modules only when another route needs it, when it needs direct tests, or when it owns a cross-cutting concern such as SMTP, settings, authentication, repository access, or AI.

Settings are searchable, collapsible, and grouped by operational concern. Saving one settings group should not rewrite unrelated settings groups. Secret inputs follow the same rule across settings: a blank secret field keeps the existing encrypted value.

## Operator Visibility Contracts

The app must answer the instructor's operational questions directly in the UI. Do not rely on hidden database state, dropdown-only information, or per-contact drilldowns for core send safety.

Required visibility:

- Dashboard must show whether automatic scheduled sending is ready, blocked, or paused, including scheduler enabled state, SMTP completeness, email test mode, due approved campaign count, and the next approved send.
- Course type email defaults define automatic schedules. Saving course defaults must create, update, or remove unsent default campaign records across existing classes of that course type, while preserving already-sent campaign history.
- Class detail must show both course-type email defaults and concrete scheduled campaign records for that class. The instructor must be able to see what will send, when it will send, approval state, source, template, and recipient/delivery counts.
- Class detail must show per-student checklist state using global checklist items plus course-type checklist items.
- Campaign detail must distinguish class time from send time and show recipient delivery status.
- Communications must provide a complete outbound email history across direct and campaign sends, not only contact-specific history.
- Communications must show imported replies as acknowledgements under the
  outbound email they replied to. It must not act like a general inbox reader.
- Test audit navigation is visible only while email test mode is enabled. Direct URL access may show historical redirected test emails, but the page must clearly state when test mode is off.
- Settings must use searchable collapsible sections and grouped forms. Changing one settings group must not resave unrelated groups.
- AI model selection should prefer model discovery from the configured OpenAI-compatible `/models` endpoint, with manual entry only as a fallback for servers that cannot list models.

When adding UI for sending, scheduling, settings, or AI, add or update tests for these visibility rules where practical. If the rule is implemented through Svelte markup, prefer extracting a small pure helper when that makes the contract cheap to test.

## Data Model

SQLite is the source of truth.

Main tables:

- Contacts store reusable student details and do-not-email state.
- Course types store reusable class categories.
- Class sessions store dated course instances.
- Enrollments connect contacts to class sessions.
- Templates store subject and body text.
- Campaigns store one scheduled send for one class/template pair.
- Campaign deliveries store recipient-level send status.
- Communications store one outbound email history row per recipient for direct and campaign sends.
- Communication replies store IMAP messages that match an outbound
  communication `Message-ID`. They are shown as acknowledgements, not as a
  full mailbox archive.
- Checklist items store global and course-type class preparation requirements.
- Enrollment checklist completions store per-student checklist state for a class.
- Settings store app configuration and encrypted secrets.

The repository creates tables on startup if they do not exist. Schema changes should be made deliberately and covered by repository tests.

Repository responsibilities are split by role:

- The schema module creates tables and performs additive migrations.
- Repository domain modules hold SQL for contacts/classes, templates, campaigns, communications, course defaults, and settings.
- Row mappers translate SQLite rows into app objects.
- The repository index exposes the public repository surface used by routes and server helpers.

Do not put SQL in route actions or browser components. Add public repository methods for new persistence operations so tests can exercise them without SvelteKit request plumbing.

## Send-Once Invariant

The most important behavioral invariant is:

Successful campaign deliveries must not be sent again.

The app enforces this in two ways:

- Campaign deliveries are unique by campaign and recipient.
- Delivery planning excludes recipients who already have a successful delivery for the campaign.

When changing scheduling or delivery code, preserve this rule. Broad send-due
actions must not retry failed deliveries. Failed deliveries may be retried only
through a future scoped retry action that excludes successful deliveries and
records clear operator intent.

The proposed design for bounded automatic retries is documented in
`docs/CAMPAIGN-RETRY-PLAN.md`. Implementing that plan requires an explicit
architecture update because it changes the current manual-only retry contract.

## Template Rendering

Templates use double-brace variables such as `{{firstName}}` and `{{courseName}}`.

Rendering is intentionally simple:

- Variables are plain names.
- Missing values render as empty strings.
- Preview reports missing variables before sending.
- Conditional template logic is not supported yet.

Keep rendering deterministic. Do not add AI behavior or network calls to template rendering.

## Background Scheduler

The scheduler starts with the SvelteKit server unless disabled by environment variable. It checks for due campaigns once per minute.

A campaign is eligible only when:

- Scheduled sending is enabled.
- The campaign is approved.
- The scheduled time is now or in the past.
- The recipient does not have a successful delivery record for that campaign.
- The recipient does not have a failed delivery record from an earlier
  attempt.

If the app process is not running, scheduled emails cannot send. This is expected for a local app.

## SMTP Delivery

SMTP settings are configured by the user. The app sends individual messages, one recipient at a time.

All outbound email attempts should be recorded as communications tied to the recipient contact. Store the rendered subject and body snapshot so the contact history shows what the student actually received or what failed to send.

Accepted outbound messages should include an app-generated `Message-ID` in the
SMTP payload and the communication row. Reply sync depends on that ID rather
than provider-specific SMTP response IDs.

Do not expose SMTP secrets to the browser. Do not log decrypted SMTP passwords. If adding diagnostics, report configuration status without printing secrets.

Email test mode reroutes outbound messages to the configured safe recipient and records audit data. Automatic scheduled sends are paused while test mode is enabled. Preserve both behaviors when changing mail delivery.

## Reply Sync

Reply sync is optional and IMAP-only. It connects to the configured inbox,
opens `INBOX` read-only, fetches recent messages, and imports only messages
whose `In-Reply-To` or `References` headers match a non-empty outbound
communication `Message-ID` stored by this app.

Reply sync must not mark messages read, move messages, delete messages, tag
messages, or import unrelated inbox mail. Background polling is enabled by
default once IMAP settings are complete, but the user can turn polling off and
run a manual sync from Settings.

Do not log specific reply sync details. Avoid sender addresses, subjects,
message bodies, mailbox names, UIDs, Message-IDs, usernames, hosts, or
credential details in logs. User-visible errors should stay generic and point
the user back to IMAP settings.

## AI Drafting

AI assistance is optional and must remain optional.

The app expects an OpenAI-compatible chat completions endpoint. AI can draft template text, but it must not approve campaigns, schedule campaigns, or send email.

Do not make the app depend on a remote AI service for core workflows.

AI response parsing should fail closed with a user-visible error rather than silently inventing contacts, templates, or send instructions. Do not log API keys or decrypted settings while debugging AI calls.

## Local MCP Agent Access

Agent access is optional and local-only. It is an app workflow interface for trusted local assistants, not a security boundary around the filesystem. App permissions can deny MCP tools, but they do not protect against runtime database or file access already granted to a coding agent by the operating environment.

The MCP surface currently includes orientation, scheduler readiness, navigation, agent capabilities, contacts, classes, templates, direct email prepare/commit, and send-due campaign prepare/commit tools. Campaign approval and campaign schedule tools are intentionally deferred.

Schedule and send actions must return an approval packet from `prepare_*` and require exact confirmation text in the matching `commit_*` tool. Commit tools must revalidate state and call existing server helpers rather than duplicate send loops.

MCP responses must not expose raw SQL, SQLite database paths, decrypted SMTP or AI secrets, admin password hashes, session tokens, or generic filesystem access. Add repository methods and workflow helpers when an MCP tool needs data.

## External Event Ingestion

External event ingestion is optional and provider-neutral. The app may support
user-configured transports, but the domain model is the event contract in
`docs/EXTERNAL-EVENTS.md`, not any specific message bus or deployment.
The local transport adapter is NATS and is enabled only through environment
configuration.

The first supported event types are `contact.upsert`, `class.upsert`, and
`class_user.upsert`. They are inbound data-entry suggestions only. They must not
send email, approve campaigns, schedule campaigns without instructor review, or
change SMTP, Microsoft OAuth, AI, admin, or security settings.

Implement ingestion behind a server-side adapter boundary. Route and repository
code should depend on generic event types and validation results, not on a
provider-specific client. Invalid events should fail closed into diagnostics or
reviewable errors instead of being partially applied.
Normal repository duplicate detection still applies to imported contacts and
classes so manual entry and imports share the same identity rules.

## Authentication And Secrets

The app is single-user per installation. The admin password is required before using the app.

Optional external sign-on is single-user sign-on only. It links one Google or
Microsoft Entra ID identity to the installation and then creates the same local
session used by password login. It does not add users, roles, teams, invites,
account management, or hosted authentication. Provider credentials are
installation-owned settings. Sign-on must not store provider access tokens or
refresh tokens.

Secrets are encrypted before storage using the app secret. The app secret must be changed before remote exposure.

Sensitive values include:

- Admin password.
- SMTP password.
- AI API key.
- Session tokens.
- Student contact data.

Never log decrypted secrets. Never commit the data directory.

Runtime environment names such as `SCUBA_EMAIL_DB`, `SCUBA_EMAIL_APP_SECRET`, and the default `scuba-email.sqlite` filename remain compatibility names. Do not rename them opportunistically while changing product-facing copy.

## Remote Access

Remote access is provider-neutral. The app does not call Cloudflare, Tailscale, or reverse-proxy APIs.

The app provides settings that make remote access understandable:

- Public base URL.
- Remote-ready mode.
- Trusted proxy mode.
- Secure-cookie environment setting.

Only enable trusted proxy headers when the proxy or tunnel is the only public path to the app.

## Desktop Packaging

Desktop packaging is additive. It must not replace the server deployment path used by `npm run build`, `node build`, or `npm run deploy:local`.

The Electron main process lives under `electron/`. It launches the SvelteKit adapter-node output from `build/index.js` using the Electron runtime as Node, waits for the local HTTP server, and loads that local URL into a desktop window.

Desktop builds use:

```bash
npm run desktop:build
npm run desktop:dist
npm run desktop:dist:win
npm run desktop:dist:mac
npm run desktop:dist:linux
npm run desktop:dist:all
```

Packaged desktop defaults:

- Windows installer: NSIS `.exe`.
- macOS installer: `.dmg`.
- Linux installers: `.AppImage` and `.deb`.
- Runtime data directory: the app's OS-specific user-data directory, with `SCUBA_EMAIL_DATA_DIR` and `SCUBA_EMAIL_DB` still taking precedence.

Scheduled sending works while the desktop app is running. If a future change adds tray or background-service behavior, it must preserve send-once delivery, test-mode blocking, and explicit approval requirements.

## Testing Strategy

The test suite should protect core behavior, not incidental markup.

Current important coverage:

- Template rendering and missing-variable detection.
- Delivery planning and send-once behavior.
- SQLite repository behavior for contacts, class history, campaigns, and deliveries.
- Direct email preview-token enforcement and communication recording.
- SMTP test mode, signatures, and provider message handling.
- AI response parsing and disabled-endpoint behavior.
- Auth routing for setup, login, and authenticated pages.

Add tests when changing:

- Template variable behavior.
- Campaign eligibility.
- Delivery retry behavior.
- SQLite schema or repository methods.
- Secret handling.
- Auth/session behavior.
- SMTP test mode or direct email send behavior.
- AI parsing, optional endpoint behavior, or image roster extraction.

Before claiming work is complete, run:

```bash
npm test
npm run check
npm run mcp:build
npm run mcp:smoke
npm run build
```

## Extension Guide

Use these defaults when adding features:

- CSV import should create reusable contacts and avoid duplicate emails when possible.
- Attachments should be added at the template or campaign layer, not inside template rendering.
- Multi-user support requires a real users table, ownership checks, and audit decisions. Do not bolt roles onto the current single-user auth casually.
- Provider-specific remote access setup belongs in docs unless the app truly needs provider API integration.
- More template features should keep preview and missing-variable validation understandable for instructors.

## Common Failure Modes

- Sending the same successful campaign delivery twice.
- Exposing decrypted secrets through load data sent to the browser.
- Making scheduled sending depend on the browser being open.
- Adding a route action that bypasses preview or approval for scheduled campaigns.
- Letting AI-generated text send without user review.
- Committing local SQLite data.

When in doubt, protect student data and require explicit instructor approval before sending email.
