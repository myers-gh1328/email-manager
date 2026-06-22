# External Events

Training Communications Studio may optionally import data from an external event source.
This feature is for user-configured integrations. The app must not assume any
specific private message bus, host, account, or deployment environment.

External events are inbound suggestions for data entry. They do not send email,
approve campaigns, change SMTP settings, change security settings, or bypass
instructor review.

## Scope

The initial event set is read-only ingestion for:

- `contact.upsert`
- `class.upsert`
- `class_user.upsert`

The local transport is NATS. NATS carries the events, but the domain contract
is still the event shape below. Provider-specific connection settings must be
configured by the user or deployment environment.

Pub/sub is a transport detail, not an authorization shortcut. Messages received
from NATS follow the same validation, idempotency, and instructor-review rules
as any future transport.

## Envelope

Every event uses this envelope:

```json
{
  "type": "contact.upsert",
  "id": "evt_001",
  "occurredAt": "2026-06-21T15:00:00Z",
  "source": "external-system-name",
  "data": {}
}
```

Fields:

- `type`: one supported event type.
- `id`: unique event ID from the producer.
- `occurredAt`: ISO-8601 timestamp for when the producer observed the change.
- `source`: stable producer identifier, such as `booking-system`.
- `data`: event-specific payload.

Consumers should treat `source` plus payload `externalId` as the idempotency
key for upserted records.

The app also applies normal duplicate detection while importing. Contacts match
by normalized email. Class sessions match by course type, start date, start
time, and either managed location ID or normalized free-text location.

## `contact.upsert`

Creates or updates a reusable contact.

```json
{
  "type": "contact.upsert",
  "id": "evt_001",
  "occurredAt": "2026-06-21T15:00:00Z",
  "source": "external",
  "data": {
    "externalId": "student-123",
    "email": "student@example.com",
    "firstName": "Sam",
    "lastName": "Diver",
    "phone": "555-0100",
    "doNotEmail": false,
    "notes": "Optional note"
  }
}
```

Required data fields:

- `externalId`
- `email`

Optional data fields:

- `firstName`
- `lastName`
- `phone`
- `doNotEmail`
- `notes`

## `class.upsert`

Creates or updates a dated class session or the closest equivalent supported by
the app's current class model.

```json
{
  "type": "class.upsert",
  "id": "evt_002",
  "occurredAt": "2026-06-21T15:01:00Z",
  "source": "external",
  "data": {
    "externalId": "ow-2026-07-10",
    "courseName": "Open Water Diver",
    "startsOn": "2026-07-10",
    "endsOn": "2026-07-12",
    "location": "Dive Shop",
    "notes": "Optional note"
  }
}
```

Required data fields:

- `externalId`
- `courseName`
- `startsOn`

Optional data fields:

- `endsOn`
- `location`
- `notes`

## `class_user.upsert`

Creates or updates the relationship between a contact and a class.

```json
{
  "type": "class_user.upsert",
  "id": "evt_003",
  "occurredAt": "2026-06-21T15:02:00Z",
  "source": "external",
  "data": {
    "externalId": "enrollment-456",
    "classExternalId": "ow-2026-07-10",
    "contactExternalId": "student-123",
    "role": "student",
    "status": "enrolled",
    "notes": "Optional note"
  }
}
```

Required data fields:

- `externalId`
- `classExternalId`
- `contactExternalId`

Optional data fields:

- `role`
- `status`
- `notes`

`class_user.upsert` should only link records that can be resolved by external
IDs from the same `source`, unless a future UI explicitly allows manual review
and matching.

Missing, `enrolled`, and `active` statuses enroll the contact. `unenrolled`,
`cancelled`, `canceled`, and `removed` statuses remove the enrollment. Other
status values are rejected as invalid events.

## Agent-Assisted Integration Changes

Agents adding external event or pub/sub support should use the repo-local
`add-external-event-pubsub` skill. The skill keeps changes provider-neutral,
public-ready, and limited to user-configured ingestion. It is appropriate for
adding NATS or another transport adapter, extending the event validator, adding
settings UI for user-supplied connection details, or changing import behavior
for contacts, classes, and class enrollments.

Do not use agent changes to hard-code a private broker, private subject names,
private credentials, or owner-only deployment assumptions into this repo.
## Safety Rules

- Events never send email.
- Events never approve campaigns.
- Events never schedule campaigns without instructor review.
- Events never change SMTP, Microsoft OAuth, AI, admin, or security settings.
- Unknown event types are ignored or recorded as unsupported.
- Unknown payload fields are ignored.
- Invalid events are recorded for review or diagnostics instead of being
  partially applied.
- Event ingestion must be idempotent.
- Provider credentials and connection strings must not be stored in source
  control.

## Configuration Shape

Use provider-neutral settings:

```text
EXTERNAL_EVENTS_ENABLED=false
EXTERNAL_EVENTS_PROVIDER=nats
EXTERNAL_EVENTS_URL=nats://127.0.0.1:4222
EXTERNAL_EVENTS_SUBJECTS=
EXTERNAL_EVENTS_CONSUMER=email-manager
```

Provider-specific settings may be added when a provider is implemented, but
examples in public documentation must use fake values only.

For local NATS, use loopback or another user-configured private endpoint. Do not
commit real NATS credentials, private hostnames, account names, subject names
that identify a private business workflow, or deployment-specific connection
strings.
