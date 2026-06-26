import type { DatabaseSync } from 'node:sqlite';
import { newId, now } from './ids';
import type {
  CommunicationHistoryItem,
  CommunicationHistoryPage,
  CommunicationHistoryPageInput,
  CommunicationInput,
  CommunicationReply,
  CommunicationReplyInput,
  RecordedCommunicationReply,
  EmailTestAuditInput,
  EmailTestAuditItem,
  EmailTestAuditPage,
  EmailTestAuditPageInput,
  Row
} from './types';

function mapCommunication(row: Row, replies: CommunicationReply[] = []): CommunicationHistoryItem {
  const acknowledgedAt = row.first_reply_at
    ? text(row.first_reply_at)
    : replies.reduce<string | undefined>((earliest, reply) => (!earliest || reply.receivedAt < earliest ? reply.receivedAt : earliest), undefined);
  return {
    id: text(row.id),
    contactId: text(row.contact_id),
    contactName: `${text(row.first_name)} ${text(row.last_name)}`.trim(),
    contactEmail: text(row.email),
    channel: text(row.channel) as CommunicationHistoryItem['channel'],
    source: text(row.source) as CommunicationHistoryItem['source'],
    sourceId: row.source_id ? text(row.source_id) : undefined,
    classSessionId: row.class_session_id ? text(row.class_session_id) : undefined,
    className: row.class_name ? text(row.class_name) : undefined,
    originalRecipient: text(row.original_recipient),
    effectiveRecipient: text(row.effective_recipient),
    testMode: Boolean(row.test_mode),
    subject: text(row.subject),
    body: text(row.body),
    status: text(row.status) as CommunicationHistoryItem['status'],
    sentAt: row.sent_at ? text(row.sent_at) : undefined,
    messageId: row.message_id ? text(row.message_id) : undefined,
    providerMessage: row.provider_message ? text(row.provider_message) : undefined,
    errorMessage: row.error_message ? text(row.error_message) : undefined,
    createdAt: text(row.created_at),
    replies,
    replyCount: Number(row.reply_count ?? replies.length),
    unreviewedReplyCount: Number(row.unreviewed_reply_count ?? replies.filter((reply) => !reply.reviewedAt).length),
    acknowledgedAt
  };
}

function mapReply(row: Row): CommunicationReply {
  return {
    id: text(row.id),
    communicationId: text(row.communication_id),
    providerKey: text(row.provider_key),
    providerMessageId: text(row.provider_message_id),
    fromName: text(row.from_name),
    fromEmail: text(row.from_email),
    subject: text(row.subject),
    textBody: text(row.text_body),
    htmlBody: text(row.html_body),
    snippet: text(row.snippet),
    receivedAt: text(row.received_at),
    reviewedAt: text(row.reviewed_at),
    createdAt: text(row.created_at)
  };
}

