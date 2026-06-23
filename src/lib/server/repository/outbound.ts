import type { DatabaseSync } from 'node:sqlite';
import { newId, now } from './ids';
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
  const expiresAt = new Date(Date.now() + 24 * 60 * 60_000).toISOString();
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
  const status = input.failed > 0 && input.sent > 0 ? 'partial' : input.failed > 0 ? 'failed' : 'accepted';
  const result = `Accepted ${input.sent}; failed ${input.failed}.`;
  db.prepare(
    `update send_operations
     set status = ?, result_summary = ?, updated_at = ?
     where id = ?`
  ).run(status, result, timestamp, operationId);
}

function mapSendOperation(row: Row): SendOperationState {
  return {
    id: String(row.id),
    status: String(row.status) as SendOperationState['status'],
    resultSummary: String(row.result_summary ?? ''),
    failureSummary: String(row.failure_summary ?? '')
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
