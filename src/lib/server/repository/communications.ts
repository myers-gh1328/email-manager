import type { DatabaseSync } from 'node:sqlite';
import { newId, now } from './ids';
import type {
  CommunicationHistoryItem,
  CommunicationInput,
  CommunicationReply,
  CommunicationReplyInput,
  RecordedCommunicationReply,
  EmailTestAuditInput,
  EmailTestAuditItem,
  Row
} from './types';

function mapCommunication(row: Row, replies: CommunicationReply[] = []): CommunicationHistoryItem {
  const acknowledgedAt = replies.reduce<string | undefined>(
    (earliest, reply) => (!earliest || reply.receivedAt < earliest ? reply.receivedAt : earliest),
    undefined
  );
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
    messageId: row.message_id ? String(row.message_id) : undefined,
    providerMessage: row.provider_message ? String(row.provider_message) : undefined,
    errorMessage: row.error_message ? String(row.error_message) : undefined,
    createdAt: String(row.created_at),
    replies,
    replyCount: replies.length,
    unreviewedReplyCount: replies.filter((reply) => !reply.reviewedAt).length,
    acknowledgedAt
  };
}

function mapReply(row: Row): CommunicationReply {
  return {
    id: String(row.id),
    communicationId: String(row.communication_id),
    providerKey: String(row.provider_key),
    providerMessageId: String(row.provider_message_id ?? ''),
    fromName: String(row.from_name ?? ''),
    fromEmail: String(row.from_email ?? ''),
    subject: String(row.subject ?? ''),
    textBody: String(row.text_body ?? ''),
    htmlBody: String(row.html_body ?? ''),
    snippet: String(row.snippet ?? ''),
    receivedAt: String(row.received_at),
    reviewedAt: String(row.reviewed_at ?? ''),
    createdAt: String(row.created_at)
  };
}

export function recordCommunication(db: DatabaseSync, input: CommunicationInput) {
  const id = newId();
  const timestamp = now();
  db.prepare(
    `insert into communications (
      id, contact_id, channel, source, source_id, original_recipient, effective_recipient, test_mode, subject, body, status,
      sent_at, message_id, provider_message, error_message, created_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
    input.messageId ?? '',
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
  return withReplies(
    db,
    db
    .prepare(
      `select cm.*, c.first_name, c.last_name, c.email
       from communications cm
       join contacts c on c.id = cm.contact_id
       order by cm.created_at desc, cm.rowid desc`
    )
    .all()
      .map((row) => row as Row)
  );
}

export function listContactCommunications(db: DatabaseSync, contactId: string) {
  return withReplies(
    db,
    db
    .prepare(
      `select cm.*, c.first_name, c.last_name, c.email
       from communications cm
       join contacts c on c.id = cm.contact_id
       where cm.contact_id = ?
       order by cm.created_at desc, cm.rowid desc`
    )
    .all(contactId)
      .map((row) => row as Row)
  );
}

export function listCommunicationMessageIds(db: DatabaseSync) {
  return db
    .prepare("select id, message_id from communications where message_id != '' and status in ('accepted', 'sent')")
    .all()
    .map((row) => ({ id: String((row as Row).id), messageId: String((row as Row).message_id) }));
}

export function recordCommunicationReply(db: DatabaseSync, input: CommunicationReplyInput): RecordedCommunicationReply {
  const existing = db.prepare('select * from communication_replies where provider_key = ?').get(input.providerKey) as Row | undefined;
  if (existing) return { ...mapReply(existing), created: false };
  const id = newId();
  const timestamp = now();
  const snippet = input.snippet ?? (input.textBody ?? '').trim().replace(/\s+/g, ' ').slice(0, 240);
  db.prepare(
    `insert into communication_replies (
      id, communication_id, provider_key, provider_message_id, from_name, from_email, subject,
      text_body, html_body, snippet, received_at, created_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.communicationId,
    input.providerKey,
    input.providerMessageId ?? '',
    input.fromName ?? '',
    input.fromEmail ?? '',
    input.subject ?? '',
    input.textBody ?? '',
    input.htmlBody ?? '',
    snippet,
    input.receivedAt,
    timestamp
  );
  return { ...getCommunicationReply(db, id), created: true };
}

export function markCommunicationReplyReviewed(db: DatabaseSync, id: string) {
  db.prepare("update communication_replies set reviewed_at = ? where id = ? and reviewed_at = ''").run(now(), id);
  return getCommunicationReply(db, id);
}

function getCommunicationReply(db: DatabaseSync, id: string) {
  const row = db.prepare('select * from communication_replies where id = ?').get(id) as Row | undefined;
  if (!row) throw new Error(`Communication reply not found: ${id}`);
  return mapReply(row);
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
  return mapCommunication(row, listRepliesForCommunication(db, id));
}

function withReplies(db: DatabaseSync, rows: Row[]) {
  const replies = rows.length ? listRepliesForCommunications(db, rows.map((row) => String(row.id))) : new Map<string, CommunicationReply[]>();
  return rows.map((row) => mapCommunication(row, replies.get(String(row.id)) ?? []));
}

function listRepliesForCommunication(db: DatabaseSync, communicationId: string) {
  return db
    .prepare('select * from communication_replies where communication_id = ? order by received_at desc, rowid desc')
    .all(communicationId)
    .map((row) => mapReply(row as Row));
}

function listRepliesForCommunications(db: DatabaseSync, communicationIds: string[]) {
  const placeholders = communicationIds.map(() => '?').join(', ');
  const rows = db
    .prepare(`select * from communication_replies where communication_id in (${placeholders}) order by received_at desc, rowid desc`)
    .all(...communicationIds)
    .map((row) => mapReply(row as Row));
  return rows.reduce((grouped, reply) => {
    const existing = grouped.get(reply.communicationId) ?? [];
    existing.push(reply);
    grouped.set(reply.communicationId, existing);
    return grouped;
  }, new Map<string, CommunicationReply[]>());
}
