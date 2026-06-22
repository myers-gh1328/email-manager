# Agent MCP Interface Design

## Goal

Add an optional MCP interface so users can operate the app through AI agents such as Claude Code while preserving the existing web UI, local-first data ownership, send-once guarantees, secret handling, and explicit human approval for risky actions.

The design also generalizes app-facing language away from scuba-specific branding. The proposed product name is Training Communications Studio. Scuba-specific wording should be removed from user-facing and agent-facing documentation except where it is clearly historical or used as an example.

## Product Direction

The app remains a local-first, single-user web app with SQLite as the source of truth. MCP is an additional local interface for users who prefer AI-assisted operation. It is not a public HTTP API, SaaS integration point, or replacement for the UI.

Agent access is opt-in. Setup and settings should explain it in plain language:

> Let AI assistants like Claude Code use this app directly through approved local tools. Agents can help manage contacts, classes, templates, campaigns, and communications. Risky actions like sending email still require your explicit approval.

The setup choice should be:

- Enable AI agent access.
- Skip for now.

MCP-specific wording belongs in advanced details and maintainer documentation, not in the main setup copy.

## Architecture

Add an MCP server surface beside the existing SvelteKit UI. Both the UI and MCP tools should call shared server-side workflow helpers where behavior overlaps. The repository remains the only SQLite boundary, and existing route actions stay page-owned unless logic is worth sharing.

Proposed structure:

- `src/lib/server/agent/` owns MCP-facing workflow services, response envelopes, approval packets, permission checks, and audit helpers.
- `src/lib/server/repository/` gains only persistence needed for agent approvals, audit events, permissions, and vocabulary settings.
- Existing server modules remain authoritative for dangerous work:
  - campaign, scheduler, and background modules preserve send-once delivery planning.
  - mailer and direct-email modules own SMTP, email test mode, and communications recording.
  - settings owns grouped settings persistence and secret handling.
  - template rendering remains deterministic and client-safe.

The MCP server should be optional and local-only. It may run as an optional app mode or local companion process, but it must use the same validated server helpers as the UI. No conventional public HTTP API is introduced by this feature.

## MCP Tool Model

Tools mirror app workflows rather than database tables. Skills can orchestrate workflows, but the app server enforces validation, permissions, approvals, and send safety.

### Orientation

- `get_app_overview`: dashboard-style operational state and configured vocabulary labels.
- `get_scheduler_readiness`: scheduled sending state, SMTP readiness, test mode, due approved count, and next approved send.
- `get_agent_capabilities`: enabled permissions and unavailable operations.
- `get_navigation_state`: available workflows, including whether test audit is visible.

### Contacts

- `search_contacts`
- `get_contact`
- `create_contact`
- `update_contact`
- `import_roster_preview`
- `commit_roster_import`

### Classes

- `list_course_types`
- `create_course_type`
- `update_course_type`
- `list_class_sessions`
- `get_class_session`
- `create_class_session`
- `update_class_session`
- `enroll_contact`
- `unenroll_contact`
- `update_student_checklist`

### Templates

- `list_templates`
- `get_template`
- `create_template`
- `update_template`
- `render_template_preview`
- `draft_template_with_ai`

AI drafting stays optional and review-only. The app must work without an AI endpoint.

### Campaigns

- `list_campaigns`
- `get_campaign`
- `create_campaign_draft`
- `render_campaign_preview`
- `prepare_campaign_approval`
- `commit_campaign_approval`
- `prepare_campaign_schedule`
- `commit_campaign_schedule`
- `prepare_send_due_campaigns`
- `commit_send_due_campaigns`

### Communications

- `list_communications`
- `prepare_direct_email`
- `commit_direct_email`

### Settings

- `get_settings_readiness`
- grouped non-secret setting update tools where permissions allow them.
- approval-gated secret or security-sensitive flows only when explicitly designed.

Tools must never return decrypted secrets, admin password material, app secrets, session tokens, or raw database paths.

### Test Audit

- `list_test_audit_messages`
- `get_test_audit_message`

## Response Contract

All tools should use a consistent response envelope:

- `ok`: boolean.
- `data`: operation-specific result when successful.
- `error`: stable machine-readable error object when unsuccessful.
- `warnings`: user-visible warnings that do not block the operation.
- `nextActions`: short suggested next tool calls or human review steps.
- `labels`: configured vocabulary labels relevant to the response.

List tools must paginate with opaque cursors and a documented maximum limit, even though the app is local-first.

Errors should include:

- `code`: stable machine-readable code.
- `message`: human-readable text.
- `details`: structured context with no secrets.

