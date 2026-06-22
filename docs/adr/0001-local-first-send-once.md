# ADR 0001: Local-First App With Send-Once Campaign Delivery

## Status

Accepted

## Context

Training Communications Studio is built for individual instructors and training providers who manage class communications from their own machine. The app stores student contact data, templates, class sessions, settings, and encrypted SMTP credentials locally.

Email delivery is high risk because accidental duplicate emails are visible to students and can erode trust. Scheduled sends must also remain understandable to non-technical users.

## Decision

The app remains local-first and single-user by default.

Campaign email delivery is modeled as one campaign with one delivery row per recipient. Successful campaign deliveries are terminal and must not be sent again. Failed deliveries may retry.

The dashboard, class detail, campaign detail, communications history, and test audit views must expose enough state for the instructor to understand what will send, what already sent, and what is blocked.

## Consequences

- Core workflows cannot depend on remote services other than the instructor's chosen SMTP provider.
- AI drafting remains optional and cannot approve, schedule, or send emails.
- Schema, repository, scheduler, mailer, and UI changes must preserve the send-once invariant.
- Tests should cover send eligibility, delivery history, test mode, and operator visibility when those behaviors change.
