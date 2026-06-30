import type { DatabaseSync } from 'node:sqlite';

export function migrate(db: DatabaseSync) {
  db.exec(`
    create table if not exists contacts (
      id text primary key,
      first_name text not null,
      last_name text not null,
      email text not null,
      phone text not null default '',
      notes text not null default '',
      do_not_email integer not null default 0,
      created_at text not null
    );

    create table if not exists course_types (
      id text primary key,
      name text not null,
      description text not null default '',
      created_at text not null
    );

    create table if not exists locations (
      id text primary key,
      name text not null,
      address text not null default '',
      phone text not null default '',
      website text not null default '',
      parking_notes text not null default '',
      meeting_instructions text not null default '',
      notes text not null default '',
      created_at text not null
    );

    create table if not exists class_sessions (
      id text primary key,
      course_type_id text not null references course_types(id) on delete cascade,
      location_id text references locations(id) on delete set null,
      starts_on text not null,
      ends_on text not null default '',
      start_time text not null default '',
      location text not null,
      notes text not null default '',
      created_at text not null
    );

    create table if not exists course_type_default_templates (
      course_type_id text not null references course_types(id) on delete cascade,
      purpose text not null,
      label text not null default '',
      template_id text not null references templates(id) on delete cascade,
      sort_order integer not null default 0,
      send_offset_minutes integer not null default 0,
      created_at text not null,
      primary key (course_type_id, purpose, label)
    );

    create table if not exists enrollments (
      class_session_id text not null references class_sessions(id) on delete cascade,
      contact_id text not null references contacts(id) on delete cascade,
      created_at text not null,
      primary key (class_session_id, contact_id)
    );

    create table if not exists checklist_items (
      id text primary key,
      label text not null,
      sort_order integer not null default 0,
      created_at text not null
    );

    create table if not exists course_type_checklist_items (
      id text primary key,
      course_type_id text not null references course_types(id) on delete cascade,
      label text not null,
      sort_order integer not null default 0,
      created_at text not null
    );

    create table if not exists enrollment_checklist_completions (
      class_session_id text not null references class_sessions(id) on delete cascade,
      contact_id text not null references contacts(id) on delete cascade,
      item_scope text not null,
      item_id text not null,
      completed_at text not null,
      primary key (class_session_id, contact_id, item_scope, item_id),
      foreign key (class_session_id, contact_id) references enrollments(class_session_id, contact_id) on delete cascade
    );

    create table if not exists templates (
      id text primary key,
      name text not null,
      subject text not null,
      body text not null,
      created_at text not null
    );

    create table if not exists campaigns (
      id text primary key,
      class_session_id text not null references class_sessions(id) on delete cascade,
      template_id text not null references templates(id) on delete cascade,
      name text not null,
      scheduled_for text not null,
      approved integer not null default 0,
      source text not null default 'manual',
      default_purpose text not null default '',
      default_label text not null default '',
      send_offset_minutes integer not null default 0,
      created_at text not null
    );

    create table if not exists campaign_deliveries (
      id text primary key,
      campaign_id text not null references campaigns(id) on delete cascade,
      recipient_id text not null references contacts(id) on delete cascade,
      status text not null,
      created_at text not null,
      sent_at text,
      provider_message text,
      error_message text,
      attempt_count integer not null default 0,
      last_attempt_at text,
      next_attempt_at text,
      claim_expires_at text,
      failure_kind text not null default '',
      failure_summary text not null default '',
      needs_audit_repair integer not null default 0,
      retry_policy_max_auto_retries integer not null default 3,
      retry_policy_backoff text not null default '[300,1800,7200]',
      unique (campaign_id, recipient_id)
    );

    create table if not exists delivery_attempts (
      id text primary key,
      delivery_id text not null references campaign_deliveries(id) on delete cascade,
      attempt_number integer not null,
      source text not null,
      status text not null,
      claimed_at text not null,
      finalized_at text,
      claim_expires_at text not null,
      subject text not null default '',
      body text not null default '',
      provider_message text not null default '',
      failure_kind text not null default '',
      failure_summary text not null default '',
      retry_policy_max_auto_retries integer not null default 3,
      retry_policy_backoff text not null default '[300,1800,7200]',
      unique (delivery_id, attempt_number)
    );

    create table if not exists communications (
      id text primary key,
      contact_id text not null references contacts(id) on delete cascade,
      channel text not null,
      source text not null,
      source_id text,
      original_recipient text not null default '',
      effective_recipient text not null default '',
      test_mode integer not null default 0,
      subject text not null,
      body text not null,
      status text not null,
      sent_at text,
      message_id text not null default '',
      provider_message text,
      error_message text,
      delivery_id text references campaign_deliveries(id) on delete set null,
      delivery_attempt_id text references delivery_attempts(id) on delete set null,
      delivery_attempt_count integer not null default 1,
      failed_attempt_count integer not null default 0,
      created_at text not null
    );

    create table if not exists communication_replies (
      id text primary key,
      communication_id text not null references communications(id) on delete cascade,
      provider_key text not null,
      provider_message_id text not null default '',
      from_name text not null default '',
      from_email text not null default '',
      subject text not null default '',
      text_body text not null default '',
      html_body text not null default '',
      snippet text not null default '',
      received_at text not null,
      reviewed_at text not null default '',
      created_at text not null,
      unique (provider_key)
    );

    create table if not exists settings (
      key text primary key,
      value text not null,
      updated_at text not null
    );

    create table if not exists email_test_audits (
      id text primary key,
      original_recipient text not null,
      effective_recipient text not null,
      subject text not null,
      body text not null,
      provider_message text,
      created_at text not null
    );

    create table if not exists send_operations (
      id text primary key,
      operation_type text not null,
      send_operation_id text not null unique,
      idempotency_key text not null,
      status text not null,
      request_hash text not null,
      created_at text not null,
      updated_at text not null,
      expires_at text not null,
      result_summary text not null default '',
      failure_summary text not null default ''
    );

    create table if not exists send_operation_recipients (
      operation_id text not null references send_operations(id) on delete cascade,
      contact_id text not null,
      email text not null,
      status text not null,
      provider_message text not null default '',
      failure_kind text not null default '',
      failure_summary text not null default '',
      primary key (operation_id, contact_id)
    );

    create table if not exists outbound_rate_events (
      id text primary key,
      occurred_at text not null
    );

    create table if not exists external_mappings (
      source text not null,
      entity_type text not null,
      external_id text not null,
      local_id text not null,
      created_at text not null,
      updated_at text not null,
      primary key (source, entity_type, external_id)
    );

    create table if not exists external_event_ingestions (
      event_source text not null,
      event_id text not null,
      event_type text not null,
      status text not null,
      message text not null default '',
      occurred_at text not null,
      processed_at text not null,
      event_fingerprint text not null default '',
      raw_event text not null default '',
      primary key (event_source, event_id)
    );

    create table if not exists agent_approvals (
      id text primary key,
      tool_name text not null,
      risk text not null,
      summary text not null,
      operation_json text not null,
      review_json text not null,
      confirmation_text text not null,
      status text not null,
      created_at text not null,
      expires_at text not null,
      committed_at text not null default '',
      result_json text not null default ''
    );

    create table if not exists agent_audit_events (
      id text primary key,
      tool_name text not null,
      risk text not null,
      action text not null,
      summary text not null,
      entity_type text not null default '',
      entity_id text not null default '',
      status text not null,
      created_at text not null
    );
  `);

  addColumnIfMissing(db, 'class_sessions', 'ends_on', "text not null default ''");
  addColumnIfMissing(db, 'class_sessions', 'start_time', "text not null default ''");
  addColumnIfMissing(db, 'class_sessions', 'location_id', 'text references locations(id) on delete set null');
  addColumnIfMissing(db, 'communications', 'original_recipient', "text not null default ''");
  addColumnIfMissing(db, 'communications', 'effective_recipient', "text not null default ''");
  addColumnIfMissing(db, 'communications', 'test_mode', 'integer not null default 0');
  addColumnIfMissing(db, 'communications', 'message_id', "text not null default ''");
  addColumnIfMissing(db, 'course_type_default_templates', 'send_offset_minutes', 'integer not null default 0');
  addColumnIfMissing(db, 'campaigns', 'source', "text not null default 'manual'");
  addColumnIfMissing(db, 'campaigns', 'default_purpose', "text not null default ''");
  addColumnIfMissing(db, 'campaigns', 'default_label', "text not null default ''");
  addColumnIfMissing(db, 'campaigns', 'send_offset_minutes', 'integer not null default 0');
  addColumnIfMissing(db, 'external_event_ingestions', 'event_fingerprint', "text not null default ''");
  addColumnIfMissing(db, 'external_event_ingestions', 'raw_event', "text not null default ''");
  addColumnIfMissing(db, 'campaign_deliveries', 'attempt_count', 'integer not null default 0');
  addColumnIfMissing(db, 'campaign_deliveries', 'last_attempt_at', 'text');
  addColumnIfMissing(db, 'campaign_deliveries', 'next_attempt_at', 'text');
  addColumnIfMissing(db, 'campaign_deliveries', 'claim_expires_at', 'text');
  addColumnIfMissing(db, 'campaign_deliveries', 'failure_kind', "text not null default ''");
  addColumnIfMissing(db, 'campaign_deliveries', 'failure_summary', "text not null default ''");
  addColumnIfMissing(db, 'campaign_deliveries', 'needs_audit_repair', 'integer not null default 0');
  addColumnIfMissing(db, 'campaign_deliveries', 'retry_policy_max_auto_retries', 'integer not null default 3');
  addColumnIfMissing(db, 'campaign_deliveries', 'retry_policy_backoff', "text not null default '[300,1800,7200]'");
  addColumnIfMissing(db, 'communications', 'delivery_id', 'text references campaign_deliveries(id) on delete set null');
  addColumnIfMissing(db, 'communications', 'delivery_attempt_id', 'text references delivery_attempts(id) on delete set null');
  addColumnIfMissing(db, 'communications', 'delivery_attempt_count', 'integer not null default 1');
  addColumnIfMissing(db, 'communications', 'failed_attempt_count', 'integer not null default 0');

  backfillCommunicationAttemptCounts(db);

  backfillCampaignRetryState(db);

  assertNoDuplicateContacts(db);
  assertNoDuplicateClassSessions(db);

  db.exec(`
    create unique index if not exists contacts_email_unique
      on contacts (lower(trim(email)));
    create unique index if not exists class_sessions_duplicate_unique
      on class_sessions (
        course_type_id,
        starts_on,
        start_time,
        coalesce(location_id, ''),
        lower(trim(location))
      );
    create index if not exists idx_contacts_duplicate_email on contacts(lower(trim(email)));
    create index if not exists idx_class_sessions_duplicate_location_id
      on class_sessions(course_type_id, starts_on, start_time, location_id);
    create index if not exists idx_class_sessions_duplicate_location_text
      on class_sessions(course_type_id, starts_on, start_time, lower(trim(location)));
    create index if not exists idx_agent_approvals_status_expires
      on agent_approvals(status, expires_at);
    create index if not exists idx_agent_audit_events_created
      on agent_audit_events(created_at);
    create unique index if not exists idx_communications_message_id_unique
      on communications(message_id)
      where message_id != '';
    create unique index if not exists idx_communications_campaign_delivery_unique
      on communications(delivery_id)
      where source = 'campaign' and delivery_id is not null;
    create index if not exists idx_communications_created
      on communications(created_at);
    create index if not exists idx_communications_contact_created
      on communications(contact_id, created_at);
    create index if not exists idx_communications_source_created
      on communications(source_id, created_at);
    create index if not exists idx_communications_status_created
      on communications(status, created_at);
    create index if not exists idx_communication_replies_communication_id
      on communication_replies(communication_id, received_at);
    create index if not exists idx_campaign_deliveries_status_next_attempt
      on campaign_deliveries(status, next_attempt_at);
    create index if not exists idx_campaign_deliveries_campaign_status_next_attempt
      on campaign_deliveries(campaign_id, status, next_attempt_at);
    create index if not exists idx_campaign_deliveries_claim_expires
      on campaign_deliveries(claim_expires_at);
    create index if not exists idx_delivery_attempts_delivery
      on delivery_attempts(delivery_id, attempt_number);
    create index if not exists idx_send_operations_send_operation_id
      on send_operations(send_operation_id);
    create index if not exists idx_outbound_rate_events_occurred_at
      on outbound_rate_events(occurred_at);
  `);
}

