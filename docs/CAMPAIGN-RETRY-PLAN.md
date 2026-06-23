# Campaign Retry Plan

Audience: future maintainers implementing campaign-send retry behavior.

After reading this plan, a maintainer should be able to implement bounded,
auditable campaign retries without breaking the send-once invariant.

## Goal

Campaign sends should recover from temporary SMTP or network failures without
retrying forever and without resending successful deliveries.

The app should automatically retry only failures that are safe to retry,
surface everything else to the operator, and preserve a clear attempt history.

## Non-Goals

- Do not retry direct one-off email automatically.
- Do not add provider-specific hosted services.
- Do not create a general job queue.
- Do not resend any delivery already accepted by SMTP.
- Do not hide retry behavior behind a broad "send due now" action.
- Do not restart or redeploy a hosted instance merely because this plan exists.
  Implementation should wait until the global outbound safety requirements are
  covered.

## Required Invariants

- `sent` is terminal.
- Successful deliveries must never be retried by automatic sends, manual sends,
  agent actions, course-default updates, or scheduler recovery.
- Retries reuse the existing campaign delivery record. They do not create a new
  delivery identity for the same campaign and recipient.
- Each send attempt is auditable.
- A failed send means the SMTP delivery attempt failed. Persistence or audit
  failures after SMTP acceptance must not be recorded as failed sends.
- Automatic retries must be bounded by attempt count, backoff, and failure
  classification.
- Manual retry must be explicit, scoped, and confirmation-gated.
- The global outbound send surface must have consistent safety controls. Direct
  email, campaign send-due, MCP tools, and manual actions must share duplicate
  submit protection, rate limiting where practical, safe failure logging, and an
  operator-visible kill switch.

These controls should live behind one server-side outbound send gate used by
all SMTP send surfaces. Do not implement separate ad hoc checks in each route or
tool. The gate should check the kill switch, SMTP readiness, test-mode rules,
rate limits, idempotency, and safe error handling before any SMTP call is made.

## Global Outbound Safety Gate

Before campaign retries are implemented, introduce a shared outbound safety gate
for every path that can call SMTP:

- Campaign automatic send.
- Dashboard send-due.
- Campaign-detail manual send actions.
- Direct email.
- MCP send commits.
- SMTP settings test sends.
- Future retry actions.

The gate should enforce:

- A global outbound kill switch that blocks all SMTP sends, including test SMTP
  and test-mode reroutes.
- Per-installation rate limits and batch pacing.
- Direct-email recipient caps.
- MCP commit throttling.
- Idempotency keys for direct email batches and agent commits.
- Campaign delivery identity checks for campaign sends.
- Safe error sanitization before anything reaches persistence, logs, UI, or MCP
  responses.

Direct email needs its own send-operation identity because it does not have a
campaign delivery row. Persist or otherwise enforce a short-lived idempotency
key derived from the preview token, selected contacts, subject, body, and commit
operation. Reusing the same key must not send the same batch twice.

The kill switch must be visible on the dashboard and settings page. All commit
paths must recheck it immediately before sending.

## Default Policy

The default retry policy should be conservative:

- First attempt: at the approved scheduled send time.
- Automatic retries: at most three retries after the first failed attempt.
- Backoff schedule: 5 minutes, 30 minutes, 2 hours.
- Retryable failures: transient failures only.
- Permanent failures: no automatic retry; move to `needs_attention`.
- Unknown failures: no automatic retry by default. If a product decision later
  allows one unknown retry, that must be a separate reviewed change.
- Manual retry: allowed for failed or attention-needed recipients, but never for
  sent recipients.

The scheduler may still wake every minute. It must only claim deliveries whose
retry time is due and whose failure class allows an automatic retry.

## Failure Classes

Use an explicit failure classification contract.

### Transient

Transient failures may auto-retry while under the attempt limit.

Examples:

- SMTP `4xx` responses such as greylisting, temporary mailbox unavailable, or
  provider throttling.
