import type { AppRepository, AgentRisk } from '../repository';
import { recordAgentAudit } from './audit';
import { agentError, agentOk, type AgentEnvelope } from './envelope';

export interface PrepareAgentApprovalInput {
  toolName: string;
  risk: AgentRisk;
  summary: string;
  operation: unknown;
  review: unknown;
  expiresAt: string;
}

function confirmationTextFor(risk: AgentRisk, approvalId: string) {
  return `${risk === 'sends_email' ? 'CONFIRM SEND' : 'CONFIRM'} ${approvalId}`;
}

function safeFailureJson() {
  return JSON.stringify({ message: 'Commit failed.' });
}

const safeCommitSuccessFallback = { message: 'Commit completed.' };

function safeCommitSuccessResult<T>(result: T): { data: T | typeof safeCommitSuccessFallback; resultJson: string } {
  try {
    const resultJson = JSON.stringify(result);
    if (typeof resultJson === 'string') return { data: result, resultJson };
  } catch {
    // Commit side effects may already have happened, so persist a generic success.
  }

  return {
    data: safeCommitSuccessFallback,
    resultJson: JSON.stringify(safeCommitSuccessFallback)
  };
}

export function prepareAgentApproval(repo: AppRepository, input: PrepareAgentApprovalInput) {
  const approval = repo.createAgentApproval({
    toolName: input.toolName,
    risk: input.risk,
    summary: input.summary,
    operationJson: JSON.stringify(input.operation),
    reviewJson: JSON.stringify(input.review),
    confirmationText: 'pending-confirmation',
    expiresAt: input.expiresAt
  });
  const confirmationText = confirmationTextFor(input.risk, approval.id);
  const updated = repo.updateAgentApprovalConfirmationText(approval.id, confirmationText);
  if (updated !== 1) throw new Error(`Agent approval confirmation could not be updated: ${approval.id}`);

  recordAgentAudit(repo, {
    toolName: input.toolName,
    risk: input.risk,
    action: 'prepare',
    summary: input.summary,
    status: 'pending'
  });

  return {
    approvalId: approval.id,
    risk: input.risk,
    summary: input.summary,
    confirmationText,
    expiresAt: input.expiresAt,
    review: input.review,
    warnings: []
  };
}

export async function commitPreparedApproval<T>(
  repo: AppRepository,
  approvalId: string,
  confirmationText: string,
  commit: () => T | Promise<T>
): Promise<AgentEnvelope<T | typeof safeCommitSuccessFallback>> {
  const approval = repo.getAgentApproval(approvalId);
  if (!approval) return agentError('not_found', 'Approval was not found.', { approvalId });
  if (approval.status !== 'pending') {
    return agentError('conflict', 'Approval is no longer pending.', { approvalId, status: approval.status });
  }
  if (approval.confirmationText !== confirmationText) {
    return agentError('approval_required', 'Exact confirmation text is required.', { approvalId });
  }

  const nowIso = new Date().toISOString();
  if (approval.expiresAt <= nowIso) {
    repo.expireAgentApprovals(nowIso);
    recordAgentAudit(repo, {
      toolName: approval.toolName,
      risk: approval.risk,
      action: 'expire',
      summary: approval.summary,
      status: 'expired'
    });
    return agentError('approval_expired', 'Approval has expired.', { approvalId });
  }

  const claimed = repo.markAgentApprovalCommitting(approvalId);
  if (claimed !== 1) return agentError('conflict', 'Approval is no longer pending.', { approvalId });

  try {
    const result = await commit();
    const safeResult = safeCommitSuccessResult(result);
    const committed = repo.markAgentApprovalCommitted(approvalId, safeResult.resultJson);
    if (committed !== 1) return agentError('conflict', 'Approval is no longer pending.', { approvalId });
    recordAgentAudit(repo, {
      toolName: approval.toolName,
      risk: approval.risk,
      action: 'commit',
      summary: approval.summary,
      status: 'committed'
    });
    return agentOk(safeResult.data);
  } catch {
    repo.markAgentApprovalFailed(approvalId, safeFailureJson());
    recordAgentAudit(repo, {
      toolName: approval.toolName,
      risk: approval.risk,
      action: 'commit',
      summary: approval.summary,
      status: 'failed'
    });
    return agentError('commit_failed', 'Commit failed.', { approvalId });
  }
}
