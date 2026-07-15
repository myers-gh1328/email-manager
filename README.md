# Training Communications Studio

Training Communications Studio is a local-first app for instructors and training providers who need to send class emails without turning class communication into a marketing platform.

Use it to keep reusable student contacts, organize students by class date, write personalized templates, preview each student's message, and schedule approved one-time sends through your own email account.

## Install The Desktop App

Download the app from the [latest release](https://github.com/myers-gh1328/email-manager/releases/latest).

On that page, look for **Assets**. That is the list of download files. Choose
the file for your computer:

### Windows

1. Download the file ending in `.exe`.
2. Double-click the installer.
3. Follow the installer prompts.
4. Open **Training Communications Studio** from the Start menu.
5. Create your admin password when the app opens.

If Windows warns that the app is from an unknown publisher, choose **More info**
and then **Run anyway** only if you downloaded it from the official release
page linked above.

### macOS

1. Download the file ending in `.dmg`.
2. Open the downloaded `.dmg`.
3. Drag **Training Communications Studio** into **Applications**.
4. Open it from Applications.
5. Create your admin password when the app opens.

If macOS warns that the app cannot be opened because the developer is
unidentified, open **System Settings**, go to **Privacy & Security**, and allow
the app only if you downloaded it from the official release page linked above.

### Linux

Use the package that matches your system:

- Most Linux desktops: download the file ending in `.AppImage`, mark it
  executable, and open it.
- Debian or Ubuntu: download the file ending in `.deb` and install it with your
  system package installer.

Create your admin password when the app opens.

Scheduled emails send while the desktop app is running. If you quit the app, scheduled sending stops until you open it again.

If there are no release downloads yet, the desktop app has not been packaged for
public download.

## What It Does

- Stores student contacts for reuse across future classes.
- Tracks reusable course types and dated class sessions.
- Enrolls students into class sessions.
- Imports class rosters from CSV, including a downloadable roster template.
- Optionally imports class rosters from photos or screenshots when AI is connected and the chosen model supports vision.
- Creates email templates with personalization fields.
- Previews the exact subject and body each student will receive.
- Schedules approved class emails, including welcome, reminder, logistics, and thank-you messages.
- Sends through SMTP as individual emails, not one visible group email.
- Optionally checks an IMAP inbox for replies to emails this app sent, so replies can show as acknowledgements in the app.
- Prevents successful scheduled emails from being sent twice to the same student.
- Optionally connects to an OpenAI-compatible local AI endpoint for template drafting.
- Optionally imports contacts, classes, and class enrollments from a
  user-configured external event source.
- Can stay private on one computer or sit behind a secure tunnel such as Cloudflare Tunnel or Tailscale.

## What It Does Not Do Yet

- No attachments in email templates.
- No newsletter or marketing-list management.
- No multi-user roles. Each installation is a single-instructor app.
- No general inbox reader. Reply sync only imports messages that reply to emails sent by this app.
- No built-in Cloudflare account integration. Remote access is handled by your tunnel or reverse proxy.

## Requirements

For the desktop installer, you only need an SMTP-capable email account.

For developer setup or server deployment:

- Node.js 24 or newer.
- npm.
- An SMTP-capable email account.
- For scheduled sending, a computer or server that stays on while emails should send.

The app uses Node's built-in SQLite support. Runtime data is stored locally in a SQLite database.

## Quick Start

Install dependencies and start the development server:

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. On first run, the app asks you to create an admin password.

After signing in:

1. Open Settings.
2. Set your instructor name.
3. Configure SMTP.
4. Optionally configure Reply Sync if you want replies to show in the app.
5. Add contacts.
6. Add a course type and class session.
7. Enroll contacts in the class session.
8. Create a template.
9. Preview a campaign.
10. Schedule and approve the send.

## Optional Google Or Microsoft Sign-On

Password login is always available. After setup, you can also connect one
Google or Microsoft Entra ID account from **Settings > Security**.

You provide your own Google or Microsoft app registration. The app shows the
redirect address to copy and asks for the IDs and secret from that provider. See
[External Sign-On](docs/EXTERNAL-SIGN-ON.md) for step-by-step setup help.

## App Pages

- Dashboard: scheduler status, setup status, counts, and recent campaign schedules.
- Contacts: reusable student profiles and do-not-email flags.
- Classes: course types, dated class sessions, roster detail, enrollment, and unenrollment.
- Templates: reusable personalized email templates and optional AI drafting.
- Campaigns: per-student preview, one-time campaign scheduling, campaign detail, lifecycle updates, and recipient delivery status.
- Settings: searchable collapsible SMTP, reply sync, AI, scheduler, remote access, agent access, vocabulary, and admin password settings.

## Template Variables

Templates use double-brace fields. The app replaces each field for every student before previewing or sending.

Common variables:

```text
{{firstName}}
{{fullName}}
{{courseName}}
{{classDate}}
{{classLocation}}
{{classNotes}}
{{instructorName}}
```

Example subject:

```text
Welcome to {{courseName}}, {{firstName}}
```

Example body:

```text
Hi {{firstName}},

I am looking forward to seeing you for {{courseName}} on {{classDate}} at {{classLocation}}.

{{classNotes}}

Thanks,
{{instructorName}}
```

Always use campaign preview before approving a scheduled send. Preview shows the final per-student message and reports missing template fields.

## Reply Sync

Reply Sync is optional. Configure it in **Settings > Reply Sync** with the IMAP
server for the same mailbox you send from.

When enabled, the app checks recent inbox messages while the server is running
and imports only replies whose email headers point back to messages the app
sent. It does not import unrelated inbox mail, mark messages read, move
messages, or delete messages. You can turn automatic checking off and use
**Sync replies now** manually.

## SMTP Setup

SMTP is the outgoing mail service from your email provider. The app uses it to send individual emails from your account.

Typical settings:

- Host: the provider's outgoing mail server, such as `smtp.gmail.com`.
- Port: usually `587`; use `465` only if your provider says to use SSL SMTP.
- Username: often your full email address.
- Password: usually an app password, not your normal login password.
- From address: the email address students see as the sender.

If your provider supports app passwords, use one. Do not use your main account password unless your provider specifically requires it.

Settings includes presets for Gmail, Fastmail, Proton Mail, and Outlook. Gmail and Fastmail use SMTP with an app password. Proton Mail uses SMTP submission and should use **No reply sync** because this app does not connect to Proton through IMAP. Outlook and Microsoft 365 use Microsoft OAuth2, not an app password.

For Proton Mail:

1. In Settings, choose **Proton SMTP preset**.
2. Use host `smtp.protonmail.ch` and port `587`.
3. Use the Proton SMTP username and SMTP token for your account.
4. Leave Reply Sync set to **No reply sync**.

For Outlook or Microsoft 365:

1. Create a Microsoft Entra app registration.
2. Add the redirect URI shown in Settings, ending in `/settings/microsoft/callback`.
3. Add delegated permission for `https://outlook.office.com/SMTP.Send`.
4. Save the tenant ID, client ID, and client secret in Settings.
5. Save settings, then use Connect Outlook.

The app requests `offline_access` so it can refresh SMTP access tokens without asking you to sign in before every send. Microsoft tokens and client secrets are encrypted in the local SQLite database.

## Scheduled Sending

Scheduled sending has two controls:

- The campaign must be approved.
- Scheduled sending must be enabled in Settings.

The background scheduler runs inside the Node server every minute. If the app server is not running, it cannot send emails.

Successful deliveries are recorded and are not sent again. Failed deliveries can be retried later without resending successful ones.

## Optional AI Drafting

AI assistance is optional. The app works without it.

To enable AI drafting, configure an OpenAI-compatible local endpoint:

- Base URL: usually something like `http://localhost:1234/v1`.
- Model: the model name your local server expects.
- API key: optional for many local servers.

AI can help draft template text. It does not approve campaigns, schedule sends, or send email by itself.

## Optional Local Agent Access

Agent access is optional and local-only. When enabled, a local MCP-compatible assistant can use workflow tools for app orientation, contacts, classes, templates, direct email prepare/commit, and send-due campaign prepare/commit. Campaign approval and campaign schedule tools are not exposed yet.

Agent permissions control app tools only. They do not protect against filesystem access you have already granted to a coding agent, so do not grant agents access to runtime data directories unless you trust that environment. MCP tools do not expose raw SQL, database paths, or decrypted secrets.

Schedule and send actions require approval packets and exact confirmation text before the commit tool runs.

## Remote Access

By default, keep the app private on your machine or local network.

If you want access from another device, put a secure tunnel or reverse proxy in front of the app. Cloudflare Tunnel, Tailscale, Caddy, and nginx are all reasonable options.

For Cloudflare Tunnel:

1. Build and run the app on a private local port.
2. Set a strong app secret.
3. Set `SCUBA_EMAIL_SECURE_COOKIES=true` in the environment where the app starts when serving through HTTPS.
4. Forward your public hostname to the local app, for example `http://127.0.0.1:3000`.
5. In Settings, set the public base URL to the HTTPS hostname.
6. Enable remote-ready mode so the dashboard can report remote-access blockers.
7. Enable trusted proxy headers only if the tunnel is the only public path to the app.

Remote access protects the app with the same admin password. Use a strong password. The remote-ready and trusted-proxy settings do not configure your tunnel or proxy. Secure cookies are not a Settings-page checkbox; set `SCUBA_EMAIL_SECURE_COOKIES=true` before starting the app, then restart it. Remote-ready mode makes the app show whether required runtime hardening, such as `SCUBA_EMAIL_APP_SECRET` and secure cookies, is in place.

## Environment Variables

Common variables:

```bash
SCUBA_EMAIL_DATA_DIR=./data
SCUBA_EMAIL_DB=./data/scuba-email.sqlite
SCUBA_EMAIL_APP_SECRET=change-this-long-random-secret
SCUBA_EMAIL_APP_SECRET_FILE=./data/.scuba-email-app-secret
SCUBA_EMAIL_SECURE_COOKIES=false
SCUBA_EMAIL_DISABLE_BACKGROUND=false
SCUBA_HEALTH_URL=http://127.0.0.1:3010
HOST=127.0.0.1
PORT=5173
```

Important notes:

- `SCUBA_EMAIL_*`, `SCUBA_*`, and `scuba-email.sqlite` names are retained for runtime compatibility during the product-neutral rename. A later compatibility slice can add new aliases or migration behavior.
- Set `SCUBA_EMAIL_APP_SECRET` before exposing the app remotely, or preserve the generated local secret file.
- If `SCUBA_EMAIL_APP_SECRET` is not set, the app creates a persistent local secret file under the data directory.
- Set `SCUBA_EMAIL_SECURE_COOKIES=true` when serving behind HTTPS.
- Set `SCUBA_EMAIL_DISABLE_BACKGROUND=true` only if you do not want the automatic scheduler to start.
- Back up the data directory. It contains contacts, templates, schedules, and encrypted settings.

## Production Build

Build the app:

```bash
npm run build
```

Run it:

```bash
HOST=127.0.0.1 PORT=3000 node build
```

When one deployment is intentionally accessed through more than one origin,
set `SCUBA_EMAIL_TRUSTED_ORIGINS` at build time to a comma-separated allowlist
of the additional exact origins. The adapter-node `ORIGIN` remains the primary
browser-facing URL. Do not use wildcards.

Run it under a process manager so scheduled sends continue while you are away.
Platform options:

- macOS: `launchd`
- Windows: Task Scheduler or NSSM
- Linux: `systemd`

This repo also includes a generic local release script:

```bash
npm run deploy:local
```

By default it builds a timestamped release under `releases/local`, updates the `current` link, and checks `http://127.0.0.1:3010`. Configure it with environment variables:

- `SCUBA_RELEASE_ROOT`: release directory root.
- `SCUBA_RESTART_COMMAND`: optional command to restart your process manager.
- `SCUBA_HEALTH_URL`: health check URL.
- `SCUBA_DEPLOY_PORT`: port used for the default health check.
- `SCUBA_SKIP_HEALTH_CHECK=true`: skip the health check when a process manager is not running.

The script does not install or configure `launchd`, Task Scheduler, NSSM, or `systemd`. Configure your process manager to run the release's `build` directory with the app environment variables above.

## Development

Install dependencies:

```bash
npm install
```

Run the app:

```bash
npm run dev
```

Run verification:

```bash
npm run agent:check
```

This runs:

```bash
git diff --check
npm test
npm run check
npm run mcp:build
npm run mcp:smoke
npm run build
```

Read `AGENTS.md` before making agent-driven changes. Read `docs/AI-MAINTAINER.md` before broad refactors, deployments, or changes that cross more than one workflow. Read `docs/ARCHITECTURE.md` before changing persistence, scheduling, auth, SMTP, AI, or template rendering. Agent skills, scoped rules, review agents, prompts, and governance are documented in `docs/AGENTIC-OPERATING-MODEL.md`.

Read `docs/EXTERNAL-EVENTS.md` before adding or changing optional external
event ingestion.

Read `docs/OPEN-SOURCE-READINESS.md` before making public-facing changes.
Read `docs/RELEASES.md` before changing versions or release packaging.

Dependency updates are managed by Dependabot through `.github/dependabot.yml`.
Dependabot opens weekly grouped PRs for npm and GitHub Actions updates. These
PRs are never auto-merged; review and run the normal verification path before
merge.

Build desktop packages:

```bash
npm run desktop:build
npm run desktop:dist:win
npm run desktop:dist:mac
npm run desktop:dist:linux
```

Desktop packaging is separate from server deployment. Existing `npm run build`,
`node build`, and `npm run deploy:local` flows are unchanged.

## Data And Privacy

The app stores data locally. Treat the data directory as sensitive because it can include:

- Student contact details.
- Class enrollment history.
- Email templates and campaign history.
- Encrypted SMTP password and optional AI API key.
- Login sessions and app settings.

Do not commit the data directory. It is ignored by git.