- Connection timeout, reset, temporary DNS failure, or temporary TLS failure.
- Temporary OAuth or provider token endpoint failures such as rate limiting,
  network failure, or provider `5xx`.

### Permanent

Permanent failures must not auto-retry.

Examples:

- SMTP `5xx` responses for invalid recipient, mailbox unavailable, invalid
  domain, sender blocked, or rejected message.
- Bad SMTP configuration.
- Bad credentials.
- Revoked or invalid OAuth grant.
- Missing provider consent.
- Malformed message or missing required settings.

### Unknown

Unknown failures should require attention unless an explicit product decision
allows one automatic retry.

Examples:

- Missing SMTP response code.
- Unexpected Nodemailer result shape.
- Ambiguous provider text.
- Thrown non-Error values.
- Mixed accepted/rejected provider signals that cannot be mapped clearly to the
  effective recipient.

## Provider Acceptance Rules

For campaign sends, there is one effective recipient per SMTP attempt.

- If the provider clearly accepts the effective recipient, the send is accepted.
- If the provider rejects the effective recipient, the send failed.
- If the provider response cannot prove acceptance or rejection, classify it as
  unknown.
- Acceptance rules decide whether the attempt is `sent` or not sent. Failure
  classification then uses SMTP status code, enhanced status code, command, and
  sanitized provider category. Effective-recipient rejection with `4xx` remains
  transient; rejection with `5xx` remains permanent; rejection without a reliable
  code is unknown.
- Recipient comparisons should normalize address casing and compare the address
  portion, not display names.
- Provider responses may include accepted, rejected, pending, response code,
  response text, command, and network code. Capture enough structured detail for
  classification without storing secrets.

## Error Redaction

Store useful, user-safe failure summaries. Do not store raw provider messages
without sanitization.

Redaction should remove or avoid:

- SMTP passwords.
- OAuth access tokens and refresh tokens.
- Client secrets.
- Session or app secrets.
- Full connection strings.
- Private hostnames or local paths.
- Raw socket objects, raw provider response objects, IP addresses, local
  interface details, and TLS internals.

Persist only a small allowlist of structured diagnostic fields:

- Normalized network error code.
- SMTP command.
- SMTP response code.
- Enhanced SMTP status code.
- Sanitized provider category.
- Safe user-facing summary.

User-visible errors should describe the action to take:

- "Mailbox temporarily unavailable. The app will retry."
- "Recipient was rejected by the mail server. Check the email address."
- "SMTP sign-in failed. Check settings."
- "The mail server response was unclear. Review before retrying."

## Delivery State Model

Campaign delivery status should remain simple enough for operators to scan, but
must include retry metadata.

Recommended statuses:

- `pending`: waiting for the first attempt.
- `sending`: currently claimed by a worker.
- `sent`: accepted by SMTP. Terminal.
- `failed`: failed and may be eligible for retry.
- `retry_scheduled`: failed and has an automatic retry scheduled.
- `needs_attention`: automatic retry will not continue.
- `skipped`: excluded because sending is not allowed for that recipient.

The delivery record should expose:

- Attempt count.
- Last attempt time.
- Next retry time.
- Failure class.
- Last safe error summary.
- Claim expiration time for in-flight recovery.
- Whether the next action is automatic retry, manual retry, or operator fix.

If SMTP acceptance is known but follow-up persistence fails, the durable state
must be non-retryable. Use an explicit accepted-but-incomplete state on the
attempt or delivery, such as `accepted_audit_incomplete`, and surface it as
`needs_attention` for audit repair. It must not be eligible for automatic or
manual resend.

## Persistence Plan

Add retry state to campaign deliveries:

- `attempt_count`
- `last_attempt_at`
- `next_attempt_at`
- `claim_expires_at`
- `failure_kind`
- `failure_summary`
- `retry_policy_max_auto_retries`
- `retry_policy_backoff`

