---
name: scuba-send-safety
description: Use when touching scheduled emails, campaigns, campaign deliveries, direct email, communication history, SMTP, email test mode, or scheduler readiness.
paths:
  - "src/lib/server/background.ts"
  - "src/lib/server/scheduler.ts"
  - "src/lib/server/mailer.ts"
  - "src/lib/server/campaign-email.ts"
  - "src/lib/server/direct-email.ts"
  - "src/lib/server/repository/**"
  - "src/routes/campaigns/**"
  - "src/routes/classes/**"
  - "src/routes/communications/**"
  - "src/routes/test-audit/**"
  - "tests/**"
---

# Scuba Send Safety

## When To Use

Use this skill for any change that could affect what email sends, when it sends, who receives it, what history is recorded, or how test mode reroutes mail.

Do not use this skill for unrelated cosmetic changes unless they change send-state visibility.

## Required Invariants

- Successful campaign deliveries never resend.
- Failed campaign deliveries may retry.
- Manual send-due and background send-due use the same send-once behavior.
- Email test mode reroutes outbound mail to the safe test recipient.
- Automatic scheduled sends pause while email test mode is enabled.
- Direct and campaign sends both create outbound communication history.
- Decrypted SMTP secrets, OAuth tokens, AI keys, and app secrets never leave server code or logs.

## Procedure

1. Read `docs/ARCHITECTURE.md`, especially Send-Once, Background Scheduler, SMTP Delivery, and Operator Visibility Contracts.
2. Identify every path that can send mail for the changed behavior.
3. Confirm the change preserves campaign delivery idempotency.
4. Confirm the UI still shows what will send, when it will send, approval state, source, template, recipient counts, and delivery status.
5. Add or update tests for the invariant, preferably in focused server/repository tests.
6. Run focused tests while iterating:
   - `npm test -- tests/scheduler.test.ts`
   - `npm test -- tests/background.communications.test.ts`
   - `npm test -- tests/campaign-email.test.ts`
   - `npm test -- tests/direct-email.test.ts`
   - `npm test -- tests/mailer.test.ts`
   - `npm test -- tests/repository.campaigns.test.ts`
   - `npm test -- tests/repository.communications.test.ts`
7. Run `npm run agent:check` before claiming completion.

## Review Checklist

- Does a successful delivery remain terminal?
- Are already-sent histories preserved when defaults or class schedules change?
- Is the user's intended send time visible before approval?
- Can the user find complete outbound history without guessing?
- Does test mode make real delivery impossible while still auditable?
- Are scheduler blockers visible when automatic sending cannot run?
