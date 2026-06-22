# Open Source Readiness

Audience: owner/operator and future agents.

Training Communications Studio is an open-source local-first app. Keep the
current tree public-ready.

## Rule

Nothing private, machine-specific, or user-data-bearing belongs in git.

The app should be cloneable, understandable, and runnable by someone outside the
owner's machine without exposing private data or private infrastructure.

## Never Commit

- environment files with real values
- SQLite databases or any runtime data store
- student, customer, roster, contact, message, or email data
- SMTP passwords, Microsoft OAuth secrets, AI API keys, app secrets, session
  secrets, tokens, private keys, or certificates
- local logs, exports, screenshots, traces, reports, backups, or release
  artifacts
- private hostnames, LAN IP addresses, Tailscale addresses, usernames, or
  machine-specific absolute paths
- Cloudflare, Tailscale, Microsoft, SMTP, or AI account details
- generated build output, dependency folders, caches, or test artifacts
- private operational runbooks that assume access to the owner's devices,
  accounts, or infrastructure

## Public-Ready Checklist

- License is present and intentional.
- README explains who the app is for, what it does, and what it does not do.
- Install and run docs work from a clean clone.
- Verification commands are documented.
- Example config uses fake values only.
- Secret names may be documented; secret values are never documented.
- Privacy notes explain what data the app stores locally.
- Security notes explain where secrets live and what not to expose remotely.
- Contribution expectations are documented or explicitly not accepted yet.
- Support boundary is explicit: best effort, no warranty, local-first.
- Public docs do not depend on private hostnames, local paths, LAN IPs, or
  owner-only infrastructure.
- Optional AI, SMTP, Microsoft OAuth, and remote-access features remain
  optional unless the core app explicitly requires them later.
- External sign-on docs must not imply hosted authentication, shared Google
  credentials, or shared Microsoft credentials. Users who enable sign-on bring
  their own provider app registration and secrets.

## App-Specific Safety Checks

- Local SQLite data directory remains ignored.
- SMTP, Microsoft OAuth, AI, app secret, and session secrets are never tracked.
- Sample courses, students, rosters, and email content are synthetic.
- Public docs describe generic local deployment, not the owner's launchd setup
  as the only path.
- Reverse-proxy guidance is generic and does not include private hostnames or
  account details.
- AI drafting remains optional and user-reviewed.
- Scheduled sends preserve the send-once safety invariant.
- Remote exposure docs require a strong app secret and secure cookies.

## Before Public-Facing Changes

1. Review tracked files for forbidden data.
2. Review docs for private operational assumptions.
3. Review examples for real values.
4. Run the documented verification commands from a clean clone.
5. Confirm the license and support boundary.

## Current Audit Findings

Last reviewed: 2026-06-22.

These findings describe the current tracked tree.

### Cryptographic Defaults

- The app now generates a persistent ignored local app secret when
  `SCUBA_EMAIL_APP_SECRET` is not configured.
- Preserve the generated secret file with the runtime data directory. Losing it
  prevents decrypting previously saved local secrets and invalidates existing
  preview tokens.
- For remote exposure, prefer an explicit `SCUBA_EMAIL_APP_SECRET` managed by
  the deployment environment.
- `SCUBA_EMAIL_*`, `SCUBA_*`, and `scuba-email.sqlite` remain compatibility
  names during the product-neutral rename. Do not treat them as private data or
  rename them without a dedicated migration plan.

### Public Project Metadata

- A root license, contribution guide, and security policy are present.
- `package.json` remains marked private because this project is distributed as
  a desktop/server app, not as an npm package.
- Repository automation is allowed through reviewed workflow changes.

### Contribution, Support, And Security Policy

- `CONTRIBUTING.md` and `SECURITY.md` document contribution expectations,
  support boundaries, and reporting rules.

### Agent And Planning Artifacts

- Remove or generalize any remaining machine-specific paths in agent assets.
- Current historical plans/specs under `docs/superpowers/` remain tracked for
  private development continuity. Revisit whether to keep, move, or remove them
  before they are treated as user-facing project roadmap.

### Clean Areas From The Audit

- No tracked runtime database, `data/` directory, SQLite file, log, key,
  certificate, build output, dependency directory, release artifact, backup, or
  export was found in the current tracked tree.
- Synthetic examples use reserved or fake values such as `example.com`,
  `example.test`, and `555-` phone numbers.
- Current deployment documentation is process-manager-neutral and no longer
  depends on a private launchd setup.