Introduce a dedicated delivery-attempt table and link communications to attempts
where applicable. The system must answer:

- Which delivery did this attempt belong to?
- Which attempt number was it?
- Was it automatic, manual, or agent-initiated?
- What was the rendered subject and body for that attempt?
- What did the provider accept or reject?
- What failure class and safe summary were recorded?

The attempt table is the durable send-attempt record. Communication history is
the user-facing outbound message history. A failed SMTP attempt should create an
attempt record and a failed communication record when persistence succeeds. An
accepted SMTP attempt should create an attempt record and an accepted
communication record when persistence succeeds. Persistence failures after SMTP
acceptance must not convert the attempt to a failed send.

Claiming a delivery must create the delivery-attempt row in the same transaction
that increments attempt count and moves the delivery to `sending`. The claim
returns the attempt identifier. SMTP acceptance or failure then finalizes that
same attempt row.

Minimum attempt table contract:

- `delivery_attempts.delivery_id` references campaign deliveries.
- Unique delivery plus attempt number.
- Initiation source: automatic, manual, or agent.
- Attempt status: claimed, accepted, failed, unknown, abandoned, or
  accepted-audit-incomplete.
- Claim expiration time.
- Rendered subject and body snapshot.
- Sanitized provider classification fields.
- Optional communication link, with one canonical relationship direction.

The delivery row is the active scheduling snapshot source. Copy the relevant
retry policy onto each attempt for audit. Encode backoff as a validated JSON
array of seconds or minutes.

If the app exits after claim but before SMTP is called, recovery should mark the
attempt abandoned/unknown and move the delivery to `needs_attention`.

## Migration Plan

Existing delivery rows need deterministic backfill:

- `sent`: terminal. Set attempt count to at least one when unknown. Clear retry
  fields.
- `pending`: attempt count zero. Clear retry fields.
- `failed`: do not auto-retry old failures by default. Mark as
  `needs_attention` with `failure_kind = unknown`, no scheduled retry, and a
  safe migrated summary.
- `sending`: treat as stale and needing attention unless there is a safer local
  recovery rule at migration time.

Add indexes for claim paths:

- status plus next retry time.
- campaign plus status plus next retry time.
- claim expiration for stale in-flight recovery.

## Claim Semantics

Attempt count should increment when a row is claimed, not after the SMTP call.

Claiming a delivery should atomically:

- Select only eligible rows.
- Move the row to `sending`.
- Increment attempt count.
- Create the delivery-attempt row with the same attempt number.
- Set last attempt time.
- Set claim expiration.
- Clear stale transient claim details.
- Return the claimed row.

The automatic claim query must check:

- Campaign is approved.
- Campaign scheduled time is due.
- Scheduler is enabled.
- Email test mode is off.
- Recipient is still enrolled.
- Recipient is not marked do-not-email.
- Delivery is not sent.
- Delivery is pending first attempt, or it is a due retry.
- Failure class is retryable.
- Attempt count is below the automatic limit.
- Next retry time is due.

Manual retry should use a separate repository method. It may override timing,
failure class, or max attempts only for the selected failed recipients. It must
never include sent deliveries.

Settings-managed retry defaults must have hard safety caps:

- Maximum automatic retries cannot exceed three.
- Minimum automatic backoff cannot be less than five minutes.
- Permanent and authentication failures always move to `needs_attention`.
- Settings changes must not retroactively loosen snapshotted retry policy unless
  the operator explicitly resets selected deliveries.

Persist retry settings through a grouped settings action in the existing sending
or scheduler settings section. Invalid capped values should return validation
errors. Saving retry settings must not rewrite unrelated settings groups.

Default policy allows one initial attempt plus three automatic retries, for four
total automatic attempts. Tests must cover the boundary before and after the
third retry.

## Retry Scheduling

On failed SMTP attempt:

