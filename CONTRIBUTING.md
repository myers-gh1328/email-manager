# Contributing

Training Communications Studio is a local-first SvelteKit app for instructors
and training providers. The project is pre-1.0, so contributions should stay
small, well-tested, and aligned with the existing local-first workflow.

## Before Opening A Change

- Read `AGENTS.md` and `docs/ARCHITECTURE.md`.
- Do not add real student data, databases, logs, screenshots, credentials,
  private hostnames, account details, or local machine paths.
- Keep server-only behavior under `src/lib/server`.
- Preserve the send-once invariant for successful campaign deliveries.
- Keep AI, NATS, SMTP, Microsoft OAuth, and remote access optional.

## Validation

Run the project gate before submitting:

```bash
npm run agent:check
```

That command runs:

- `git diff --check`
- `npm test`
- `npm run check`
- `npm run mcp:build`
- `npm run mcp:smoke`
- `npm run build`

## Pull Request Expectations

- Explain the user-facing behavior changed.
- Include focused tests for repository, scheduler, mailer, auth, settings, or
  template changes.
- Update docs when a future maintainer would otherwise make a wrong assumption.
- Do not include generated build output, runtime data, dependency folders,
  release artifacts, or local cache directories.

## Support Boundary

The app is offered as local-first software without operational guarantees.
Operators are responsible for SMTP accounts, backups, tunnels or proxies, NATS
servers, and keeping their local secrets private.
