import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const dbPath = join(process.cwd(), '.agent-dev/data/scuba-email.sqlite');
const loginPhrase = 'agent-dev-login';
const seedMarker = 'dev.agentSeeded';

mkdirSync(dirname(dbPath), { recursive: true });
const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = ON');
migrate();

if (!getSetting('auth.passwordHash')) {
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(loginPhrase, salt, 210_000, 32, 'sha256').toString('hex');
  setSetting('auth.passwordHash', `${salt}:${hash}`);
}

if (getSetting(seedMarker) === 'true') {
  console.log(`Agent dev database already seeded. Login phrase: ${loginPhrase}`);
  process.exit(0);
}

setSetting('profile.instructorName', 'Blue Harbor Scuba');
setSetting('email.signature', 'Blue Harbor Scuba\nInstructor');
setSetting('email.testModeEnabled', 'true');
setSetting('scheduler.enabled', 'false');
setSetting('smtp.from', 'test-inbox@example.com');
setSetting('smtp.host', 'smtp.example.test');
setSetting('smtp.port', '587');
setSetting('smtp.user', 'test-inbox@example.com');
setSetting('ai.baseUrl', 'http://127.0.0.1:11434/v1');
setSetting('ai.model', 'llama3.1');

const openWaterId = insertCourseType('Open Water Diver', 'Entry-level certification with classroom, pool, and checkout dive sessions.');
const rescueId = insertCourseType('Rescue Diver', 'Scenario-based rescue skills and emergency planning.');
const quarryId = insertLocation('Blue Quarry', '100 Quarry Road', 'Meet by the lower lot gear tables.', 'Bring certification card, mask, fins, exposure protection, and logbook.');
const poolId = insertLocation('Community Pool', '22 Lap Lane', '', 'Enter through the side gate and check in with the instructor.');

const welcomeId = insertTemplate(
  'Open Water welcome',
  'Welcome to {{courseName}}',
  'Hi {{firstName}},\n\nYou are enrolled in {{courseName}} starting {{classDate}} at {{locationName}}.\n\nPlease review your gear checklist before class.'
);
const reminderId = insertTemplate(
  'Class reminder',
  '{{courseName}} reminder for {{classDate}}',
  'Hi {{firstName}},\n\nThis is a reminder that {{courseName}} meets at {{locationName}} on {{classDate}}.'
);
const followUpId = insertTemplate(
  'Post-class follow up',
  'Next steps after {{courseName}}',
  'Hi {{firstName}},\n\nThanks for joining {{courseName}}. Reply here with any gear or certification questions.'
);

insertCourseDefault(openWaterId, 'welcome', welcomeId, 1, -7 * 24 * 60);
insertCourseDefault(openWaterId, 'reminder', reminderId, 2, -24 * 60);
insertCourseDefault(openWaterId, 'follow_up', followUpId, 3, 24 * 60);

const startsOn = futureIsoDate(21);
const openWaterClassId = insertClassSession(openWaterId, quarryId, startsOn, futureIsoDate(22), '09:00', 'Blue Quarry', 'Seeded class with course-type default scheduled emails.');
insertClassSession(rescueId, poolId, futureIsoDate(35), futureIsoDate(35), '18:00', 'Community Pool', 'Seeded class without defaults so empty states are visible.');

const mayaId = insertContact('Maya', 'Patel', 'maya.patel@example.com', '555-0101', 'Needs rental BCD.', false);
const joId = insertContact('Jo', 'Kim', 'jo.kim@example.com', '555-0102', '', false);
const samId = insertContact('Sam', 'Rivera', 'sam.rivera@example.com', '', 'Do not email sample for visibility checks.', true);

insertEnrollment(openWaterClassId, mayaId);
insertEnrollment(openWaterClassId, joId);
insertEnrollment(openWaterClassId, samId);

const defaults = [
  { purpose: 'welcome', templateId: welcomeId, offset: -7 * 24 * 60 },
  { purpose: 'reminder', templateId: reminderId, offset: -24 * 60 },
  { purpose: 'follow_up', templateId: followUpId, offset: 24 * 60 }
];
for (const item of defaults) {
  const campaignId = insertCampaign(openWaterClassId, item.templateId, `${purposeLabel(item.purpose)} · ${templateName(item.templateId)}`, scheduledFor(startsOn, '09:00', item.offset), item.purpose, item.offset);
  for (const contactId of [mayaId, joId]) insertDelivery(campaignId, contactId);
}

insertCommunication({
  contactId: mayaId,
  source: 'direct',
  sourceId: '',
  originalRecipient: 'maya.patel@example.com',
  effectiveRecipient: 'test-inbox@example.com',
  testMode: true,
  subject: 'Gear sizing follow up',
  body: 'Thanks for sending your rental sizes.',
  status: 'sent',
  providerMessage: 'agent-dev-seed'
});
insertEmailTestAudit('maya.patel@example.com', 'test-inbox@example.com', 'Gear sizing follow up', 'Thanks for sending your rental sizes.', 'agent-dev-seed');

setSetting(seedMarker, 'true');