1. Classify the failure.
2. Store a safe summary.
3. Record the attempt.
4. If transient and under the automatic limit, schedule the next retry.
5. If permanent, unknown, or over the limit, move to `needs_attention`.

Backoff is based on retry number, not total campaign age:

- First retry: 5 minutes after failure.
- Second retry: 30 minutes after failure.
- Third retry: 2 hours after failure.

After the final automatic retry fails, clear the next retry time and move to
`needs_attention`.

## Stuck Sending Recovery

Rows can become stuck in `sending` if the app exits after claiming a delivery.
This must not produce blind automatic resend.

Use `claim_expires_at` to detect stale claims. When a claim expires:

- Do not mark it sent.
- Do not immediately retry automatically.
- Move it to `needs_attention` with a safe summary such as "Send status is
  unknown because the app stopped during delivery."
- Let the operator manually retry if they confirm it is appropriate.

This is conservative because SMTP may have accepted the message shortly before
the app stopped.

## Course Defaults And Schedule Changes

Course-default updates must not wipe retry state blindly.

When defaults change:

- Sent deliveries remain terminal.
- Pending unsent deliveries may update with the new template or schedule.
- Retry-scheduled deliveries should preserve attempt history and failure
  metadata unless the operator explicitly resets them.
- Permanent and attention-needed failures should remain visible.
- Manual reset should be scoped and explicit.

## Manual Retry UX

Manual retry should be a scoped action, preferably from campaign detail.

The operator should be able to:

- Retry selected recipients.
- Retry all transient failures for one campaign.
- Retry attention-needed recipients after making a correction.
- Cancel scheduled retries.
- Leave sent recipients untouched.

Manual retry confirmation should state:

- Campaign name.
- Number of recipients.
- That sent recipients are excluded.
- Whether retry limits or failure classifications are being overridden.
- The required correction category for attention-needed recipients, such as
  recipient address, SMTP settings, provider sign-in, consent, or unknown send
  state.

Retry controls should block or strongly warn when the required correction has
not been satisfied. Commit-time validation should recheck SMTP readiness, kill
switch state, test mode, rate-limit budget, do-not-email, enrollment, recipient
address, and sent-recipient exclusion.

Agent-triggered retry must use the same approval packet pattern as other send
actions and must revalidate the selected recipients at commit time.

## UI Visibility

Dashboard should show operational buckets:

- Due first attempts: approved unsent first attempts due now.
- Automatic retries scheduled: retry rows with a future next retry time.
- Overdue automatic retries: retry rows whose next retry time is due now.
- Needs attention: rows that automatic sending will not continue.
- Stuck sending: expired in-flight claims before recovery, plus recovered
  unknown-send-state rows that require operator review.
- Sent today.

Campaign detail should be the retry console:

- Per-recipient status.
- Attempt count and max attempts.
- Last attempt time.
- Next retry time.
- Last safe error summary.
- Failure class.
- Controls for retry, cancel retry, and selected-recipient actions.

Communications should remain the audit trail:

- Show campaign attempts grouped under the outbound campaign communication when
  possible, with a link from each attempt to its campaign recipient row.
- Direct email remains one communication per recipient send operation.
- Show automatic, manual, or agent initiation.
- Show test-mode rerouting where applicable.
- Do not become the primary retry-control surface.

Settings should include retry defaults in the scheduler or sending section:

- Automatic retries enabled.
- Max retry attempts.
- Backoff schedule.
- Retry window or expiry, if added.
- Manual retry behavior after automatic limits.

## Test Mode

Automatic campaign sends remain paused while email test mode is enabled.

Manual retry is blocked while email test mode is enabled. A separate test-mode
retry simulation may be added later, but it must be explicitly named as a test
send, routed only to the configured test recipient, and recorded as test mode.

## Agent And MCP Behavior

Agent retry actions must be approval-gated.

Prepare actions should return:

- Campaign identity.
- Selected recipient count.
- Excluded sent recipient count.
- Failure classes included.
- Whether automatic limits are being overridden.
- Exact confirmation text.
- Current kill switch state, test-mode state, and rate-limit eligibility.

