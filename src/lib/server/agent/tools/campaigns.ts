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

  const dueCampaigns = dueApprovedCampaigns(repo);
  const prepared = prepareAgentApproval(repo, {
    toolName: 'commit_send_due_campaigns',
    risk: 'sends_email',
    summary: `Send due approved campaigns (${dueCampaigns.length}).`,
    operation: { preparedAt: new Date().toISOString(), campaignIds: dueCampaigns.map((campaign) => campaign.id) },
    review: {
      dueCampaigns: dueCampaigns.map((campaign) => ({
        campaignId: campaign.id,
        name: campaign.name,
        scheduledFor: campaign.scheduledFor,
        approved: campaign.approved
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
  if (!approval) return agentError('not_found', 'Approval was not found.', { approvalId: input.approvalId }, { labels: settings.vocabulary });
  if (approval.toolName !== 'commit_send_due_campaigns') {
    return agentError('approval_changed', 'Approval does not match this tool.', { approvalId: input.approvalId }, { labels: settings.vocabulary });
  }
  if (approval.confirmationText !== input.confirmationText) {
    return agentError('approval_required', 'Exact confirmation text is required.', { approvalId: input.approvalId }, { labels: settings.vocabulary });
  }
  if (settings.emailTestModeEnabled) {
    return agentError(
      'test_mode_blocks_automatic_send',
      'Email test mode blocks automatic and send-due campaign sends.',
      { approvalId: input.approvalId },
      { labels: settings.vocabulary }
    );
  }
  const operation = JSON.parse(approval.operationJson) as SendDueCampaignsOperation;
  const preparedIds = [...operation.campaignIds].sort((left, right) => left.localeCompare(right));
  const currentIds = dueApprovedCampaigns(repo)
    .map((campaign) => campaign.id)
    .sort((left, right) => left.localeCompare(right));
  if (!sameStringSet(preparedIds, currentIds)) {
    return agentError(
      'approval_changed',
      'Due approved campaigns changed after approval was prepared.',
      { approvalId: input.approvalId, preparedCampaignIds: preparedIds, currentCampaignIds: currentIds },
      { labels: settings.vocabulary }
    );
  }

  return commitPreparedApproval(repo, input.approvalId, input.confirmationText, async () => {
    const sent = await sendDueCampaignsWithDependencies(repo, settings, sendOutboundEmail, { surface: 'mcp_send_due' });
    return { sent };
  });
}

function dueApprovedCampaigns(repo: AppRepository) {
  return repo
    .listCampaigns()
    .filter((campaign) => campaign.approved && new Date(campaign.scheduledFor).getTime() <= Date.now());
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
        ? 'Agents are not allowed to prepare emails for approval.'
        : 'Agents are not allowed to send approved emails.',
      { permission },
      { labels: settings.vocabulary }
    );
  }
  return null;
}

function expiresAt() {
  return new Date(Date.now() + 15 * 60_000).toISOString();
}