Important error codes include `agent_permission_denied`, `approval_required`, `approval_expired`, `approval_changed`, `validation_failed`, `not_found`, `conflict`, `smtp_not_ready`, `test_mode_blocks_automatic_send`, and `send_once_protected`.

## Approval Model

Risky actions use a two-step server-managed flow:

1. `prepare_*` validates the operation and creates an approval packet.
2. `commit_*` performs the operation only if the approval is still valid, the user-provided confirmation matches exactly, and commit-time revalidation passes.

Approval packets include:

- `approvalId`
- `risk`
- `summary`
- `confirmationText`
- `expiresAt`
- `review`
- `warnings`

Risk tiers:

- `read`: no approval.
- `draft_or_edit`: no approval unless bulk or destructive.
- `imports_data`: approval for commit after preview.
- `changes_operational_settings`: approval if it affects scheduler, test mode, remote readiness, or agent access.
- `schedules_email`: approval required.
- `sends_email`: approval required.
- `changes_secrets_or_auth`: approval required and heavily restricted.

Agents must show approval summaries to the user and must not invent confirmation text. Commit tools require the exact `confirmationText` returned by the app.

Commit-time revalidation must recheck recipients, rendered content, approval state, scheduler/test-mode state, do-not-email status, permissions, and send-once constraints. If material state changed, the commit fails with `approval_changed` and the agent must prepare a fresh approval.

## Approval And Audit Persistence

Use SQLite-backed approval and audit persistence. Stateless signed tokens are not sufficient because users need local auditability, revocation, expiration, and visibility into pending approvals.

Add `agent_approvals`:

- `id`
- `tool_name`
- `risk`
- `summary`
- `operation_json`
- `review_json`
- `confirmation_text`
- `status`: `pending`, `committed`, `expired`, `rejected`, or `failed`
- `created_at`
- `expires_at`
- `committed_at`
- `result_json`

Add `agent_audit_events`:

- `id`
- `tool_name`
- `risk`
- `action`: `prepare`, `commit`, `reject`, `expire`, `read`, `mutate`, or `permission_denied`
- `summary`
- `entity_type`
- `entity_id`
- `status`
- `created_at`

Email sends continue to use existing campaign delivery and communication records as the source of truth. Agent audit records are an operator trail, not a replacement for send history.

## Agent Permissions

Users can enable or disable specific categories of agent actions. Approval is still required for risky actions even when the permission is enabled.

Permission groups:

- View data: contacts, classes, templates, campaigns, communications, settings readiness.
- Edit records: create/update contacts, classes, enrollments, templates, and checklist state.
- Import data: roster import previews and commits.
- Prepare email actions: campaign and direct-email previews and approval packets.
- Schedule email: approval-gated campaign scheduling.
- Send email: approval-gated direct sends and send-due campaigns.
- Update settings: grouped non-secret operational setting updates.
- Manage agent access: revoke/regenerate token, view audit, and change agent permissions.

Default profile:

- View data enabled.
- Draft/edit, import, prepare email, schedule, send, and settings updates disabled until the user explicitly enables them.

Disabled permissions make related tools unavailable or return `agent_permission_denied`. Permission-denied attempts should be audited.

Settings copy should use plain language such as:

- Let agents view my app data.
- Let agents draft and edit records.
- Let agents prepare emails for my approval.
- Let agents schedule approved emails.
- Let agents send approved emails.
- Let agents update selected settings.

## Database Isolation

The app can prevent database access through MCP, but it cannot absolutely prevent a local coding agent from reading or modifying the SQLite file if the user grants filesystem access to the data directory.

Best-effort mitigations:

- MCP exposes workflow tools only; no SQL, database paths, repository internals, generic query tools, or decrypted secrets.
- Agent skills require MCP-only operation and prohibit direct runtime data edits.
- Runtime data should be outside source-controlled paths where practical, or docs should recommend moving it outside the repo for agent-heavy use.
- Setup/settings should warn if the configured data directory is inside the repository workspace.
- Documentation should say: do not give AI assistants access to the app's private data folder unless you intend them to read that data.
- MCP audit logs show legitimate agent actions; direct database edits will not appear there.
- Optional advanced docs can recommend a separate OS user or restricted filesystem permissions for stronger isolation.

The product must not claim MCP permissions protect against a fully privileged local agent running as the same OS user.

## Vocabulary Customization

Users can customize visible labels without changing internal domain names, database tables, MCP tool names, or schemas.

Stable internal concepts:

- contact
- student or participant
- course type
- class session
- enrollment
- template
- campaign
- communication

Settings should store a vocabulary map with defaults. Example configurable labels:

- Course type -> Program, Certification, Workshop type.
- Class session -> Cohort, Event, Workshop.
- Student -> Participant, Client, Member.
- Instructor -> Coach, Organizer, Trainer.

