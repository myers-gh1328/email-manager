# Communications Design

## Goal

Add a direct email workflow for one or more students and make outbound email history visible from a contact-centered page.

## Scope

The first version supports immediate SMTP sends to selected contacts. The composer accepts freeform subject/body text and can optionally seed those fields from an existing template. Direct emails do not require class/session context. Template variables supported in direct email are `{{firstName}}`, `{{fullName}}`, and `{{instructorName}}`; class variables render empty unless sent through campaign workflows.

## Architecture

Add a general communication log owned by the repository. The log records one row per recipient and is the source of truth for contact communication history. Campaign sending keeps its existing send-once delivery behavior and additionally writes communication rows for successful and failed recipient attempts. Direct sends use the same mailer and create communication rows for each selected recipient.

## Data Model

Create `communications` with:

- `id`
- `contact_id`
- `channel`, initially `email`
- `source`, `direct` or `campaign`
- `source_id`, nullable
- `subject`
- `body`
- `status`, `sent` or `failed`
- `sent_at`
- `provider_message`
- `error_message`
- `created_at`

Rows store rendered subject/body snapshots so history reflects what was sent at the time.

## UI

Add `/communications` and a nav link. The page has a composer and a history view:

- Composer selects one or more contacts, optional template, subject, and body.
- Preview shows the personalized result per selected contact.
- Send immediately sends one email per selected contact through SMTP.
- Contacts marked `doNotEmail` are blocked from direct sends.
- History can be filtered by contact and shows recipient, date, source, status, subject, and body.

## Safety

Do not log SMTP passwords or decrypted secrets. Preserve campaign delivery uniqueness and idempotency. Communication logging must not cause successful campaign deliveries to resend. Failed direct sends are recorded with the error message, but direct sends have no automatic retry behavior in this version.

## Testing

Add repository tests for communication creation/listing and history ordering. Add direct-send action tests around do-not-email filtering and personalized rendering where existing test patterns allow it. Run `npm test`, `npm run check`, and `npm run build` before completion.
