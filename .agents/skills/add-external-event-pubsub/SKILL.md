---
name: add-external-event-pubsub
description: Use when adding or changing optional external event ingestion, pub/sub subscribers, NATS adapters, event schemas, or user-configured import flows for contacts, classes, or class enrollments in Training Communications Studio.
---

# Add External Event Pub/Sub

Use this skill when a user asks an agent to add pub/sub or external-event intake to Training Communications Studio.

## Required Reading

1. `AGENTS.md`
2. `docs/ARCHITECTURE.md`
3. `docs/EXTERNAL-EVENTS.md`
4. `docs/OPEN-SOURCE-READINESS.md`

## Boundaries

- Keep this repo public-ready. Do not add private hostnames, LAN IPs, real NATS subjects, usernames, credentials, local machine names, or owner-only deployment notes.
- Treat pub/sub as optional, user-configured input. The app must work without a broker.
- Keep provider credentials in runtime configuration or secret storage, never in git.
- Do not connect this app to unrelated private applications by name in public docs or examples.
- External events are data-entry suggestions. They must not send email, approve campaigns, schedule campaigns without instructor review, or change SMTP, Microsoft OAuth, AI, admin, or security settings.

## Implementation Workflow

1. Preserve the provider-neutral event contract in `docs/EXTERNAL-EVENTS.md`.
2. Add provider-specific code behind a server-side adapter boundary.
3. Keep route and repository code dependent on normalized event types, validation results, and import outcomes, not raw transport clients.
4. Support the initial event types first: `contact.upsert`, `class.upsert`, and `class_user.upsert`.
5. Make ingestion idempotent by using source plus external IDs and normal duplicate detection.
6. Record invalid or unsupported events for diagnostics instead of partially applying them.
7. Add user-facing configuration through settings only when the user can supply provider, URL, subjects, and consumer identity without editing source.
8. Use fake `example.*` values in docs, tests, and fixtures.

## Validation

- Add or update tests for validation, idempotency, unsupported event types, and failed imports.
- Run `npm run agent:check` before completion when code changes.
- For docs-only changes, verify referenced files and commands exist.

## Output

Report the event types touched, configuration surface changed, validation run, and any deferred transport/provider work.
