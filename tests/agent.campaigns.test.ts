import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultAgentPermissions } from '../src/lib/server/agent/permissions';
import { commitSendDueCampaignsTool, prepareSendDueCampaignsTool } from '../src/lib/server/agent/tools/campaigns';
import type { AppSettings } from '../src/lib/server/settings';
import { createTestRepository } from './repository-helpers';
import { baseAppSettings } from './settings-helpers';

const { sendOutboundEmail } = vi.hoisted(() => ({
  sendOutboundEmail: vi.fn()
}));

vi.mock('../src/lib/server/mailer', () => ({
  sendOutboundEmail
}));

describe('agent campaign send-due tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendOutboundEmail.mockResolvedValue({
      providerMessage: 'accepted-1',
      originalRecipient: 'recipient@example.test',
      effectiveRecipient: 'recipient@example.test',
      testMode: false,
      finalText: 'Rendered body',
      finalHtml: ''
    });
  });

  it('prepares send-due only when prepareEmail permission is enabled', () => {
    const repo = createTestRepository();

    const result = prepareSendDueCampaignsTool(repo, {}, agentSettings());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('agent_permission_denied');
    expect(result.error.message).toBe('Agents are not allowed to prepare emails for confirmation.');
    expect(result.error.message).not.toContain('approval');
    expect(result.error.details).toEqual({ permission: 'prepareEmail' });
  });

  it('uses the shared send-due path and does not resend successful or failed deliveries', async () => {
    const repo = createTestRepository();
    const { campaign, sentContact, retryContact, retryDelivery } = seedDueCampaign(repo);
    repo.markDeliverySent(repo.listDeliveries(campaign.id).find((delivery) => delivery.recipientId === sentContact.id)!.id, 'already-sent');
    repo.markDeliveryFailed(retryDelivery.id, 'temporary SMTP error');

    const prepared = prepareSendDueCampaignsTool(repo, {}, agentSettings({ prepareEmail: true }));
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    expect(prepared.data.summary).toBe('Send due scheduled emails (1).');
    expect(prepared.data.summary).not.toContain('approved campaigns');
    expect(prepared.data.review).toHaveProperty('dueScheduledEmails');
    expect(prepared.data.review).not.toHaveProperty('dueCampaigns');
    expect(JSON.stringify(prepared.data.review)).not.toContain('approved');
    expect(JSON.stringify(prepared.data.review)).toContain('scheduledEmailId');
    const result = await commitSendDueCampaignsTool(
      repo,
      { approvalId: prepared.data.approvalId, confirmationText: prepared.data.confirmationText },
      agentSettings({ sendEmail: true })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual({ sent: 0 });
    expect(sendOutboundEmail).not.toHaveBeenCalled();
    expect(repo.listDeliveries(campaign.id).filter((delivery) => delivery.recipientId === sentContact.id)).toMatchObject([
      { status: 'sent', providerMessage: 'already-sent' }
    ]);
    expect(repo.listDeliveries(campaign.id).filter((delivery) => delivery.recipientId === retryContact.id)).toMatchObject([
      { id: retryDelivery.id, status: 'failed', errorMessage: 'temporary SMTP error' }
    ]);
  });

  it('does not let MCP send-due retry failed campaign deliveries', async () => {
    const repo = createTestRepository();
    const { campaign, retryContact, retryDelivery } = seedDueCampaign(repo);
    for (const delivery of repo.listDeliveries(campaign.id)) {
      if (delivery.recipientId !== retryContact.id) repo.markDeliverySent(delivery.id, 'already-sent');
    }
    repo.markDeliveryFailed(retryDelivery.id, 'temporary SMTP error');

    const prepared = prepareSendDueCampaignsTool(repo, {}, agentSettings({ prepareEmail: true }));
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    const result = await commitSendDueCampaignsTool(
      repo,
      { approvalId: prepared.data.approvalId, confirmationText: prepared.data.confirmationText },
      agentSettings({ sendEmail: true })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual({ sent: 0 });
    expect(sendOutboundEmail).not.toHaveBeenCalled();
    expect(repo.listDeliveries(campaign.id).find((delivery) => delivery.id === retryDelivery.id)).toMatchObject({
      status: 'failed',
      errorMessage: 'temporary SMTP error'
    });
  });

  it('requires exact confirmation and sendEmail permission for send-due commit', async () => {
    const repo = createTestRepository();
    seedDueCampaign(repo);
    const prepared = prepareSendDueCampaignsTool(repo, {}, agentSettings({ prepareEmail: true }));
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;

    const wrong = await commitSendDueCampaignsTool(
      repo,
      { approvalId: prepared.data.approvalId, confirmationText: 'wrong' },
      agentSettings({ sendEmail: true })
    );
    const denied = await commitSendDueCampaignsTool(
      repo,
      { approvalId: prepared.data.approvalId, confirmationText: prepared.data.confirmationText },
      agentSettings({ sendEmail: false })
    );

    expect(wrong.ok).toBe(false);
    if (!wrong.ok) expect(wrong.error.code).toBe('approval_required');
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.error.code).toBe('agent_permission_denied');
      expect(denied.error.message).toBe('Agents are not allowed to send emails after confirmation.');
      expect(denied.error.message).not.toContain('approved emails');
    }
  });

  it('uses confirmation wording when prepared send-due confirmation is missing or mismatched', async () => {
    const repo = createTestRepository();
    const wrongTool = repo.createAgentApproval({
      toolName: 'commit_direct_email',
      risk: 'sends_email',
      summary: 'Prepared direct email',
      operationJson: '{}',
      reviewJson: '{}',
      confirmationText: 'CONFIRM SEND appr_test',
      expiresAt: '2030-01-01T00:00:00.000Z'
    });

    const missing = await commitSendDueCampaignsTool(
      repo,
      { approvalId: 'appr_missing', confirmationText: 'CONFIRM SEND appr_missing' },
      agentSettings({ sendEmail: true })
    );
    const mismatched = await commitSendDueCampaignsTool(
      repo,
      { approvalId: wrongTool.id, confirmationText: wrongTool.confirmationText },
      agentSettings({ sendEmail: true })
    );

    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.error.message).toBe('Confirmation was not found.');
      expect(missing.error.message).not.toContain('Approval');
    }
    expect(mismatched.ok).toBe(false);
    if (!mismatched.ok) {
      expect(mismatched.error.message).toBe('Confirmation does not match this tool.');
      expect(mismatched.error.message).not.toContain('Approval');
    }
  });

  it('fails closed when due campaign IDs change after prepare', async () => {
    const repo = createTestRepository();
    seedDueCampaign(repo, 'first');
    const prepared = prepareSendDueCampaignsTool(repo, {}, agentSettings({ prepareEmail: true }));
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    seedDueCampaign(repo, 'second');

    const result = await commitSendDueCampaignsTool(
      repo,
      { approvalId: prepared.data.approvalId, confirmationText: prepared.data.confirmationText },
      agentSettings({ sendEmail: true })
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('approval_changed');
      expect(result.error.message).toBe('Due scheduled emails changed after confirmation was prepared.');
      expect(result.error.message).not.toContain('approval');
      expect(result.error.message).not.toContain('approved campaigns');
    }
    expect(sendOutboundEmail).not.toHaveBeenCalled();
  });

  it('blocks send-due commit when email test mode is enabled', async () => {
    const repo = createTestRepository();
    seedDueCampaign(repo);
    const settings = agentSettings({ prepareEmail: true, sendEmail: true }, true, { emailTestModeEnabled: true });
    const prepared = prepareSendDueCampaignsTool(repo, {}, settings);
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;

    const result = await commitSendDueCampaignsTool(repo, { approvalId: prepared.data.approvalId, confirmationText: prepared.data.confirmationText }, settings);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('test_mode_blocks_automatic_send');
      expect(result.error.message).toBe('Email test mode blocks automatic and send-due scheduled email sends.');
      expect(result.error.message).not.toContain('campaign');
    }
    expect(sendOutboundEmail).not.toHaveBeenCalled();
  });
});

