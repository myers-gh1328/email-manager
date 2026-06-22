# Security Policy

Training Communications Studio is a local-first app that stores sensitive data
on the operator's machine, including student contact data, email content,
encrypted SMTP credentials, Microsoft OAuth tokens, optional AI settings, and
sessions.

## Reporting Security Issues

Do not include real SQLite databases, logs, screenshots, roster exports, SMTP
credentials, OAuth tokens, AI keys, app secrets, session cookies, or student
contact data in a public issue or pull request.

If this repository is public and private security advisories are enabled, use
the repository security advisory flow. Otherwise, open a minimal issue that
describes the affected component and request a private reporting channel.

## Supported Versions

This project is pre-1.0. Security fixes are made on the main development line
unless a release branch is explicitly documented.

## Operator Responsibilities

- Keep runtime data directories private and backed up.
- Use a strong admin password.
- Set a persistent `SCUBA_EMAIL_APP_SECRET` or preserve the generated local
  secret file.
- Enable secure cookies when exposing the app over HTTPS.
- Keep NATS, SMTP, Microsoft OAuth, and AI endpoints private unless they are
  intentionally hardened.
