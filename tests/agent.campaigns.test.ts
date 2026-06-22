import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultAgentPermissions } from '../src/lib/server/agent/permissions';
import { commitSendDueCampaignsTool, prepareSendDueCampaignsTool } from '../src/lib/server/agent/tools/campaigns';
import { defaultVocabulary } from '../src/lib/server/agent/vocabulary';
import type { AppSettings } from '../src/lib/server/settings';
import { createTestRepository } from './repository-helpers';

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
    expect(result.error.details).toEqual({ permission: 'prepareEmail' });
  });

  it('uses the shared send-due path and does not resend successful deliveries', async () => {
    const repo = createTestRepository();
    const { campaign, sentContact, retryContact, retryDelivery } = seedDueCampaign(repo);
    repo.markDeliverySent(repo.listDeliveries(campaign.id).find((delivery) => delivery.recipientId === sentContact.id)!.id, 'already-sent');
    repo.markDeliveryFailed(retryDelivery.id, 'temporary SMTP error');
    sendOutboundEmail.mockResolvedValueOnce({
      providerMessage: 'accepted-retry',
      originalRecipient: retryContact.email,
      effectiveRecipient: retryContact.email,
      testMode: false,
      finalText: 'Hi Lee',
      finalHtml: ''
    });

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
    expect(result.data).toEqual({ sent: 1 });
    expect(sendOutboundEmail).toHaveBeenCalledTimes(1);
    expect(sendOutboundEmail).toHaveBeenCalledWith(expect.objectContaining({ to: retryContact.email }));
    expect(repo.listDeliveries(campaign.id).filter((delivery) => delivery.recipientId === sentContact.id)).toMatchObject([
      { status: 'sent', providerMessage: 'already-sent' }
    ]);
    expect(repo.listDeliveries(campaign.id).filter((delivery) => delivery.recipientId === retryContact.id)).toMatchObject([
      { id: retryDelivery.id, status: 'sent', providerMessage: 'accepted-retry' }
    ]);
  });

  it('allows failed campaign deliveries to retry through MCP', async () => {
    const repo = createTestRepository();
    const { campaign, retryContact, retryDelivery } = seedDueCampaign(repo);
    for (const delivery of repo.listDeliveries(campaign.id)) {
      if (delivery.recipientId !== retryContact.id) repo.markDeliverySent(delivery.id, 'already-sent');
    }
    repo.markDeliveryFailed(retryDelivery.id, 'temporary SMTP error');
    sendOutboundEmail.mockResolvedValueOnce({
      providerMessage: 'accepted-retry',
      originalRecipient: retryContact.email,
      effectiveRecipient: retryContact.email,
      testMode: false,
      finalText: 'Hi Lee',
      finalHtml: ''
    });

    const prepared = prepareSendDueCampaignsTool(repo, {}, agentSettings({ prepareEmail: true }));
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    const result = await commitSendDueCampaignsTool(
      repo,
      { approvalId: prepared.data.approvalId, confirmationText: prepared.data.confirmationText },
      agentSettings({ sendEmail: true })
    );

    expect(result.ok).toBe(true);
    expect(repo.listDeliveries(campaign.id).find((delivery) => delivery.id === retryDelivery.id)).toMatchObject({ status: 'sent' });
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
    if (!denied.ok) expect(denied.error.code).toBe('agent_permission_denied');
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
    if (!result.ok) expect(result.error.code).toBe('approval_changed');
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
    if (!result.ok) expect(result.error.code).toBe('test_mode_blocks_automatic_send');
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
  return {
    instructorName: 'Alex',
    publicBaseUrl: '',
    schedulerEnabled: true,
    emailTestModeEnabled: false,
    emailSignature: '',
    remoteAccessEnabled: false,
    trustedProxyEnabled: false,
    smtpHost: '',
    smtpPort: '587',
    smtpUser: '',
    smtpFrom: '',
    smtpAuthMethod: 'password',
    smtpPasswordConfigured: false,
    microsoftTenantId: 'common',
    microsoftClientId: '',
    microsoftClientSecretConfigured: false,
    microsoftRefreshTokenConfigured: false,
    aiEnabled: false,
    aiVisionEnabled: false,
    aiBaseUrl: '',
    aiModel: '',
    aiApiKeyConfigured: false,
    themeMode: 'system',
    agentEnabled,
    agentPermissions: { ...defaultAgentPermissions, ...permissions },
    vocabulary: defaultVocabulary,
    ...overrides
  };
}
