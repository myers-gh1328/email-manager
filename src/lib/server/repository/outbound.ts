import type { DatabaseSync } from 'node:sqlite';
import { OutboundGateError } from '../outbound-errors';
import { newId, now } from './ids';
import { rowString } from './mappers';
import type { Row } from './types';

export interface SendOperationInput {
  operationType: 'direct_email';
  sendOperationId: string;
  idempotencyKey: string;
  requestHash: string;
  recipients: Array<{ contactId: string; email: string }>;
}

export interface SendOperationState {
  id: string;
  status: 'pending' | 'sending' | 'accepted' | 'failed' | 'partial' | 'needs_attention';
  resultSummary: string;
  failureSummary: string;
}

export function beginSendOperation(db: DatabaseSync, input: SendOperationInput): SendOperationState {
  const existing = getSendOperation(db, input.sendOperationId);
  if (existing) return existing;
  const id = newId();
  const timestamp = now();
  const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();
  transaction(db, () => {
    db.prepare(
      `insert into send_operations (
        id, operation_type, send_operation_id, idempotency_key, status, request_hash,
        created_at, updated_at, expires_at
      ) values (?, ?, ?, ?, 'sending', ?, ?, ?, ?)`
    ).run(id, input.operationType, input.sendOperationId, input.idempotencyKey, input.requestHash, timestamp, timestamp, expiresAt);
    for (const recipient of input.recipients) {
      db.prepare(
        `insert into send_operation_recipients (operation_id, contact_id, email, status)
         values (?, ?, ?, 'pending')`
      ).run(id, recipient.contactId, recipient.email);
    }
  });
  return getSendOperation(db, input.sendOperationId)!;
}

export function getSendOperation(db: DatabaseSync, sendOperationId: string): SendOperationState | undefined {
  const row = db.prepare('select * from send_operations where send_operation_id = ?').get(sendOperationId) as Row | undefined;
  if (row && rowString(row.status) === 'sending' && rowString(row.expires_at) <= now()) {
    db.prepare(
      `update send_operations
       set status = 'needs_attention',
         failure_summary = 'This send was interrupted before it finished. It needs attention before sending again.',
         updated_at = ?
       where id = ? and status = 'sending'`
    ).run(now(), rowString(row.id));
    return getSendOperation(db, sendOperationId);
  }
  return row ? mapSendOperation(row) : undefined;
}

export function markSendOperationRecipient(
  db: DatabaseSync,
  operationId: string,
  contactId: string,
  input: { status: 'accepted' | 'failed' | 'unknown'; providerMessage?: string; failureKind?: string; failureSummary?: string }
) {
  db.prepare(
    `update send_operation_recipients
     set status = ?, provider_message = ?, failure_kind = ?, failure_summary = ?
     where operation_id = ? and contact_id = ? and status in ('pending', 'sending')`
  ).run(input.status, input.providerMessage ?? '', input.failureKind ?? '', input.failureSummary ?? '', operationId, contactId);
}

export function finishSendOperation(db: DatabaseSync, operationId: string, input: { sent: number; failed: number }) {
  const timestamp = now();
  let status: SendOperationState['status'] = 'accepted';
  if (input.failed > 0 && input.sent > 0) {
    status = 'partial';
  } else if (input.failed > 0) {
    status = 'failed';
  }
  const result = `Accepted ${input.sent}; failed ${input.failed}.`;
  db.prepare(
    `update send_operations
     set status = ?, result_summary = ?, updated_at = ?
     where id = ?`
  ).run(status, result, timestamp, operationId);
}

export function reserveOutboundRateEvent(
  db: DatabaseSync,
  input: { maxPerMinute: number; maxPerHour: number; nowIso?: string }
) {
  const timestamp = input.nowIso ?? now();
  const minuteCutoff = new Date(new Date(timestamp).getTime() - 60_000).toISOString();
  const hourCutoff = new Date(new Date(timestamp).getTime() - 3_600_000).toISOString();
  transaction(db, () => {
    db.prepare('delete from outbound_rate_events where occurred_at <= ?').run(hourCutoff);
    const minute = db.prepare('select count(*) as value from outbound_rate_events where occurred_at > ?').get(minuteCutoff) as Row;
    const hour = db.prepare('select count(*) as value from outbound_rate_events where occurred_at > ?').get(hourCutoff) as Row;
    if (Number(minute.value) >= input.maxPerMinute) {
      throw new OutboundGateError('Outbound rate limit reached. Try again in a minute.', 'rate_limited', 60);
    }
    if (Number(hour.value) >= input.maxPerHour) {
      throw new OutboundGateError('Outbound hourly limit reached. Try again later.', 'rate_limited', 3600);
    }
    db.prepare('insert into outbound_rate_events (id, occurred_at) values (?, ?)').run(newId(), timestamp);
  });
}

function mapSendOperation(row: Row): SendOperationState {
  return {
    id: rowString(row.id),
    status: rowString(row.status) as SendOperationState['status'],
    resultSummary: rowString(row.result_summary),
    failureSummary: rowString(row.failure_summary)
  };
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