Retry approval text must be distinct from first-time send approval. Use wording
that includes the campaign, selected retry count, excluded sent count, whether
limits or failure classifications are overridden, whether stale/unknown send
states are included, and the current test-mode state.

Example shape:

`APPROVE RETRY <count> RECIPIENTS FOR <campaign>. SENT RECIPIENTS EXCLUDED.`

Commit actions should revalidate:

- Campaign still exists and is approved.
- Recipients are still eligible.
- Sent recipients are still excluded.
- Scheduler/test-mode behavior is still valid.
- The outbound kill switch is still off.
- Rate-limit budget is still available.
- The approval has not already been committed.
- The operation idempotency key has not already been used.

## Implementation Slices

1. Add global outbound send-safety controls for direct email, campaign send-due,
   MCP tools, manual actions, duplicate-submit protection, rate limiting, safe
   failure logging, and an operator-visible kill switch.
2. Add failure classification and safe error summaries.
3. Add retry-state persistence and migration.
4. Add a dedicated delivery-attempt table and link communications to attempts.
5. Replace broad failed-to-pending retry behavior with due-retry claim methods.
6. Update send processing to schedule retries from classified SMTP failures.
7. Add stuck-sending recovery.
8. Add campaign-detail retry visibility and scoped manual controls.
9. Update dashboard operational counts.
10. Add settings for retry defaults with hard caps.
11. Add agent prepare/commit retry tools if agent retry is in scope.
12. Update architecture and user docs.

## Test Plan

Add repository tests for:

- Migration backfill for old sent, pending, failed, and sending rows.
- Claiming due first attempts.
- Claiming due retry rows.
- Claim creates a durable attempt row before SMTP is called.
- Not claiming future retries.
- Not claiming sent rows.
- Not claiming do-not-email recipients.
- Not claiming unapproved campaigns.
- Two repository instances cannot claim the same retry row.
- Attempt count increments at claim time.
- Stale sending rows move to attention-needed state.
- Process exit after claim leaves an abandoned or unknown attempt, not only a
  delivery status.
- Course-default updates preserve retry state appropriately.
- Migration maps old failed rows deterministically to `needs_attention` with
  `failure_kind = unknown`.

Add scheduler/send tests for:

- Transient failure schedules 5 minute, 30 minute, and 2 hour retries.
- Final transient failure moves to needs attention.
- Permanent failure moves directly to needs attention.
- Unknown failure moves to needs attention unless the product decision allows
  one unknown retry in a future reviewed change.
- Manual retry can override selected failed recipients.
- Manual retry cannot include sent recipients.
- SMTP acceptance followed by persistence failure is not recorded as send
  failure.
- SMTP acceptance followed by communication insert failure leaves delivery and
  attempt non-retryable.
- Three automatic retries after the first attempt are allowed; the next failure
  stops automatic retry.

Add mailer/classifier tests for:

- SMTP `4xx` classification.
- SMTP `5xx` classification.
- Rejected effective recipient.
- Accepted effective recipient.
- Ambiguous provider response.
- OAuth temporary failure.
- OAuth invalid grant.
- Redaction of known secret-shaped values.

Add UI contract tests where practical for:

- Dashboard retry buckets.
- Campaign detail attempt metadata.
- Retry confirmation copy includes scope and sent-recipient exclusion.
- Test mode blocks manual retry.
- Agent retry approval text is distinct from send-due approval text.

## Documentation Updates

Update architecture documentation when implementing this plan:

- Replace the current "no automatic retry" language with bounded automatic
  retry rules.
- Document failure classes.
- Document terminal sent behavior.
- Document manual retry confirmation.
- Document stuck sending recovery.

Update user-facing docs when retry settings and controls exist.

## Open Decisions

Before implementation, decide:

- What should the default stale-claim timeout be?
