import { describe, expect, it } from 'vitest';
import { createTestRepository } from './repository-helpers';

function createApproval(repo: ReturnType<typeof createTestRepository>, summary = 'Pending approval') {
  return repo.createAgentApproval({
    toolName: 'prepare_direct_email',
    risk: 'sends_email',
    summary,
    operationJson: '{}',
    reviewJson: '{}',
    confirmationText: 'APPROVE SEND',
    expiresAt: '2030-01-01T00:00:00.000Z'
  });
}

function recordAuditEvent(repo: ReturnType<typeof createTestRepository>, summary: string) {
  return repo.recordAgentAuditEvent({
    toolName: 'get_app_overview',
    risk: 'read',
    action: 'read',
    summary,
    status: 'ok'
  });
}

describe('agent approval and audit repository', () => {
  it('creates and reads a pending approval', () => {
    const repo = createTestRepository();
    const approval = repo.createAgentApproval({
      toolName: 'prepare_direct_email',
      risk: 'sends_email',
      summary: 'Send email to one participant',
      operationJson: JSON.stringify({ contactIds: ['c1'] }),
      reviewJson: JSON.stringify({ recipients: 1 }),
      confirmationText: 'APPROVE SEND appr_test',
      expiresAt: '2030-01-01T00:00:00.000Z'
    });

    expect(approval).toMatchObject({
      toolName: 'prepare_direct_email',
      risk: 'sends_email',
      summary: 'Send email to one participant',
      operationJson: JSON.stringify({ contactIds: ['c1'] }),
      reviewJson: JSON.stringify({ recipients: 1 }),
      confirmationText: 'APPROVE SEND appr_test',
      status: 'pending',
      expiresAt: '2030-01-01T00:00:00.000Z',
      committedAt: '',
      resultJson: ''
    });
    expect(approval.id).toBeTruthy();
    expect(approval.id).toMatch(/^appr_/);
    expect(approval.createdAt).toBeTruthy();
    expect(repo.getAgentApproval(approval.id)?.summary).toBe('Send email to one participant');
    expect(repo.getAgentApproval('missing')).toBeUndefined();
  });

  it('lists only pending approvals and expires old approvals', () => {
    const repo = createTestRepository();
    const expired = repo.createAgentApproval({
      toolName: 'prepare_campaign_schedule',
      risk: 'schedules_email',
      summary: 'Schedule campaign',
      operationJson: '{}',
      reviewJson: '{}',
      confirmationText: 'APPROVE schedule',
      expiresAt: '2029-01-01T00:00:00.000Z'
    });
    const pending = repo.createAgentApproval({
      toolName: 'prepare_direct_email',
      risk: 'sends_email',
      summary: 'Send email',
      operationJson: '{}',
      reviewJson: '{}',
      confirmationText: 'APPROVE SEND',
      expiresAt: '2030-01-01T00:00:00.000Z'
    });
    const committed = repo.createAgentApproval({
      toolName: 'prepare_roster_import',
      risk: 'imports_data',
      summary: 'Import roster',
      operationJson: '{}',
      reviewJson: '{}',
      confirmationText: 'APPROVE import',
      expiresAt: '2030-01-01T00:00:00.000Z'
    });
    expect(repo.markAgentApprovalCommitting(committed.id)).toBe(1);
    expect(repo.markAgentApprovalCommitted(committed.id, JSON.stringify({ ok: true }))).toBe(1);

    expect(repo.expireAgentApprovals('2029-06-01T00:00:00.000Z')).toBe(1);

    expect(repo.getAgentApproval(expired.id)?.status).toBe('expired');
    expect(repo.listPendingAgentApprovals().map((approval) => approval.id)).toEqual([pending.id]);
  });

  it('marks approvals committed, failed, and rejected', () => {
    const repo = createTestRepository();
    const committed = repo.createAgentApproval({
      toolName: 'prepare_direct_email',
      risk: 'sends_email',
      summary: 'Send email',
      operationJson: '{}',
      reviewJson: '{}',
      confirmationText: 'APPROVE SEND',
      expiresAt: '2030-01-01T00:00:00.000Z'
    });
    const failed = repo.createAgentApproval({
      toolName: 'prepare_campaign_approval',
      risk: 'schedules_email',
      summary: 'Approve campaign',
      operationJson: '{}',
      reviewJson: '{}',
      confirmationText: 'APPROVE campaign',
      expiresAt: '2030-01-01T00:00:00.000Z'
    });
    const rejected = repo.createAgentApproval({
      toolName: 'prepare_roster_import',
      risk: 'imports_data',
      summary: 'Import roster',
      operationJson: '{}',
      reviewJson: '{}',
      confirmationText: 'APPROVE import',
      expiresAt: '2030-01-01T00:00:00.000Z'
    });

    expect(repo.markAgentApprovalCommitting(committed.id)).toBe(1);
    expect(repo.markAgentApprovalCommitted(committed.id, JSON.stringify({ id: 'result1' }))).toBe(1);
    expect(repo.markAgentApprovalCommitting(failed.id)).toBe(1);
    expect(repo.markAgentApprovalFailed(failed.id, JSON.stringify({ message: 'SMTP failed' }))).toBe(1);
    expect(repo.markAgentApprovalRejected(rejected.id)).toBe(1);

    expect(repo.getAgentApproval(committed.id)).toMatchObject({
      status: 'committed',
      resultJson: JSON.stringify({ id: 'result1' })
    });
    expect(repo.getAgentApproval(committed.id)?.committedAt).toBeTruthy();
    expect(repo.getAgentApproval(failed.id)).toMatchObject({
      status: 'failed',
      resultJson: JSON.stringify({ message: 'SMTP failed' })
    });
    expect(repo.getAgentApproval(rejected.id)?.status).toBe('rejected');
  });

  it('atomically claims a pending approval before terminal commit or failure', () => {
    const repo = createTestRepository();
    const approval = createApproval(repo, 'Claim once');
    const unclaimed = createApproval(repo, 'Unclaimed terminal update');

    expect(repo.markAgentApprovalCommitted(unclaimed.id, JSON.stringify({ id: 'result1' }))).toBe(0);
    expect(repo.markAgentApprovalFailed(unclaimed.id, JSON.stringify({ message: 'failed' }))).toBe(0);
    expect(repo.getAgentApproval(unclaimed.id)?.status).toBe('pending');

    expect(repo.markAgentApprovalCommitting(approval.id)).toBe(1);
    expect(repo.getAgentApproval(approval.id)?.status).toBe('committing');
    expect(repo.markAgentApprovalCommitting(approval.id)).toBe(0);
    expect(repo.markAgentApprovalCommitted(approval.id, JSON.stringify({ id: 'result1' }))).toBe(1);
    expect(repo.markAgentApprovalFailed(approval.id, JSON.stringify({ message: 'rewritten' }))).toBe(0);
    expect(repo.getAgentApproval(approval.id)).toMatchObject({
      status: 'committed',
      resultJson: JSON.stringify({ id: 'result1' })
    });
  });

  it('does not rewrite approvals after they leave pending status', () => {
    const repo = createTestRepository();
    const committed = createApproval(repo, 'Commit once');
    const rejected = createApproval(repo, 'Reject once');
    const failed = createApproval(repo, 'Fail once');
    const expired = createApproval(repo, 'Expire once');

    expect(repo.markAgentApprovalCommitting(committed.id)).toBe(1);
    expect(repo.markAgentApprovalCommitted(committed.id, JSON.stringify({ id: 'original' }))).toBe(1);
    expect(repo.markAgentApprovalRejected(rejected.id)).toBe(1);
    expect(repo.markAgentApprovalCommitting(failed.id)).toBe(1);
    expect(repo.markAgentApprovalFailed(failed.id, JSON.stringify({ message: 'original failure' }))).toBe(1);
    expect(repo.expireAgentApprovals('2031-01-01T00:00:00.000Z')).toBe(1);

    expect(repo.markAgentApprovalRejected(committed.id)).toBe(0);
    expect(repo.markAgentApprovalCommitted(rejected.id, JSON.stringify({ id: 'rewritten' }))).toBe(0);
    expect(repo.markAgentApprovalCommitted(failed.id, JSON.stringify({ id: 'rewritten' }))).toBe(0);
    expect(repo.markAgentApprovalFailed(expired.id, JSON.stringify({ message: 'rewritten failure' }))).toBe(0);

    expect(repo.getAgentApproval(committed.id)).toMatchObject({
      status: 'committed',
      resultJson: JSON.stringify({ id: 'original' })
    });
    expect(repo.getAgentApproval(rejected.id)).toMatchObject({
      status: 'rejected',
      resultJson: ''
    });
    expect(repo.getAgentApproval(failed.id)).toMatchObject({
      status: 'failed',
      resultJson: JSON.stringify({ message: 'original failure' })
    });
    expect(repo.getAgentApproval(expired.id)).toMatchObject({
      status: 'expired',
      resultJson: ''
    });
  });

  it('records audit events in newest-first order with pagination', () => {
    const repo = createTestRepository();
    const first = repo.recordAgentAuditEvent({
      toolName: 'get_app_overview',
      risk: 'read',
      action: 'read',
      summary: 'Read overview',
      status: 'ok'
    });
    const second = repo.recordAgentAuditEvent({
      toolName: 'prepare_direct_email',
      risk: 'sends_email',
      action: 'prepare',
      summary: 'Prepared email approval',
      entityType: 'communication',
      entityId: 'comm1',
      status: 'pending'
    });
    expect(first.id).toMatch(/^audit_/);
    expect(second.id).toMatch(/^audit_/);

    const firstPage = repo.listAgentAuditEvents({ limit: 1 });
    expect(firstPage.items).toMatchObject([
      {
        id: second.id,
        toolName: 'prepare_direct_email',
        entityType: 'communication',
        entityId: 'comm1'
      }
    ]);
    expect(firstPage.nextCursor).toBe(second.id);

    const secondPage = repo.listAgentAuditEvents({ limit: 10, cursor: firstPage.nextCursor });
    expect(secondPage.items).toMatchObject([{ id: first.id, toolName: 'get_app_overview', entityType: '', entityId: '' }]);
    expect(secondPage.nextCursor).toBe('');
  });

  it('returns an empty audit page for an unknown cursor', () => {
    const repo = createTestRepository();
    recordAuditEvent(repo, 'Read overview');

    expect(repo.listAgentAuditEvents({ limit: 10, cursor: 'audit_missing' })).toEqual({
      items: [],
      nextCursor: ''
    });
  });

  it('only returns an audit next cursor when an extra row exists', () => {
    const repo = createTestRepository();
    const first = recordAuditEvent(repo, 'First event');
    const second = recordAuditEvent(repo, 'Second event');
    const third = recordAuditEvent(repo, 'Third event');

    const exactPage = repo.listAgentAuditEvents({ limit: 3 });
    expect(exactPage.items.map((event) => event.id)).toEqual([third.id, second.id, first.id]);
    expect(exactPage.nextCursor).toBe('');

    const firstPage = repo.listAgentAuditEvents({ limit: 2 });
    expect(firstPage.items.map((event) => event.id)).toEqual([third.id, second.id]);
    expect(firstPage.nextCursor).toBe(second.id);

    const finalPage = repo.listAgentAuditEvents({ limit: 2, cursor: firstPage.nextCursor });
    expect(finalPage.items.map((event) => event.id)).toEqual([first.id]);
    expect(finalPage.nextCursor).toBe('');
  });
});