UI headings, form labels, empty states, and summaries use configured labels. MCP responses include relevant labels so agents can speak in the user's vocabulary while still calling stable tools. Skills must use configured labels in user-facing summaries and stable tool names in tool calls.

## Settings UX

Settings should remain one page with searchable, collapsible sections rather than many tabs. Each section owns its own scoped form/action so saving one group does not rewrite unrelated settings.

Recommended sections:

- Email Sending: SMTP, sender identity, test send, and email test mode.
- Automation: scheduler readiness, scheduled sending toggle, optional AI endpoint/model.
- Agent Access: enable/disable local agent access, connection status, and revoke/regenerate token.
- Agent Permissions: workflow and risk toggles.
- Agent Approvals: pending approvals and recent approval outcomes.
- Security: admin password and app secret readiness.
- Remote Access: public base URL, remote-ready mode, trusted proxy, and secure cookies.

Search filters sections and matching fields by label/help text. Examples:

- `agent` shows access, permissions, and approvals.
- `smtp` shows email sending.
- `password` shows security.
- `schedule` shows automation and agent permissions.

## Skills Model

Create repo-local skills for agent workflows using generic names rather than scuba-branded names:

- `agent-orientation`
- `agent-contacts`
- `agent-classes`
- `agent-templates`
- `agent-campaigns`
- `agent-communications`
- `agent-settings`

Skill rules:

- Skills call MCP tools, not SQLite, route actions, or private server modules.
- Skills must never read or edit runtime database files.
- Skills show approval packet summaries before commit tools.
- Skills never invent confirmation text.
- Skills prefer preview/prepare over commit when uncertain.
- Skills summarize post-action receipts with object ids, recipient counts, skipped recipients, warnings, and next actions.
- Skills treat the web UI as an alternate human surface, not a backend dependency.

## Rename And Documentation Scope

The MCP design includes a product-neutral naming pass:

- Replace legacy product branding with Training Communications Studio in app-facing and agent-facing documentation.
- Remove `scuba` from agent skill names, prompts, and instructions.
- Keep scuba-specific wording only as historical context, migration notes, or examples.
- Keep route and domain language generic: contacts, course types, class sessions, templates, campaigns, communications, settings.
- Update maintainer docs and agent operating docs to describe the optional MCP server purpose, owner, local-only scope, permissions, and approval requirements.

The implementation should preserve open-source readiness by avoiding private hostnames, local paths, real data, account details, secrets, or owner-only infrastructure assumptions.

## Safety Exclusions

Initial MCP tools must not support:

- Raw SQL or generic database queries.
- Reading or writing runtime database files.
- Reading decrypted SMTP passwords, AI API keys, Microsoft OAuth secrets, app secrets, admin password hashes, or session tokens.
- Changing the admin password.
- Changing the app secret.
- Bypassing setup/login.
- Bypassing campaign preview, direct-email preview, or approval packets.
- Hard-deleting broad data sets.
- Sending successful campaign deliveries again.

Deletion through MCP should be avoided in the first implementation. Prefer archive/disable-style operations only where the app already supports them.

## Testing

Add focused tests for:

- MCP response envelopes and stable error codes.
- Agent permission checks for allowed and denied tool groups.
- Approval prepare/commit lifecycle, expiration, rejection, and commit-time changed-state failures.
- Send-once preservation through MCP-triggered campaign send paths.
- Direct email approval requirements and communication history recording.
- Secret redaction in all MCP settings/readiness responses.
- Vocabulary defaults, overrides, and MCP label metadata.
- Settings search and collapsible-section contract where practical.
- Agent audit records for prepare, commit, mutate, read, and permission-denied attempts.

Before claiming implementation complete, run `npm run agent:check`.

## Implementation Slices

The full design should be implemented incrementally:

1. Rename and docs foundation for Training Communications Studio.
2. Agent access settings, permission storage, and local-only lifecycle.
3. MCP response envelope, errors, and read-only orientation tools.
4. Contacts/classes/templates workflow tools.
5. Vocabulary customization across UI and MCP responses.
6. Approval/audit persistence and prepare/commit framework.
7. Campaign and communication prepare/commit tools with send-safety tests.
8. Searchable collapsible settings page with agent sections.
9. Repo-local agent skills built on the MCP tools.

Each slice should be independently testable and preserve existing UI behavior.

## Out Of Scope

- Public REST, GraphQL, or hosted SaaS APIs.
- Multi-user roles or organization support.
- Agent access over the public internet.
- Fully preventing a local agent with filesystem access from reading local data.
- AI autonomous approval, scheduling, or sending without explicit user confirmation.
- Renaming internal database concepts or MCP tool names based on user vocabulary.
