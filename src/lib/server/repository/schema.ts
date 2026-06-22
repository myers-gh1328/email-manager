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
      unique (campaign_id, recipient_id)
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
    create index if not exists idx_communication_replies_communication_id
      on communication_replies(communication_id, received_at);
  `);
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