function backfillCommunicationAttemptCounts(db: DatabaseSync) {
  db.prepare(
    `update communications
     set delivery_id = (
       select da.delivery_id
       from delivery_attempts da
       where da.id = communications.delivery_attempt_id
     )
     where delivery_id is null and delivery_attempt_id is not null`
  ).run();

  collapseDuplicateScheduledCommunications(db);

  db.prepare(
    `update communications
     set delivery_attempt_count = 1
     where delivery_attempt_count < 1`
  ).run();
  db.prepare(
    `update communications
     set failed_attempt_count = case when status = 'failed' then 1 else 0 end
     where failed_attempt_count < 1 and status = 'failed'`
  ).run();
}

function collapseDuplicateScheduledCommunications(db: DatabaseSync) {
  const duplicateDeliveries = db
    .prepare(
      `select delivery_id
       from communications
       where source = 'campaign' and delivery_id is not null
       group by delivery_id
       having count(*) > 1`
    )
    .all() as Array<{ delivery_id: string }>;

  for (const duplicate of duplicateDeliveries) {
    const rows = db
      .prepare(
        `select id, status, sent_at, message_id, provider_message, error_message, delivery_attempt_id, created_at, rowid
         from communications
         where source = 'campaign' and delivery_id = ?
         order by created_at, rowid`
      )
      .all(duplicate.delivery_id) as Array<{
        id: string;
        status: string;
        sent_at: string | null;
        message_id: string;
        provider_message: string | null;
        error_message: string | null;
        delivery_attempt_id: string | null;
      }>;
    const [canonical, ...duplicates] = rows;
    const latest = rows[rows.length - 1];
    if (!canonical || !latest) continue;

    const attemptCountRow = db
      .prepare('select count(*) as value from delivery_attempts where delivery_id = ?')
      .get(duplicate.delivery_id) as { value?: number };
    const failedCountRow = db
      .prepare("select count(*) as value from delivery_attempts where delivery_id = ? and status in ('failed', 'unknown')")
      .get(duplicate.delivery_id) as { value?: number };

    db.prepare(
      `update communications
       set status = ?,
         sent_at = ?,
         message_id = ?,
         provider_message = ?,
         error_message = ?,
         delivery_attempt_id = ?,
         delivery_attempt_count = ?,
         failed_attempt_count = ?
       where id = ?`
    ).run(
      latest.status,
      latest.sent_at,
      latest.message_id,
      latest.provider_message,
      latest.error_message,
      latest.delivery_attempt_id,
      Math.max(Number(attemptCountRow.value ?? rows.length), rows.length, 1),
      Math.max(Number(failedCountRow.value ?? 0), rows.filter((row) => row.status === 'failed').length),
      canonical.id
    );

    for (const row of duplicates) {
      db.prepare('update communication_replies set communication_id = ? where communication_id = ?').run(canonical.id, row.id);
      db.prepare('delete from communications where id = ?').run(row.id);
    }
  }
}

