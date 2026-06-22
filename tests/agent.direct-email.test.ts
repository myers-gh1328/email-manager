import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultAgentPermissions } from '../src/lib/server/agent/permissions';
import { prepareDirectEmailTool, commitDirectEmailTool } from '../src/lib/server/agent/tools/communications';
import { defaultVocabulary } from '../src/lib/server/agent/vocabulary';
import type { AppSettings } from '../src/lib/server/settings';
import { createTestRepository } from './repository-helpers';

const { sendOutboundEmail } = vi.hoisted(() => ({
  sendOutboundEmail: vi.fn()
}));

vi.mock('../src/lib/server/mailer', () => ({
  sendOutboundEmail
}));

describe('agent direct email tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires prepareEmail permission to prepare direct email', () => {
    const repo = createTestRepository();
    const contact = repo.createContact({ firstName: 'Maya', lastName: 'Patel', email: 'maya@example.test' });

    const result = prepareDirectEmailTool(
      repo,
      { contactIds: [contact.id], subject: 'Hi {{firstName}}', body: 'Hello {{fullName}}', instructorName: 'Alex' },
      agentSettings()
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('agent_permission_denied');
    expect(result.error.details).toEqual({ permission: 'prepareEmail' });
  });

  it('requires exact approval confirmation and sendEmail permission to commit', async () => {
    const repo = createTestRepository();
    const contact = repo.createContact({ firstName: 'Maya', lastName: 'Patel', email: 'maya@example.test' });
    const prepared = prepareDirectEmailTool(
      repo,
      { contactIds: [contact.id], subject: 'Hi {{firstName}}', body: 'Hello {{fullName}}', instructorName: 'Alex' },
      agentSettings({ prepareEmail: true })
    );
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;

    const wrong = await commitDirectEmailTool(
      repo,
      { approvalId: prepared.data.approvalId, confirmationText: 'wrong' },
      agentSettings({ sendEmail: true })
    );
    expect(wrong.ok).toBe(false);
    if (!wrong.ok) expect(wrong.error.code).toBe('approval_required');

    const denied = await commitDirectEmailTool(
      repo,
      { approvalId: prepared.data.approvalId, confirmationText: prepared.data.confirmationText },
      agentSettings({ sendEmail: false })
    );
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.error.code).toBe('agent_permission_denied');
  });

  it('preserves do-not-email and missing-variable protections during prepare', () => {
    const repo = createTestRepository();
    const blocked = repo.createContact({ firstName: 'No', lastName: 'Mail', email: 'no@example.test', doNotEmail: true });
    const sendable = repo.createContact({ firstName: 'Maya', lastName: 'Patel', email: 'maya@example.test' });

    const blockedResult = prepareDirectEmailTool(
      repo,
      { contactIds: [blocked.id], subject: 'Hi', body: 'Hello', instructorName: 'Alex' },
      agentSettings({ prepareEmail: true })
    );
    const missingResult = prepareDirectEmailTool(
      repo,
      { contactIds: [sendable.id], subject: 'Class {{courseName}}', body: 'Hello', instructorName: 'Alex' },
      agentSettings({ prepareEmail: true })
    );

    expect(blockedResult.ok).toBe(false);
    if (!blockedResult.ok) expect(blockedResult.error.code).toBe('validation_failed');
    expect(missingResult.ok).toBe(false);
    if (!missingResult.ok) expect(missingResult.error.code).toBe('validation_failed');
  });

  it('records communication history for accepted and failed direct sends', async () => {
    const repo = createTestRepository();
    const accepted = repo.createContact({ firstName: 'Maya', lastName: 'Patel', email: 'maya@example.test' });
    const failed = repo.createContact({ firstName: 'Lee', lastName: 'Morgan', email: 'lee@example.test' });
    sendOutboundEmail
      .mockResolvedValueOnce({
        providerMessage: 'accepted-1',
        originalRecipient: 'maya@example.test',
        effectiveRecipient: 'maya@example.test',
        testMode: false,
        finalText: 'Hello Maya Patel',
        finalHtml: ''
      })
      .mockRejectedValueOnce(new Error('SMTP rejected'));

    const prepared = prepareDirectEmailTool(
      repo,
      { contactIds: [accepted.id, failed.id], subject: 'Hi {{firstName}}', body: 'Hello {{fullName}}', instructorName: 'Alex' },
      agentSettings({ prepareEmail: true })
    );
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;

    const result = await commitDirectEmailTool(
      repo,
      { approvalId: prepared.data.approvalId, confirmationText: prepared.data.confirmationText },
      agentSettings({ sendEmail: true })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toMatchObject({ sent: 1, failed: 1 });
    expect(repo.listCommunications()).toMatchObject([
      { contactId: failed.id, status: 'failed', originalRecipient: 'lee@example.test', effectiveRecipient: 'lee@example.test' },
      { contactId: accepted.id, status: 'accepted', originalRecipient: 'maya@example.test', effectiveRecipient: 'maya@example.test' }
    ]);
  });

  it('preserves redirected recipient fields for direct sends in email test mode', async () => {
    const repo = createTestRepository();
    const contact = repo.createContact({ firstName: 'Maya', lastName: 'Patel', email: 'maya@example.test' });
    sendOutboundEmail.mockResolvedValueOnce({
      providerMessage: 'test-accepted',
      originalRecipient: 'maya@example.test',
      effectiveRecipient: 'safe@example.test',
      testMode: true,
      finalText: '[TEST MODE]\nHello Maya',
      finalHtml: ''
    });
    const settings = agentSettings({ prepareEmail: true, sendEmail: true }, true, { emailTestModeEnabled: true });
    const prepared = prepareDirectEmailTool(
      repo,
      { contactIds: [contact.id], subject: 'Hi', body: 'Hello {{firstName}}', instructorName: 'Alex' },
      settings
    );
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;

    const result = await commitDirectEmailTool(repo, { approvalId: prepared.data.approvalId, confirmationText: prepared.data.confirmationText }, settings);

    expect(result.ok).toBe(true);
    expect(repo.listCommunications()[0]).toMatchObject({
      originalRecipient: 'maya@example.test',
      effectiveRecipient: 'safe@example.test',
      testMode: true,
      body: '[TEST MODE]\nHello Maya'
    });
  });

  it('fails closed when contact email changes after direct email prepare', async () => {
    const repo = createTestRepository();
    const contact = repo.createContact({ firstName: 'Maya', lastName: 'Patel', email: 'maya@example.test' });
    const prepared = prepareDirectEmailTool(
      repo,
      { contactIds: [contact.id], subject: 'Hi {{firstName}}', body: 'Hello {{fullName}}', instructorName: 'Alex' },
      agentSettings({ prepareEmail: true })
    );
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    repo.updateContact(contact.id, { firstName: 'Maya', lastName: 'Patel', email: 'changed@example.test' });

    const result = await commitDirectEmailTool(
      repo,
      { approvalId: prepared.data.approvalId, confirmationText: prepared.data.confirmationText },
      agentSettings({ sendEmail: true })
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('approval_changed');
    expect(sendOutboundEmail).not.toHaveBeenCalled();
    expect(repo.listCommunications()).toHaveLength(0);
    expect(repo.listCommunications()).not.toEqual(expect.arrayContaining([expect.objectContaining({ originalRecipient: 'changed@example.test' })]));
  });

  it('MCP commit handlers await async tool envelopes before wrapping content', async () => {
    vi.resetModules();
    vi.doMock('../src/lib/server/app.js', () => ({ repo: {} }));
    vi.doMock('../src/lib/server/agent/tools/communications.js', () => ({
      prepareDirectEmailTool: vi.fn(),
      commitDirectEmailTool: vi.fn(async () => ({ ok: true, data: { sent: 1 }, warnings: [], nextActions: [], labels: {} }))
    }));
    vi.doMock('../src/lib/server/agent/tools/campaigns.js', () => ({
      prepareSendDueCampaignsTool: vi.fn(),
      commitSendDueCampaignsTool: vi.fn(async () => ({ ok: true, data: { sent: 2 }, warnings: [], nextActions: [], labels: {} }))
    }));

    const { createMcpServer } = await import('../src/mcp/server');
    const server = createMcpServer() as unknown as {
      _registeredTools: Record<string, { handler: (input: { approvalId: string; confirmationText: string }) => Promise<{ content: Array<{ text: string }> }> }>;
    };

    const direct = await server._registeredTools.commit_direct_email.handler({ approvalId: 'appr_1', confirmationText: 'APPROVE SEND appr_1' });
    const campaigns = await server._registeredTools.commit_send_due_campaigns.handler({
      approvalId: 'appr_2',
      confirmationText: 'APPROVE SEND appr_2'
    });

    expect(JSON.parse(direct.content[0].text)).toMatchObject({ ok: true, data: { sent: 1 } });
    expect(JSON.parse(direct.content[0].text)).not.toEqual({});
    expect(JSON.parse(campaigns.content[0].text)).toMatchObject({ ok: true, data: { sent: 2 } });
    expect(JSON.parse(campaigns.content[0].text)).not.toEqual({});
  });
});

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
