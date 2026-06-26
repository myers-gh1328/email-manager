import type { AppRepository } from '../../repository';
import { sendOutboundEmail } from '../../mailer';
import { sendDueCampaignsWithDependencies } from '../../send-due-campaigns';
import { getSettings, type AppSettings } from '../../settings';
import { commitPreparedApproval, prepareAgentApproval } from '../approvals';
import { agentError, agentOk } from '../envelope';

export interface CommitSendDueCampaignsInput {
  approvalId: string;
  confirmationText: string;
}

interface SendDueCampaignsOperation {
  preparedAt: string;
  campaignIds: string[];
}

export function prepareSendDueCampaignsTool(repo: AppRepository, _input: Record<string, never> = {}, settingsOverride?: AppSettings) {
  const settings = settingsOverride ?? getSettings();
  const denied = requireAgentPermission(settings, 'prepareEmail');
  if (denied) return denied;

  const dueScheduledEmails = dueScheduledEmailsReadyToSend(repo);
  const prepared = prepareAgentApproval(repo, {
    toolName: 'commit_send_due_campaigns',
    risk: 'sends_email',
    summary: `Send due scheduled emails (${dueScheduledEmails.length}).`,
    operation: { preparedAt: new Date().toISOString(), campaignIds: dueScheduledEmails.map((scheduledEmail) => scheduledEmail.id) },
    review: {
      dueScheduledEmails: dueScheduledEmails.map((scheduledEmail) => ({
        scheduledEmailId: scheduledEmail.id,
        name: scheduledEmail.name,
        scheduledFor: scheduledEmail.scheduledFor
      })),
      schedulerEnabled: settings.schedulerEnabled,
      emailTestModeEnabled: settings.emailTestModeEnabled
    },
    expiresAt: expiresAt()
  });

  return agentOk(prepared, { labels: settings.vocabulary, nextActions: ['commit_send_due_campaigns'] });
}

export async function commitSendDueCampaignsTool(repo: AppRepository, input: CommitSendDueCampaignsInput, settingsOverride?: AppSettings) {
  const settings = settingsOverride ?? getSettings();
  const denied = requireAgentPermission(settings, 'sendEmail');
  if (denied) return denied;

  const approval = repo.getAgentApproval(input.approvalId);
  if (!approval) return agentError('not_found', 'Confirmation was not found.', { approvalId: input.approvalId }, { labels: settings.vocabulary });
  if (approval.toolName !== 'commit_send_due_campaigns') {
    return agentError('approval_changed', 'Confirmation does not match this tool.', { approvalId: input.approvalId }, { labels: settings.vocabulary });
  }
  if (approval.confirmationText !== input.confirmationText) {
    return agentError('approval_required', 'Exact confirmation text is required.', { approvalId: input.approvalId }, { labels: settings.vocabulary });
  }
  if (settings.emailTestModeEnabled) {
    return agentError(
      'test_mode_blocks_automatic_send',
      'Email test mode blocks automatic and send-due scheduled email sends.',
      { approvalId: input.approvalId },
      { labels: settings.vocabulary }
    );
  }
  const operation = JSON.parse(approval.operationJson) as SendDueCampaignsOperation;
  const preparedIds = [...operation.campaignIds].sort((left, right) => left.localeCompare(right));
  const currentIds = dueScheduledEmailsReadyToSend(repo)
    .map((scheduledEmail) => scheduledEmail.id)
    .sort((left, right) => left.localeCompare(right));
  if (!sameStringSet(preparedIds, currentIds)) {
    return agentError(
      'approval_changed',
      'Due scheduled emails changed after confirmation was prepared.',
      { approvalId: input.approvalId, preparedCampaignIds: preparedIds, currentCampaignIds: currentIds },
      { labels: settings.vocabulary }
    );
  }

  return commitPreparedApproval(repo, input.approvalId, input.confirmationText, async () => {
    const sent = await sendDueCampaignsWithDependencies(repo, settings, sendOutboundEmail, { surface: 'mcp_send_due' });
    return { sent };
  });
}

function dueScheduledEmailsReadyToSend(repo: AppRepository) {
  return repo.listReadyScheduledEmailsDue(new Date().toISOString(), { limit: 100 });
}

function sameStringSet(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function requireAgentPermission(settings: AppSettings, permission: 'prepareEmail' | 'sendEmail') {
  if (!settings.agentEnabled) {
    return agentError('agent_permission_denied', 'Agent access is disabled.', { permission: 'agentEnabled' }, { labels: settings.vocabulary });
  }
  if (!settings.agentPermissions[permission]) {
    return agentError(
      'agent_permission_denied',
      permission === 'prepareEmail'
        ? 'Agents are not allowed to prepare emails for confirmation.'
        : 'Agents are not allowed to send emails after confirmation.',
      { permission },
      { labels: settings.vocabulary }
    );
  }
  return null;
}

function expiresAt() {
  return new Date(Date.now() + 15 * 60_000).toISOString();
}