function addColumnIfMissing(db: DatabaseSync, table: string, column: string, definition: string) {
  const columns = db.prepare(`pragma table_info(${table})`).all() as Array<{ name: string }>;
  if (!columns.some((row) => row.name === column)) {
    db.exec(`alter table ${table} add column ${column} ${definition}`);
  }
}

function assertNoDuplicateContacts(db: DatabaseSync) {
  const duplicates = db
    .prepare(
      `select lower(trim(email)) as email, count(*) as count
       from contacts
       where trim(email) != ''
       group by lower(trim(email))
       having count(*) > 1
       order by email`
    )
    .all() as Array<{ email: string; count: number }>;
  if (duplicates.length) {
    throw new Error(`Duplicate contact emails must be merged before migration: ${duplicates.map((row) => row.email).join(', ')}`);
  }
}

function assertNoDuplicateClassSessions(db: DatabaseSync) {
  const duplicates = db
    .prepare(
      `select course_type_id, starts_on, start_time, coalesce(location_id, '') as location_id, lower(trim(location)) as location, count(*) as count
       from class_sessions
       group by course_type_id, starts_on, start_time, coalesce(location_id, ''), lower(trim(location))
       having count(*) > 1
       order by starts_on, start_time, location`
    )
    .all() as Array<{ course_type_id: string; starts_on: string; start_time: string; location_id: string; location: string; count: number }>;
  if (duplicates.length) {
    const keys = duplicates.map((row) => `${row.course_type_id}/${row.starts_on}/${row.start_time || 'no-time'}/${row.location_id || row.location}`);
    throw new Error(`Duplicate class sessions must be merged before migration: ${keys.join(', ')}`);
  }
}