function seedDueCampaign(repo: ReturnType<typeof createTestRepository>, suffix = 'one') {
  const sentContact = repo.createContact({ firstName: 'Maya', lastName: 'Patel', email: `maya-${suffix}@example.test` });
  const retryContact = repo.createContact({ firstName: 'Lee', lastName: 'Morgan', email: `lee-${suffix}@example.test` });
  const course = repo.createCourseType({ name: `Open Water ${suffix}` });
  const session = repo.createClassSession({ courseTypeId: course.id, startsOn: '2026-01-01', location: `Pool ${suffix}` });
  const template = repo.createTemplate({ name: `Reminder ${suffix}`, subject: 'Hi {{firstName}}', body: 'Class {{courseName}}' });
  repo.enrollContact(session.id, sentContact.id);
  repo.enrollContact(session.id, retryContact.id);
  const campaign = repo.createCampaign({
    classSessionId: session.id,
    templateId: template.id,
    name: 'Reminder',
    scheduledFor: '2000-01-01T00:00',
    approved: true
  });
  const deliveries = repo.ensurePendingDeliveries(campaign.id);
  const retryDelivery = deliveries.find((delivery) => delivery.recipientId === retryContact.id)!;
  return { campaign, sentContact, retryContact, retryDelivery };
}

function agentSettings(
  permissions: Partial<AppSettings['agentPermissions']> = {},
  agentEnabled = true,
  overrides: Partial<AppSettings> = {}
): AppSettings {
  return baseAppSettings({
    instructorName: 'Alex',
    schedulerEnabled: true,
    agentEnabled,
    agentPermissions: { ...defaultAgentPermissions, ...permissions },
    ...overrides
  });
}
