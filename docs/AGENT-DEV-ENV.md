# Agent Dev Environment

This project includes an isolated browser-inspection environment for coding agents. It uses its own SQLite database under `.agent-dev/`, seeds realistic training workflow data, turns on the app's email test mode, and suppresses the background scheduler while the dev server is running.

## Start

```bash
npm run dev:agent:seed
npm run dev:agent
```

Open `http://127.0.0.1:5174` and log in with:

```text
agent-dev-login
```

The seeded data includes:

- Contacts with sendable and do-not-email examples.
- Course types with and without automatic course emails.
- A future class with automatic course emails and concrete scheduled emails.
- Templates using common class/contact variables.
- A sample communication history row marked as test mode.
- A test audit row.
- Email test mode enabled and scheduler disabled.

## Browser Inspection Flow

When changing UI or route behavior, run the agent dev server and inspect the app with a browser automation tool before claiming the work is ready. Useful checkpoints:

- `/` shows scheduler state, blockers, due count, next scheduled send, and the test-mode banner.
- `/classes` supports mobile navigation and does not push all edit forms into a right column.
- A class detail page shows both automatic course emails and concrete scheduled emails.
- `/templates` keeps template tags contextual instead of dumping all tags at the top.
- `/communications` shows History with global outbound email records, including test-mode sends.
- `/test-audit` is available from navigation while test mode is enabled.
- `/settings` saves grouped settings independently.

For `agent-browser`, a typical loop is:

```bash
agent-browser open http://127.0.0.1:5174/login
agent-browser snapshot -i
agent-browser fill <login-input-ref> agent-dev-login
agent-browser click <submit-button-ref>
agent-browser screenshot
```

Use screenshots or snapshots as evidence when investigating layout, mobile behavior, form placement, or navigation collapse.

## Safety

The agent dev database is intentionally ignored by git. Do not copy real user data into `.agent-dev/`.

The seeded environment relies on the product's own test functionality:

- Email test mode is on.
- The test audit page has data to inspect.
- Scheduler controls are visible but disabled.
- The Node background scheduler is suppressed for the `dev:agent` lifecycle.

That combination allows schedule visibility checks without live background delivery.