function backfillCampaignRetryState(db: DatabaseSync) {
  db.prepare(
    `update campaign_deliveries
     set attempt_count = case when attempt_count = 0 then 1 else attempt_count end,
       failure_kind = case when failure_kind = '' then 'unknown' else failure_kind end,
       failure_summary = case when failure_summary = '' then 'Previous failed delivery needs attention before retrying.' else failure_summary end,
       status = 'needs_attention',
       next_attempt_at = null,
       claim_expires_at = null
     where status = 'failed' and attempt_count = 0`
  ).run();
  db.prepare(
    `update campaign_deliveries
     set attempt_count = case when attempt_count = 0 then 1 else attempt_count end,
       next_attempt_at = null,
       claim_expires_at = null,
       failure_kind = '',
       failure_summary = ''
     where status = 'sent'`
  ).run();
  db.prepare(
    `update campaign_deliveries
     set status = 'needs_attention',
       attempt_count = case when attempt_count = 0 then 1 else attempt_count end,
       failure_kind = case when failure_kind = '' then 'unknown' else failure_kind end,
       failure_summary = case when failure_summary = '' then 'Send status is unknown because the app stopped during delivery.' else failure_summary end,
       next_attempt_at = null
     where status = 'sending' and claim_expires_at is null`
  ).run();
}