export function recordCommunication(db: DatabaseSync, input: CommunicationInput) {
  const id = newId();
  const timestamp = now();
  db.prepare(
    `insert into communications (
      id, contact_id, channel, source, source_id, original_recipient, effective_recipient, test_mode, subject, body, status,
      sent_at, message_id, provider_message, error_message, delivery_attempt_id, created_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
    input.deliveryAttemptId ?? null,
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

export function listEmailTestAuditsPage(db: DatabaseSync, input: EmailTestAuditPageInput = {}): EmailTestAuditPage {
  const limit = Math.min(Math.max(input.limit ?? 25, 1), 100);
  const offset = Math.max(input.offset ?? 0, 0);
  const search = input.search?.trim() ?? '';
  const where: string[] = [];
  const params: Array<string | number> = [];

  if (search) {
    const pattern = `%${search.toLowerCase()}%`;
    where.push(
      `(lower(original_recipient) like ?
        or lower(effective_recipient) like ?
        or lower(subject) like ?)`
    );
    params.push(pattern, pattern, pattern);
  }

  const whereSql = where.length ? `where ${where.join(' and ')}` : '';
  const totalRow = db.prepare(`select count(*) as value from email_test_audits ${whereSql}`).get(...params) as Row;
  const items = db
    .prepare(
      `select * from email_test_audits
       ${whereSql}
       order by created_at desc, rowid desc
       limit ? offset ?`
    )
    .all(...params, limit, offset)
    .map((row) => mapEmailTestAudit(row as Row));

  return {
    items,
    total: Number(totalRow.value ?? 0),
    limit,
    offset,
    search
  };
}

function getEmailTestAudit(db: DatabaseSync, id: string): EmailTestAuditItem {
  const row = db.prepare('select * from email_test_audits where id = ?').get(id) as Row | undefined;
  if (!row) throw new Error(`Email test audit not found: ${id}`);
  return mapEmailTestAudit(row);
}

function mapEmailTestAudit(row: Row): EmailTestAuditItem {
  return {
    id: text(row.id),
    originalRecipient: text(row.original_recipient),
    effectiveRecipient: text(row.effective_recipient),
    subject: text(row.subject),
    body: text(row.body),
    providerMessage: row.provider_message ? text(row.provider_message) : undefined,
    createdAt: text(row.created_at)
  };
}

export function listCommunications(db: DatabaseSync) {
  return withReplies(
    db,
    db
    .prepare(
      `select cm.*, c.first_name, c.last_name, c.email,
         cs.id as class_session_id, ct.name as class_name
       from communications cm
       join contacts c on c.id = cm.contact_id
       left join campaigns cp on cp.id = cm.source_id and cm.source = 'campaign'
       left join class_sessions cs on cs.id = cp.class_session_id
       left join course_types ct on ct.id = cs.course_type_id
       order by cm.created_at desc, cm.rowid desc`
    )
    .all()
      .map((row) => row as Row)
  );
}

export function listCommunicationsPage(db: DatabaseSync, input: CommunicationHistoryPageInput = {}): CommunicationHistoryPage {
  const limit = Math.min(Math.max(input.limit ?? 25, 1), 100);
  const offset = Math.max(input.offset ?? 0, 0);
  const search = input.search?.trim() ?? '';
  const contactId = input.contactId?.trim() ?? '';
  const sourceId = input.sourceId?.trim() ?? '';
  const replyStatus = input.replyStatus === 'needs_reply' ? input.replyStatus : '';
  const where: string[] = [];
  const params: Array<string | number> = [];

  if (contactId) {
    where.push('cm.contact_id = ?');
    params.push(contactId);
  }
  if (sourceId) {
    where.push('cm.source_id = ?');
    params.push(sourceId);
  }
  if (replyStatus === 'needs_reply') {
    where.push("exists (select 1 from communication_replies cr where cr.communication_id = cm.id and cr.reviewed_at = '')");
  }
  if (search) {
    const pattern = `%${search.toLowerCase()}%`;
    where.push(
      `(lower(c.first_name || ' ' || c.last_name) like ?
        or lower(c.email) like ?
        or lower(cm.subject) like ?)`
    );
    params.push(pattern, pattern, pattern);
  }

  const whereSql = where.length ? `where ${where.join(' and ')}` : '';
  const totalRow = db
    .prepare(
      `select count(*) as value
       from communications cm
       join contacts c on c.id = cm.contact_id
       ${whereSql}`
    )
    .get(...params) as Row;
  const rows = db
    .prepare(
      `select cm.id, cm.contact_id, cm.channel, cm.source, cm.source_id,
         cm.original_recipient, cm.effective_recipient, cm.test_mode, cm.subject,
         '' as body, cm.status, cm.sent_at, cm.message_id, cm.provider_message,
         cm.error_message, cm.created_at,
         coalesce(replies.reply_count, 0) as reply_count,
         coalesce(replies.unreviewed_reply_count, 0) as unreviewed_reply_count,
         replies.first_reply_at,
         cs.id as class_session_id, ct.name as class_name,
         c.first_name, c.last_name, c.email
       from communications cm
       join contacts c on c.id = cm.contact_id
       left join campaigns cp on cp.id = cm.source_id and cm.source = 'campaign'
       left join class_sessions cs on cs.id = cp.class_session_id
       left join course_types ct on ct.id = cs.course_type_id
       left join (
         select communication_id,
           count(*) as reply_count,
           sum(case when reviewed_at = '' then 1 else 0 end) as unreviewed_reply_count,
           min(received_at) as first_reply_at
         from communication_replies
         group by communication_id
       ) replies on replies.communication_id = cm.id
       ${whereSql}
       order by cm.created_at desc, cm.rowid desc
       limit ? offset ?`
    )
    .all(...params, limit, offset)
    .map((row) => row as Row);

  return {
    items: rows.map((row) => mapCommunication(row)),
    total: Number(totalRow.value ?? 0),
    limit,
    offset,
    search,
    contactId,
    sourceId,
    replyStatus
  };
}

export function listContactCommunications(db: DatabaseSync, contactId: string) {
  return withReplies(
    db,
    db
    .prepare(
      `select cm.*, c.first_name, c.last_name, c.email,
         cs.id as class_session_id, ct.name as class_name
       from communications cm
       join contacts c on c.id = cm.contact_id
       left join campaigns cp on cp.id = cm.source_id and cm.source = 'campaign'
       left join class_sessions cs on cs.id = cp.class_session_id
       left join course_types ct on ct.id = cs.course_type_id
       where cm.contact_id = ?
       order by cm.created_at desc, cm.rowid desc`
    )
    .all(contactId)
      .map((row) => row as Row)
  );
}

export function listRecentContactCommunications(db: DatabaseSync, contactId: string, limit = 3) {
  return withReplies(
    db,
    db
    .prepare(
      `select cm.*, c.first_name, c.last_name, c.email,
         cs.id as class_session_id, ct.name as class_name
       from communications cm
       join contacts c on c.id = cm.contact_id
       left join campaigns cp on cp.id = cm.source_id and cm.source = 'campaign'
       left join class_sessions cs on cs.id = cp.class_session_id
       left join course_types ct on ct.id = cs.course_type_id
       where cm.contact_id = ?
       order by cm.created_at desc, cm.rowid desc
       limit ?`
    )
    .all(contactId, Math.max(limit, 0))
      .map((row) => row as Row)
  );
}

export function listCommunicationMessageIds(db: DatabaseSync) {
  return db
    .prepare("select id, message_id from communications where message_id != '' and status in ('accepted', 'sent')")
    .all()
    .map((row) => ({ id: text((row as Row).id), messageId: text((row as Row).message_id) }));
}

export function getCommunication(db: DatabaseSync, id: string) {
  return listCommunicationById(db, id);
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
      `select cm.*, c.first_name, c.last_name, c.email,
         cs.id as class_session_id, ct.name as class_name
       from communications cm
       join contacts c on c.id = cm.contact_id
       left join campaigns cp on cp.id = cm.source_id and cm.source = 'campaign'
       left join class_sessions cs on cs.id = cp.class_session_id
       left join course_types ct on ct.id = cs.course_type_id
       where cm.id = ?`
    )
    .get(id) as Row | undefined;
  if (!row) throw new Error(`Communication not found: ${id}`);
  return mapCommunication(row, listRepliesForCommunication(db, id));
}

function withReplies(db: DatabaseSync, rows: Row[]) {
  const replies = rows.length ? listRepliesForCommunications(db, rows.map((row) => text(row.id))) : new Map<string, CommunicationReply[]>();
  return rows.map((row) => mapCommunication(row, replies.get(text(row.id)) ?? []));
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

function text(value: unknown) {
  return typeof value === 'string' ? value : '';
}
