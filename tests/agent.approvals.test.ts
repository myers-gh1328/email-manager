import { describe, expect, it, vi } from 'vitest';
import { commitPreparedApproval, prepareAgentApproval } from '../src/lib/server/agent/approvals';
import { createTestRepository } from './repository-helpers';

function prepareEmailApproval(repo: ReturnType<typeof createTestRepository>, expiresAt = '2030-01-01T00:00:00.000Z') {
  return prepareAgentApproval(repo, {
    toolName: 'prepare_direct_email',
    risk: 'sends_email',
    summary: 'Send email',
    operation: { subject: 'Hello' },
    review: { recipients: 1 },
    expiresAt
  });
}

describe('agent approval service', () => {
  it('creates deterministic exact confirmation text and records prepare audit', () => {
    const repo = createTestRepository();

    const prepared = prepareEmailApproval(repo);

    expect(prepared.approvalId).toMatch(/^appr_/);
    expect(prepared.confirmationText).toBe(`CONFIRM SEND ${prepared.approvalId}`);
    expect(prepared.confirmationText).not.toContain('APPROVE');
    expect(repo.getAgentApproval(prepared.approvalId)).toMatchObject({
      confirmationText: prepared.confirmationText,
      status: 'pending'
    });
    expect(repo.listAgentAuditEvents({ limit: 10 }).items).toMatchObject([
      {
        toolName: 'prepare_direct_email',
        risk: 'sends_email',
        action: 'prepare',
        summary: 'Send email',
        status: 'pending'
      }
    ]);
  });

  it('uses non-send confirmation text for other approval risks', () => {
    const repo = createTestRepository();

    const prepared = prepareAgentApproval(repo, {
      toolName: 'prepare_roster_import',
      risk: 'imports_data',
      summary: 'Import roster',
      operation: { rows: 2 },
      review: { creates: 2 },
      expiresAt: '2030-01-01T00:00:00.000Z'
    });

    expect(prepared.confirmationText).toBe(`CONFIRM ${prepared.approvalId}`);
    expect(prepared.confirmationText).not.toContain('APPROVE');
  });

  it('requires exact confirmation text', async () => {
    const repo = createTestRepository();
    const prepared = prepareEmailApproval(repo);
    const commit = vi.fn(() => ({ ok: true }));

    const result = await commitPreparedApproval(repo, prepared.approvalId, 'wrong', commit);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('approval_required');
    expect(commit).not.toHaveBeenCalled();
    expect(repo.getAgentApproval(prepared.approvalId)?.status).toBe('pending');
  });

  it('commits once with exact confirmation text', async () => {
    const repo = createTestRepository();
    const prepared = prepareEmailApproval(repo);

    const committed = await commitPreparedApproval(repo, prepared.approvalId, prepared.confirmationText, () => ({ id: 'result1' }));
    const again = await commitPreparedApproval(repo, prepared.approvalId, prepared.confirmationText, () => ({ id: 'result2' }));

    expect(committed.ok).toBe(true);
    if (committed.ok) expect(committed.data).toEqual({ id: 'result1' });
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.error.code).toBe('conflict');
    expect(repo.getAgentApproval(prepared.approvalId)).toMatchObject({
      status: 'committed',
      resultJson: JSON.stringify({ id: 'result1' })
    });
  });

  it('only runs one commit callback when concurrent commits race for the same approval', async () => {
    const repo = createTestRepository();
    const prepared = prepareEmailApproval(repo);
    let resolveCommit: (value: { id: string }) => void = () => {};
    const commit = vi.fn(
      () =>
        new Promise<{ id: string }>((resolve) => {
          resolveCommit = resolve;
        })
    );

    const first = commitPreparedApproval(repo, prepared.approvalId, prepared.confirmationText, commit);
    const second = commitPreparedApproval(repo, prepared.approvalId, prepared.confirmationText, commit);

    expect(commit).toHaveBeenCalledTimes(1);
    expect(repo.getAgentApproval(prepared.approvalId)?.status).toBe('committing');

    resolveCommit({ id: 'result1' });
    const [firstResult, secondResult] = await Promise.all([first, second]);

    expect(firstResult.ok).toBe(true);
    if (firstResult.ok) expect(firstResult.data).toEqual({ id: 'result1' });
    expect(secondResult.ok).toBe(false);
    if (!secondResult.ok) expect(secondResult.error.code).toBe('conflict');
    expect(repo.getAgentApproval(prepared.approvalId)).toMatchObject({
      status: 'committed',
      resultJson: JSON.stringify({ id: 'result1' })
    });
  });

  it('expires pending approval instead of committing after expiry', async () => {
    const repo = createTestRepository();
    const prepared = prepareEmailApproval(repo, '2000-01-01T00:00:00.000Z');
    const commit = vi.fn(() => ({ id: 'result1' }));

    const result = await commitPreparedApproval(repo, prepared.approvalId, prepared.confirmationText, commit);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('approval_expired');
    expect(commit).not.toHaveBeenCalled();
    expect(repo.getAgentApproval(prepared.approvalId)?.status).toBe('expired');
  });

  it('returns conflict for non-pending terminal approvals', async () => {
    const repo = createTestRepository();
    const prepared = prepareEmailApproval(repo);
    expect(repo.markAgentApprovalRejected(prepared.approvalId)).toBe(1);

    const result = await commitPreparedApproval(repo, prepared.approvalId, prepared.confirmationText, () => ({ id: 'result1' }));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('conflict');
  });

  it('returns a redacted error envelope and marks failed when commit throws', async () => {
    const repo = createTestRepository();
    const prepared = prepareEmailApproval(repo);

    const result = await commitPreparedApproval(repo, prepared.approvalId, prepared.confirmationText, () => {
      throw new Error('SMTP password secret leaked');
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('commit_failed');
      expect(result.error.message).toBe('Commit failed.');
      expect(JSON.stringify(result.error)).not.toContain('password');
      expect(JSON.stringify(result.error)).not.toContain('SMTP password secret leaked');
    }
    expect(repo.getAgentApproval(prepared.approvalId)).toMatchObject({
      status: 'failed',
      resultJson: JSON.stringify({ message: 'Commit failed.' })
    });
    expect(repo.listAgentAuditEvents({ limit: 1 }).items).toMatchObject([
      {
        action: 'commit',
        status: 'failed',
        summary: 'Send email'
      }
    ]);
  });

  it('awaits rejected async commit and records redacted failed state', async () => {
    const repo = createTestRepository();
    const prepared = prepareEmailApproval(repo);

    const result = await commitPreparedApproval(repo, prepared.approvalId, prepared.confirmationText, async () => {
      throw new Error('SMTP password secret leaked');
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('commit_failed');
      expect(result.error.message).toBe('Commit failed.');
      expect(JSON.stringify(result.error)).not.toContain('password');
      expect(JSON.stringify(result.error)).not.toContain('SMTP password secret leaked');
    }
    expect(repo.getAgentApproval(prepared.approvalId)).toMatchObject({
      status: 'failed',
      resultJson: JSON.stringify({ message: 'Commit failed.' })
    });
    expect(repo.listAgentAuditEvents({ limit: 1 }).items).toMatchObject([
      {
        action: 'commit',
        status: 'failed',
        summary: 'Send email'
      }
    ]);
  });

  it('commits with a generic success result when commit returns non-serializable data', async () => {
    const repo = createTestRepository();
    const prepared = prepareEmailApproval(repo);

    const result = await commitPreparedApproval(repo, prepared.approvalId, prepared.confirmationText, () => ({ id: 1n }));

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual({ message: 'Commit completed.' });
    expect(repo.getAgentApproval(prepared.approvalId)).toMatchObject({
      status: 'committed',
      resultJson: JSON.stringify({ message: 'Commit completed.' })
    });
    expect(repo.listAgentAuditEvents({ limit: 1 }).items).toMatchObject([
      {
        action: 'commit',
        status: 'committed',
        summary: 'Send email'
      }
    ]);
  });
});
