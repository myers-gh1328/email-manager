import type { DatabaseSync } from 'node:sqlite';
import { newId, now } from './ids';
import { rowString } from './mappers';
import type { AgentApproval, AgentApprovalInput, AgentAuditEvent, AgentAuditEventInput, Row } from './types';

function prefixedId(prefix: 'appr' | 'audit') {
  return `${prefix}_${newId()}`;
}

function mapAgentApproval(row: Row): AgentApproval {
  return {
    id: rowString(row.id),
    toolName: rowString(row.tool_name),
    risk: rowString(row.risk) as AgentApproval['risk'],
    summary: rowString(row.summary),
    operationJson: rowString(row.operation_json),
    reviewJson: rowString(row.review_json),
    confirmationText: rowString(row.confirmation_text),
    status: rowString(row.status) as AgentApproval['status'],
    createdAt: rowString(row.created_at),
    expiresAt: rowString(row.expires_at),
    committedAt: rowString(row.committed_at),
    resultJson: rowString(row.result_json)
  };
}

function mapAgentAuditEvent(row: Row): AgentAuditEvent {
  return {
    id: rowString(row.id),
    toolName: rowString(row.tool_name),
    risk: rowString(row.risk) as AgentAuditEvent['risk'],
    action: rowString(row.action) as AgentAuditEvent['action'],
    summary: rowString(row.summary),
    entityType: rowString(row.entity_type),
    entityId: rowString(row.entity_id),
    status: rowString(row.status),
    createdAt: rowString(row.created_at)
  };
}

export function createAgentApproval(db: DatabaseSync, input: AgentApprovalInput) {
  const approvalId = prefixedId('appr');
  const timestamp = now();
  db.prepare(
    `insert into agent_approvals (
      id, tool_name, risk, summary, operation_json, review_json, confirmation_text, status, created_at, expires_at
    ) values (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`
  ).run(
    approvalId,
    input.toolName,
    input.risk,
    input.summary,
    input.operationJson,
    input.reviewJson,
    input.confirmationText,
    timestamp,
    input.expiresAt
  );
  const approval = getAgentApproval(db, approvalId);
  if (!approval) throw new Error(`Agent approval not found after insert: ${approvalId}`);
  return approval;
}

export function getAgentApproval(db: DatabaseSync, approvalId: string) {
  const row = db.prepare('select * from agent_approvals where id = ?').get(approvalId) as Row | undefined;
  return row ? mapAgentApproval(row) : undefined;
}

export function listPendingAgentApprovals(db: DatabaseSync) {
  return db
    .prepare("select * from agent_approvals where status = 'pending' order by expires_at asc, created_at asc, rowid asc")
    .all()
    .map((row) => mapAgentApproval(row as Row));
}

export function updateAgentApprovalConfirmationText(db: DatabaseSync, approvalId: string, confirmationText: string) {
  const result = db
    .prepare(
      `update agent_approvals
       set confirmation_text = ?
       where id = ? and status = 'pending'`
    )
    .run(confirmationText, approvalId);
  return Number(result.changes ?? 0);
}

export function markAgentApprovalCommitting(db: DatabaseSync, approvalId: string) {
  const result = db.prepare(
    `update agent_approvals
     set status = 'committing'
     where id = ? and status = 'pending'`
  ).run(approvalId);
  return Number(result.changes ?? 0);
}

export function markAgentApprovalCommitted(db: DatabaseSync, approvalId: string, resultJson: string) {
  const result = db.prepare(
    `update agent_approvals
     set status = 'committed', committed_at = ?, result_json = ?
     where id = ? and status = 'committing'`
  ).run(now(), resultJson, approvalId);
  return Number(result.changes ?? 0);
}

export function markAgentApprovalFailed(db: DatabaseSync, approvalId: string, resultJson: string) {
  const result = db.prepare(
    `update agent_approvals
     set status = 'failed', result_json = ?
     where id = ? and status = 'committing'`
  ).run(resultJson, approvalId);
  return Number(result.changes ?? 0);
}

export function markAgentApprovalRejected(db: DatabaseSync, approvalId: string) {
  const result = db.prepare(
    `update agent_approvals
     set status = 'rejected'
     where id = ? and status = 'pending'`
  ).run(approvalId);
  return Number(result.changes ?? 0);
}

export function expireAgentApprovals(db: DatabaseSync, nowIso: string) {
  const result = db
    .prepare(
      `update agent_approvals
       set status = 'expired'
       where status = 'pending' and expires_at <= ?`
    )
    .run(nowIso);
  return Number(result.changes ?? 0);
}

export function recordAgentAuditEvent(db: DatabaseSync, input: AgentAuditEventInput) {
  const eventId = prefixedId('audit');
  const timestamp = now();
  db.prepare(
    `insert into agent_audit_events (
      id, tool_name, risk, action, summary, entity_type, entity_id, status, created_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    eventId,
    input.toolName,
    input.risk,
    input.action,
    input.summary,
    input.entityType ?? '',
    input.entityId ?? '',
    input.status,
    timestamp
  );
  const event = getAgentAuditEvent(db, eventId);
  if (!event) throw new Error(`Agent audit event not found after insert: ${eventId}`);
  return event;
}

export function listAgentAuditEvents(db: DatabaseSync, input: { limit?: number; cursor?: string } = {}) {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
  const queryLimit = limit + 1;
  const cursorRow = input.cursor ? getAgentAuditEventRow(db, input.cursor) : undefined;
  if (input.cursor && !cursorRow) {
    return { items: [], nextCursor: '' };
  }
  const rows = cursorRow
    ? db
        .prepare(
          `select * from agent_audit_events
           where created_at < ? or (created_at = ? and rowid < ?)
           order by created_at desc, rowid desc
           limit ?`
        )
        .all(rowString(cursorRow.created_at), rowString(cursorRow.created_at), Number(cursorRow.rowid), queryLimit)
    : db.prepare('select * from agent_audit_events order by created_at desc, rowid desc limit ?').all(queryLimit);
  const pageRows = rows.slice(0, limit);
  const items = pageRows.map((row) => mapAgentAuditEvent(row as Row));

  return {
    items,
    nextCursor: rows.length > limit ? items.at(-1)!.id : ''
  };
}

function getAgentAuditEvent(db: DatabaseSync, eventId: string) {
  const row = getAgentAuditEventRow(db, eventId);
  return row ? mapAgentAuditEvent(row) : undefined;
}

function getAgentAuditEventRow(db: DatabaseSync, eventId: string) {
  return db.prepare('select rowid, * from agent_audit_events where id = ?').get(eventId) as (Row & { rowid: number }) | undefined;
}