console.log(`Seeded agent dev database at ${dbPath}`);
console.log(`Login phrase: ${loginPhrase}`);
console.log('Created 3 default scheduled emails for visual inspection.');

function migrate() {
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
      provider_message text,
      error_message text,
      created_at text not null
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
  `);
}

function insertCourseType(name, description) {
  const id = newId();
  db.prepare('insert into course_types (id, name, description, created_at) values (?, ?, ?, ?)').run(id, name, description, now());
  return id;
}

function insertLocation(name, address, parkingNotes, meetingInstructions) {
  const id = newId();
  db.prepare(
    'insert into locations (id, name, address, parking_notes, meeting_instructions, created_at) values (?, ?, ?, ?, ?, ?)'
  ).run(id, name, address, parkingNotes, meetingInstructions, now());
  return id;
}

function insertTemplate(name, subject, body) {
  const id = newId();
  db.prepare('insert into templates (id, name, subject, body, created_at) values (?, ?, ?, ?, ?)').run(id, name, subject, body, now());
  return id;
}

function insertCourseDefault(courseTypeId, purpose, templateId, sortOrder, offset) {
  db.prepare(
    `insert into course_type_default_templates (
      course_type_id, purpose, label, template_id, sort_order, send_offset_minutes, created_at
    ) values (?, ?, '', ?, ?, ?, ?)`
  ).run(courseTypeId, purpose, templateId, sortOrder, offset, now());
}

function insertClassSession(courseTypeId, locationId, startsOn, endsOn, startTime, location, notes) {
  const id = newId();
  db.prepare(
    `insert into class_sessions (
      id, course_type_id, location_id, starts_on, ends_on, start_time, location, notes, created_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, courseTypeId, locationId, startsOn, endsOn, startTime, location, notes, now());
  return id;
}

function insertContact(firstName, lastName, email, phone, notes, doNotEmail) {
  const id = newId();
  db.prepare(
    'insert into contacts (id, first_name, last_name, email, phone, notes, do_not_email, created_at) values (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, firstName, lastName, email, phone, notes, doNotEmail ? 1 : 0, now());
  return id;
}

function insertEnrollment(classSessionId, contactId) {
  db.prepare('insert into enrollments (class_session_id, contact_id, created_at) values (?, ?, ?)').run(classSessionId, contactId, now());
}

function insertCampaign(classSessionId, templateId, name, scheduledAt, purpose, offset) {
  const id = newId();
  db.prepare(
    `insert into campaigns (
      id, class_session_id, template_id, name, scheduled_for, approved, source,
      default_purpose, default_label, send_offset_minutes, created_at
    ) values (?, ?, ?, ?, ?, 1, 'course_default', ?, '', ?, ?)`
  ).run(id, classSessionId, templateId, name, scheduledAt, purpose, offset, now());
  return id;
}

function insertDelivery(campaignId, contactId) {
  db.prepare('insert into campaign_deliveries (id, campaign_id, recipient_id, status, created_at) values (?, ?, ?, ?, ?)')
    .run(newId(), campaignId, contactId, 'pending', now());
}

function insertCommunication(input) {
  db.prepare(
    `insert into communications (
      id, contact_id, channel, source, source_id, original_recipient, effective_recipient,
      test_mode, subject, body, status, sent_at, provider_message, created_at
    ) values (?, ?, 'email', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    newId(),
    input.contactId,
    input.source,
    input.sourceId,
    input.originalRecipient,
    input.effectiveRecipient,
    input.testMode ? 1 : 0,
    input.subject,
    input.body,
    input.status,
    now(),
    input.providerMessage,
    now()
  );
}

function insertEmailTestAudit(originalRecipient, effectiveRecipient, subject, body, providerMessage) {
  db.prepare(
    'insert into email_test_audits (id, original_recipient, effective_recipient, subject, body, provider_message, created_at) values (?, ?, ?, ?, ?, ?, ?)'
  ).run(newId(), originalRecipient, effectiveRecipient, subject, body, providerMessage, now());
}

function templateName(templateId) {
  return String(db.prepare('select name from templates where id = ?').get(templateId).name);
}

function scheduledFor(startsOn, startTime, offsetMinutes) {
  const start = new Date(`${startsOn}T${startTime}:00`);
  start.setMinutes(start.getMinutes() + offsetMinutes);
  return `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}T${pad(start.getHours())}:${pad(start.getMinutes())}`;
}

function setSetting(key, value) {
  db.prepare(
    'insert into settings (key, value, updated_at) values (?, ?, ?) on conflict(key) do update set value = excluded.value, updated_at = excluded.updated_at'
  ).run(key, value, now());
}

function getSetting(key) {
  const row = db.prepare('select value from settings where key = ?').get(key);
  return row ? String(row.value) : '';
}

function futureIsoDate(daysFromToday) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  return date.toISOString().slice(0, 10);
}

function purposeLabel(purpose) {
  return purpose
    .split('_')
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}

function newId() {
  return randomBytes(12).toString('hex');
}

function now() {
  return new Date().toISOString();
}

function pad(value) {
  return String(value).padStart(2, '0');
}
