import type { DatabaseSync } from 'node:sqlite';
import { newId, now } from './ids';
import type { CommunicationHistoryItem, CommunicationInput, EmailTestAuditInput, EmailTestAuditItem, Row } from './types';

function mapCommunication(row: Row): CommunicationHistoryItem {
  return {
    id: String(row.id),
    contactId: String(row.contact_id),
    contactName: `${String(row.first_name)} ${String(row.last_name)}`.trim(),
    contactEmail: String(row.email),
    channel: String(row.channel) as CommunicationHistoryItem['channel'],
    source: String(row.source) as CommunicationHistoryItem['source'],
    sourceId: row.source_id ? String(row.source_id) : undefined,
    originalRecipient: String(row.original_recipient ?? ''),
    effectiveRecipient: String(row.effective_recipient ?? ''),
    testMode: Boolean(row.test_mode),
    subject: String(row.subject),
    body: String(row.body),
    status: String(row.status) as CommunicationHistoryItem['status'],
    sentAt: row.sent_at ? String(row.sent_at) : undefined,
    providerMessage: row.provider_message ? String(row.provider_message) : undefined,
    errorMessage: row.error_message ? String(row.error_message) : undefined,
    createdAt: String(row.created_at)
  };
}

export function recordCommunication(db: DatabaseSync, input: CommunicationInput) {
  const id = newId();
  const timestamp = now();
  db.prepare(
    `insert into communications (
      id, contact_id, channel, source, source_id, original_recipient, effective_recipient, test_mode, subject, body, status,
      sent_at, provider_message, error_message, created_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.contactId,
    input.channel,
    input.source,
    input.sourceId ?? null,
    input.originalRecipient ?? '',
    input.effectiveRecipient ?? input.originalRecipient ?? '',
    input.testMode ? 1 : 0,
    input.subject,
    input.body,
    input.status,
    input.status === 'accepted' || input.status === 'sent' ? timestamp : null,
    input.providerMessage ?? null,
    input.errorMessage ?? null,
    timestamp
  );
  return listCommunicationById(db, id);
}

export function recordEmailTestAudit(db: DatabaseSync, input: EmailTestAuditInput) {
  const id = newId();
  const timestamp = now();
  db.prepare(
    `insert into email_test_audits (
      id, original_recipient, effective_recipient, subject, body, provider_message, created_at
    ) values (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, input.originalRecipient, input.effectiveRecipient, input.subject, input.body, input.providerMessage ?? null, timestamp);
  return getEmailTestAudit(db, id);
}

export function listEmailTestAudits(db: DatabaseSync): EmailTestAuditItem[] {
  return db
    .prepare('select * from email_test_audits order by created_at desc, rowid desc')
    .all()
    .map(mapEmailTestAudit);
}

function getEmailTestAudit(db: DatabaseSync, id: string): EmailTestAuditItem {
  const row = db.prepare('select * from email_test_audits where id = ?').get(id) as Row | undefined;
  if (!row) throw new Error(`Email test audit not found: ${id}`);
  return mapEmailTestAudit(row);
}

function mapEmailTestAudit(row: Row): EmailTestAuditItem {
  return {
    id: String(row.id),
    originalRecipient: String(row.original_recipient),
    effectiveRecipient: String(row.effective_recipient),
    subject: String(row.subject),
    body: String(row.body),
    providerMessage: row.provider_message ? String(row.provider_message) : undefined,
    createdAt: String(row.created_at)
  };
}

export function listCommunications(db: DatabaseSync) {
  return db
    .prepare(
      `select cm.*, c.first_name, c.last_name, c.email
       from communications cm
       join contacts c on c.id = cm.contact_id
       order by cm.created_at desc, cm.rowid desc`
    )
    .all()
    .map((row) => mapCommunication(row as Row));
}

export function listContactCommunications(db: DatabaseSync, contactId: string) {
  return db
    .prepare(
      `select cm.*, c.first_name, c.last_name, c.email
       from communications cm
       join contacts c on c.id = cm.contact_id
       where cm.contact_id = ?
       order by cm.created_at desc, cm.rowid desc`
    )
    .all(contactId)
    .map((row) => mapCommunication(row as Row));
}

function listCommunicationById(db: DatabaseSync, id: string) {
  const row = db
    .prepare(
      `select cm.*, c.first_name, c.last_name, c.email
       from communications cm
       join contacts c on c.id = cm.contact_id
       where cm.id = ?`
    )
    .get(id) as Row | undefined;
  if (!row) throw new Error(`Communication not found: ${id}`);
  return mapCommunication(row);
}
