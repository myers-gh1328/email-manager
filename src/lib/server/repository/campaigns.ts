import type { DatabaseSync } from 'node:sqlite';
import { createDeliveryPlan, type AttemptSource, type CampaignDelivery, type FailureKind } from '../scheduler';
import { getClassSession, listEnrollments } from './contacts';
import { newId, now } from './ids';
import { mapCampaign, mapDelivery, rowString } from './mappers';
import { getTemplate } from './templates';
import type { CampaignInput, CampaignPage, CampaignPageInput, Row } from './types';

export function createCampaign(db: DatabaseSync, input: CampaignInput) {
  const id = newId();
  db.prepare(
    `insert into campaigns (
      id, class_session_id, template_id, name, scheduled_for, approved,
      source, default_purpose, default_label, send_offset_minutes, created_at
    )
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.classSessionId,
    input.templateId,
    input.name.trim(),
    input.scheduledFor,
    input.approved ? 1 : 0,
    input.source ?? 'manual',
    input.defaultPurpose?.trim() ?? '',
    input.defaultLabel?.trim() ?? '',
    input.sendOffsetMinutes ?? 0,
    now()
  );
  return getCampaign(db, id);
}

export function listCampaigns(db: DatabaseSync) {
  return db
    .prepare(
      `select c.*, t.name as template_name, ct.name as course_name, cs.starts_on, cs.ends_on, cs.start_time
       from campaigns c
       join templates t on t.id = c.template_id
       join class_sessions cs on cs.id = c.class_session_id
       join course_types ct on ct.id = cs.course_type_id
       order by c.scheduled_for desc`
    )
    .all()
    .map(mapCampaign);
}

export function listCampaignsPage(db: DatabaseSync, input: CampaignPageInput = {}): CampaignPage {
  const limit = Math.min(Math.max(input.limit ?? 25, 1), 100);
  const offset = Math.max(input.offset ?? 0, 0);
  const search = input.search?.trim() ?? '';
  const status = ['draft', 'ready', 'needs_review', 'sent'].includes(input.status ?? '') ? input.status ?? '' : '';
  const where: string[] = [];
  const params: Array<string | number> = [];

  if (search) {
    const pattern = `%${search.toLowerCase()}%`;
    where.push(
      `(lower(c.name) like ?
        or lower(t.name) like ?
        or lower(ct.name) like ?)`
    );
    params.push(pattern, pattern, pattern);
  }
  if (status === 'draft') {
    where.push('c.approved = 0');
  }
  if (status === 'ready') {
    where.push('c.approved = 1');
  }
  if (status === 'needs_review') {
    where.push(
      "exists (select 1 from campaign_deliveries d where d.campaign_id = c.id and d.status in ('failed', 'retry_scheduled', 'needs_attention'))"
    );
  }
  if (status === 'sent') {
    where.push(
      "exists (select 1 from campaign_deliveries d where d.campaign_id = c.id and d.status = 'sent') and not exists (select 1 from campaign_deliveries d where d.campaign_id = c.id and d.status != 'sent')"
    );
  }

  const fromSql = `
    from campaigns c
    join templates t on t.id = c.template_id
    join class_sessions cs on cs.id = c.class_session_id
    join course_types ct on ct.id = cs.course_type_id
  `;
  const whereSql = where.length ? `where ${where.join(' and ')}` : '';
  const totalRow = db.prepare(`select count(*) as value ${fromSql} ${whereSql}`).get(...params) as Row;
  const items = db
    .prepare(
      `select c.*, t.name as template_name, ct.name as course_name, cs.starts_on, cs.ends_on, cs.start_time
       ${fromSql}
       ${whereSql}
       order by c.scheduled_for desc
       limit ? offset ?`
    )
    .all(...params, limit, offset)
    .map((row) => mapCampaign(row as Row));

  return {
    items,
    total: Number(totalRow.value ?? 0),
    limit,
    offset,
    search,
    status
  };
}

export function countReadyScheduledEmailsDue(db: DatabaseSync, nowIso: string) {
  const row = db
    .prepare("select count(*) as value from campaigns where approved = 1 and scheduled_for <= ?")
    .get(nowIso) as Row;
  return Number(row.value ?? 0);
}

export function getNextReadyScheduledEmail(db: DatabaseSync, nowIso: string) {
  const row = db
    .prepare(
      `select c.*, t.name as template_name, ct.name as course_name, cs.starts_on, cs.ends_on, cs.start_time
       from campaigns c
       join templates t on t.id = c.template_id
       join class_sessions cs on cs.id = c.class_session_id
       join course_types ct on ct.id = cs.course_type_id
       where c.approved = 1 and c.scheduled_for >= ?
       order by c.scheduled_for asc
       limit 1`
    )
    .get(nowIso) as Row | undefined;
  return row ? mapCampaign(row) : undefined;
}

export function listCampaignsForClassSession(db: DatabaseSync, classSessionId: string) {
  return db
    .prepare(
      `select c.*, t.name as template_name, ct.name as course_name, cs.starts_on, cs.ends_on, cs.start_time
       from campaigns c
       join templates t on t.id = c.template_id
       join class_sessions cs on cs.id = c.class_session_id
       join course_types ct on ct.id = cs.course_type_id
       where c.class_session_id = ?
       order by c.scheduled_for asc`
    )
    .all(classSessionId)
    .map((row) => {
      const campaign = mapCampaign(row);
      const counts = deliveryCounts(db, campaign.id);
      return {
        ...campaign,
        pendingCount: counts.pending,
        sentCount: counts.sent,
        failedCount: counts.failed,
        recipientCount: counts.pending + counts.sent + counts.failed
      };
    });
}

export function getCampaign(db: DatabaseSync, id: string) {
  const row = db
    .prepare(
      `select c.*, t.name as template_name, ct.name as course_name, cs.starts_on, cs.ends_on, cs.start_time
       from campaigns c
       join templates t on t.id = c.template_id
       join class_sessions cs on cs.id = c.class_session_id
       join course_types ct on ct.id = cs.course_type_id
       where c.id = ?`
    )
    .get(id) as Row | undefined;
  if (!row) throw new Error(`Campaign not found: ${id}`);
  return mapCampaign(row);
}

export function updateCampaign(db: DatabaseSync, id: string, input: { name: string; scheduledFor: string; approved: boolean }) {
  db.prepare('update campaigns set name = ?, scheduled_for = ?, approved = ? where id = ?')
    .run(input.name.trim(), input.scheduledFor, input.approved ? 1 : 0, id);
  return getCampaign(db, id);
}

export function updateDefaultCampaign(
  db: DatabaseSync,
  id: string,
  input: {
    templateId: string;
    name: string;
    scheduledFor: string;
    defaultPurpose: string;
    defaultLabel: string;
    sendOffsetMinutes: number;
  }
) {
  db.prepare(
    `update campaigns
     set template_id = ?, name = ?, scheduled_for = ?, approved = 1, source = 'course_default',
       default_purpose = ?, default_label = ?, send_offset_minutes = ?
     where id = ?`
  ).run(input.templateId, input.name.trim(), input.scheduledFor, input.defaultPurpose, input.defaultLabel, input.sendOffsetMinutes, id);
  return getCampaign(db, id);
}

export function hasSentDeliveries(db: DatabaseSync, campaignId: string) {
  const sent = db
    .prepare("select count(*) as value from campaign_deliveries where campaign_id = ? and status = 'sent'")
    .get(campaignId) as Row;
  return Number(sent.value) > 0;
}

export function deleteCampaign(db: DatabaseSync, id: string) {
  if (hasSentDeliveries(db, id)) throw new Error('Campaign has sent deliveries and cannot be deleted.');
  db.prepare('delete from campaigns where id = ?').run(id);
}

export function getCampaignDetail(db: DatabaseSync, id: string) {
  const campaign = getCampaign(db, id);
  const classSession = getClassSession(db, campaign.classSessionId);
  const template = getTemplate(db, campaign.templateId);
  const deliveries = new Map(listDeliveries(db, id).map((delivery) => [delivery.recipientId, delivery]));
  const recipients = listEnrollments(db, campaign.classSessionId)
    .map((contact) => {
      const delivery = deliveries.get(contact.id);
      return {
        contactId: contact.id,
        name: `${contact.firstName} ${contact.lastName}`.trim(),
        email: contact.email,
        doNotEmail: contact.doNotEmail,
        status: contact.doNotEmail ? 'skipped' : (delivery?.status ?? 'not planned'),
        reason: contact.doNotEmail ? 'Do not email' : delivery?.errorMessage,
        delivery
      };
    })
    .sort((a, b) => recipientStatusRank(a.status) - recipientStatusRank(b.status) || a.name.localeCompare(b.name));

  return { campaign, classSession, template, recipients };
}

function recipientStatusRank(status: string) {
  return ['skipped', 'failed', 'pending', 'not planned', 'sent'].indexOf(status);
}

function deliveryCounts(db: DatabaseSync, campaignId: string) {
  const initialCounts: { pending: number; sent: number; failed: number } = { pending: 0, sent: 0, failed: 0 };
  const rows = db
    .prepare(
      `select status, count(*) as value
       from campaign_deliveries
       where campaign_id = ?
       group by status`
    )
    .all(campaignId) as Row[];
  return rows.reduce<{ pending: number; sent: number; failed: number }>(
    (counts, row) => {
      const status = rowString(row.status);
      const value = Number(row.value);
      if (status === 'pending') counts.pending = value;
      if (status === 'sent') counts.sent = value;
      if (status === 'failed') counts.failed = value;
      return counts;
    },
    initialCounts
  );
}

export function ensurePendingDeliveries(db: DatabaseSync, campaignId: string): CampaignDelivery[] {
  const campaign = getCampaign(db, campaignId);
  const enrolledRecipients = listEnrollments(db, campaign.classSessionId).filter((contact) => !contact.doNotEmail);
  const existing = listDeliveries(db, campaignId);
  const existingRecipientIds = new Set(existing.map((delivery) => delivery.recipientId));
  const recipients =
    campaign.source !== 'course_default' && existing.length > 0
      ? enrolledRecipients.filter((contact) => existingRecipientIds.has(contact.id))
      : enrolledRecipients;
  const pending = createDeliveryPlan({
    campaignId,
    recipientIds: recipients.map((contact) => contact.id),
    existingDeliveries: existing
  });

  for (const delivery of pending) {
    db.prepare(
      `insert into campaign_deliveries (id, campaign_id, recipient_id, status, created_at)
       values (?, ?, ?, ?, ?)
       on conflict(id) do nothing`
    ).run(delivery.id, delivery.campaignId, delivery.recipientId, delivery.status, delivery.createdAt);
  }

  return listPendingDeliveries(db, campaignId);
}

export function listDeliveries(db: DatabaseSync, campaignId: string): CampaignDelivery[] {
  return db
    .prepare('select * from campaign_deliveries where campaign_id = ? order by created_at')
    .all(campaignId)
    .map(mapDelivery);
}

export function listPendingDeliveries(db: DatabaseSync, campaignId: string): CampaignDelivery[] {
  return db
    .prepare(
      `select d.*
       from campaign_deliveries d
       join contacts c on c.id = d.recipient_id
       where d.campaign_id = ? and d.status = 'pending' and c.do_not_email = 0
       order by d.created_at`
    )
    .all(campaignId)
    .map(mapDelivery);
}

export function claimNextPendingDelivery(db: DatabaseSync, campaignId: string): CampaignDelivery | undefined {
  const row = db
    .prepare(
      `update campaign_deliveries
       set status = 'sending', error_message = null
       where id = (
         select d.id
         from campaign_deliveries d
         join contacts c on c.id = d.recipient_id
         where d.campaign_id = ? and d.status = 'pending' and c.do_not_email = 0
         order by d.created_at
         limit 1
       )
       returning *`
    )
    .get(campaignId) as Row | undefined;
  return row ? mapDelivery(row) : undefined;
}

export function claimNextEligibleDelivery(
  db: DatabaseSync,
  campaignId: string,
  input: { source: AttemptSource; subject: string; body: string; nowIso?: string; claimTimeoutMinutes?: number }
): CampaignDelivery | undefined {
  recoverExpiredSendingDeliveries(db);
  const timestamp = input.nowIso ?? now();
  const claimExpiresAt = new Date(new Date(timestamp).getTime() + (input.claimTimeoutMinutes ?? 15) * 60_000).toISOString();
  const includeScheduledRetries = input.source === 'manual' || input.source === 'agent';
  return transaction(db, () => {
    const row = db
      .prepare(
        `update campaign_deliveries
         set status = 'sending',
           attempt_count = attempt_count + 1,
           last_attempt_at = ?,
           claim_expires_at = ?,
           error_message = null
         where id = (
           select d.id
           from campaign_deliveries d
           join contacts c on c.id = d.recipient_id
           where d.campaign_id = ? and c.do_not_email = 0 and (
             d.status = 'pending'
             or (? = 1 and d.status = 'retry_scheduled' and d.failure_kind = 'transient' and d.next_attempt_at <= ? and d.attempt_count <= d.retry_policy_max_auto_retries)
           )
           order by coalesce(d.next_attempt_at, d.created_at), d.created_at
           limit 1
         )
         returning *`
      )
      .get(timestamp, claimExpiresAt, campaignId, includeScheduledRetries ? 1 : 0, timestamp) as Row | undefined;
    if (!row) return undefined;
    const attemptId = newId();
    const attemptNumber = Number(row.attempt_count);
    db.prepare(
      `insert into delivery_attempts (
        id, delivery_id, attempt_number, source, status, claimed_at, claim_expires_at, subject, body,
        retry_policy_max_auto_retries, retry_policy_backoff
      ) values (?, ?, ?, ?, 'claimed', ?, ?, ?, ?, ?, ?)`
    ).run(
      attemptId,
      rowString(row.id),
      attemptNumber,
      input.source,
      timestamp,
      claimExpiresAt,
      input.subject,
      input.body,
      Number(row.retry_policy_max_auto_retries ?? 3),
      rowString(row.retry_policy_backoff) || '[300,1800,7200]'
    );
    return mapDelivery({ ...row, attempt_id: attemptId, attempt_number: attemptNumber, claim_expires_at: claimExpiresAt });
  });
}

export function markDeliverySent(db: DatabaseSync, deliveryId: string, providerMessage: string) {
  db.prepare(
    `update campaign_deliveries
     set status = 'sent', sent_at = ?, provider_message = ?, error_message = null
     where id = ? and status != 'sent'`
  ).run(now(), providerMessage, deliveryId);
}

export function markDeliveryFailed(db: DatabaseSync, deliveryId: string, errorMessage: string) {
  db.prepare(
    `update campaign_deliveries
     set status = 'failed', error_message = ?
     where id = ? and status != 'sent'`
  ).run(errorMessage, deliveryId);
}

export function finalizeDeliveryAttemptAccepted(db: DatabaseSync, input: { deliveryId: string; attemptId: string; providerMessage: string }) {
  const timestamp = now();
  transaction(db, () => {
    db.prepare(
      `update delivery_attempts
       set status = 'accepted', finalized_at = ?, provider_message = ?
       where id = ? and delivery_id = ?`
    ).run(timestamp, input.providerMessage, input.attemptId, input.deliveryId);
    db.prepare(
      `update campaign_deliveries
       set status = 'sent', sent_at = ?, provider_message = ?, error_message = null,
         next_attempt_at = null, claim_expires_at = null, failure_kind = '', failure_summary = ''
       where id = ? and status != 'sent'`
    ).run(timestamp, input.providerMessage, input.deliveryId);
  });
}

export function updateDeliveryAttemptSnapshot(db: DatabaseSync, input: { attemptId: string; subject: string; body: string }) {
  db.prepare('update delivery_attempts set subject = ?, body = ? where id = ? and status = ?').run(input.subject, input.body, input.attemptId, 'claimed');
}

export function finalizeDeliveryAttemptFailed(
  db: DatabaseSync,
  input: { deliveryId: string; attemptId: string; failureKind: Exclude<FailureKind, ''>; failureSummary: string; retryable: boolean }
) {
  const timestamp = now();
  const delivery = db.prepare('select * from campaign_deliveries where id = ?').get(input.deliveryId) as Row | undefined;
  if (!delivery) throw new Error(`Campaign delivery not found: ${input.deliveryId}`);
  const attemptCount = Number(delivery.attempt_count ?? 1);
  const maxRetries = Number(delivery.retry_policy_max_auto_retries ?? 3);
  const retryable = input.retryable && input.failureKind === 'transient' && attemptCount <= maxRetries;
  const nextAttemptAt = retryable ? nextRetryTime(timestamp, rowString(delivery.retry_policy_backoff) || '[300,1800,7200]', attemptCount) : null;
  transaction(db, () => {
    db.prepare(
      `update delivery_attempts
       set status = ?, finalized_at = ?, failure_kind = ?, failure_summary = ?
       where id = ? and delivery_id = ?`
    ).run(input.failureKind === 'unknown' ? 'unknown' : 'failed', timestamp, input.failureKind, input.failureSummary, input.attemptId, input.deliveryId);
    db.prepare(
      `update campaign_deliveries
       set status = ?, error_message = ?, failure_kind = ?, failure_summary = ?, next_attempt_at = ?,
         claim_expires_at = null
       where id = ? and status != 'sent'`
    ).run(retryable ? 'retry_scheduled' : 'needs_attention', input.failureSummary, input.failureKind, input.failureSummary, nextAttemptAt, input.deliveryId);
  });
}

export function markAcceptedAttemptAuditIncomplete(db: DatabaseSync, input: { deliveryId: string; attemptId?: string; summary: string }) {
  const timestamp = now();
  transaction(db, () => {
    if (input.attemptId) {
      db.prepare(
        `update delivery_attempts set status = 'accepted_audit_incomplete', finalized_at = ?, failure_summary = ? where id = ? and delivery_id = ?`
      ).run(timestamp, input.summary, input.attemptId, input.deliveryId);
    }
    db.prepare(
      `update campaign_deliveries
       set status = 'sent', sent_at = coalesce(sent_at, ?), needs_audit_repair = 1, failure_kind = 'unknown',
         failure_summary = ?, next_attempt_at = null, claim_expires_at = null
       where id = ? and status != 'sent'`
    ).run(timestamp, input.summary, input.deliveryId);
  });
}

export function recoverExpiredSendingDeliveries(db: DatabaseSync, nowIso = now(), limit = 25) {
  const rows = db
    .prepare(
      `select * from campaign_deliveries
       where status = 'sending' and claim_expires_at is not null and claim_expires_at <= ?
       order by claim_expires_at
       limit ?`
    )
    .all(nowIso, limit) as Row[];
  for (const row of rows) {
    transaction(db, () => {
      db.prepare(
        `update delivery_attempts
         set status = 'unknown', finalized_at = ?, failure_kind = 'unknown',
           failure_summary = 'Send status is unknown because the app stopped during delivery.'
         where delivery_id = ? and status = 'claimed'`
      ).run(nowIso, rowString(row.id));
      db.prepare(
        `update campaign_deliveries
         set status = 'needs_attention', failure_kind = 'unknown',
           failure_summary = 'Send status is unknown because the app stopped during delivery.',
           error_message = 'Send status is unknown because the app stopped during delivery.',
           next_attempt_at = null, claim_expires_at = null
         where id = ? and status = 'sending'`
      ).run(rowString(row.id));
    });
  }
  return rows.length;
}

export function retryCampaignDeliveries(db: DatabaseSync, campaignId: string, recipientIds: string[]) {
  const placeholders = recipientIds.map(() => '?').join(', ');
  if (!placeholders) return 0;
  const result = db
    .prepare(
      `update campaign_deliveries
       set status = 'pending', next_attempt_at = null, claim_expires_at = null, error_message = null
       where campaign_id = ? and recipient_id in (${placeholders}) and status in ('failed', 'retry_scheduled', 'needs_attention')`
    )
    .run(campaignId, ...recipientIds);
  return Number(result.changes);
}

export function countFailedCampaignDeliveriesBetween(db: DatabaseSync, startIso: string, endIso: string) {
  const row = db
    .prepare(
      `select count(*) as value
       from campaign_deliveries
       where status in ('failed', 'retry_scheduled', 'needs_attention')
         and coalesce(last_attempt_at, created_at) >= ?
         and coalesce(last_attempt_at, created_at) < ?`
    )
    .get(startIso, endIso) as Row;
  return Number(row.value ?? 0);
}

export function retryFailedCampaignDeliveriesBetween(db: DatabaseSync, startIso: string, endIso: string) {
  const result = db
    .prepare(
      `update campaign_deliveries
       set status = 'pending', next_attempt_at = null, claim_expires_at = null, error_message = null
       where status in ('failed', 'retry_scheduled', 'needs_attention')
         and coalesce(last_attempt_at, created_at) >= ?
         and coalesce(last_attempt_at, created_at) < ?`
    )
    .run(startIso, endIso);
  return Number(result.changes);
}

function nextRetryTime(timestamp: string, backoffJson: string, attemptCount: number) {
  let backoff = [300, 1800, 7200];
  try {
    const parsed = JSON.parse(backoffJson);
    if (Array.isArray(parsed) && parsed.every((value) => Number.isFinite(Number(value)))) backoff = parsed.map(Number);
  } catch {
    backoff = [300, 1800, 7200];
  }
  const seconds = backoff[Math.max(0, Math.min(backoff.length - 1, attemptCount - 1))] ?? 7200;
  return new Date(new Date(timestamp).getTime() + seconds * 1000).toISOString();
}

function transaction<T>(db: DatabaseSync, work: () => T): T {
  db.exec('begin immediate');
  try {
    const result = work();
    db.exec('commit');
    return result;
  } catch (error) {
    db.exec('rollback');
    throw error;
  }
}
