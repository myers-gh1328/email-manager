import { beforeEach, describe, expect, test, vi } from 'vitest';

const repo = {
  listCampaigns: vi.fn(),
  listReadyScheduledEmailsDue: vi.fn(),
  getClassSession: vi.fn(),
  getTemplate: vi.fn(),
  ensurePendingDeliveries: vi.fn(),
  claimNextPendingDelivery: vi.fn(),
  listPendingDeliveries: vi.fn(),
  getContact: vi.fn(),
  markDeliverySent: vi.fn(),
  markDeliveryFailed: vi.fn(),
  recordCommunication: vi.fn()
};

vi.mock('../src/lib/server/app', () => ({ repo }));
vi.mock('../src/lib/server/settings', () => ({
  getSettings: () => ({ schedulerEnabled: true, emailTestModeEnabled: false, instructorName: 'Alex Instructor' })
}));
vi.mock('../src/lib/server/mailer', () => ({
  sendOutboundEmail: vi.fn(async ({ to, text }) => ({
    providerMessage: 'provider-123',
    originalRecipient: to,
    effectiveRecipient: to,
    testMode: false,
    finalText: text,
    finalHtml: '',
    messageId: '<campaign-1@example.com>'
  }))
}));

describe('background campaign communication logging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    repo.listCampaigns.mockReturnValue([
      {
        id: 'campaign-1',
        classSessionId: 'class-1',
        templateId: 'template-1',
        approved: true,
        scheduledFor: '2000-01-01T00:00'
      }
    ]);
    repo.listReadyScheduledEmailsDue.mockReturnValue([
      {
        id: 'campaign-1',
        classSessionId: 'class-1',
        templateId: 'template-1',
        approved: true,
        scheduledFor: '2000-01-01T00:00'
      }
    ]);
    repo.getClassSession.mockReturnValue({
      id: 'class-1',
      courseName: 'Open Water',
      startsOn: '2026-07-12',
      location: 'Pool',
      notes: 'Bring gear.'
    });
    repo.getTemplate.mockReturnValue({
      id: 'template-1',
      subject: 'Welcome {{firstName}}',
      body: 'Hi {{fullName}}, see you at {{classLocation}}.'
    });
    repo.ensurePendingDeliveries.mockReturnValue([{ id: 'delivery-1', recipientId: 'contact-1' }]);
    repo.claimNextPendingDelivery.mockReturnValueOnce({ id: 'delivery-1', recipientId: 'contact-1' }).mockReturnValue(undefined);
    repo.getContact.mockReturnValue({
      id: 'contact-1',
      firstName: 'Maya',
      lastName: 'Patel',
      email: 'maya@example.com'
    });
  });

  test('records a sent communication for successful campaign delivery', async () => {
    const { sendDueCampaigns } = await import('../src/lib/server/background');

    await sendDueCampaigns();

    expect(repo.ensurePendingDeliveries).toHaveBeenCalledWith('campaign-1');
    expect(repo.recordCommunication).toHaveBeenCalledWith({
      contactId: 'contact-1',
      channel: 'email',
      source: 'campaign',
      sourceId: 'campaign-1',
      originalRecipient: 'maya@example.com',
      effectiveRecipient: 'maya@example.com',
      testMode: false,
      subject: 'Welcome Maya',
      body: 'Hi Maya Patel, see you at Pool.',
      status: 'accepted',
      messageId: '<campaign-1@example.com>',
      providerMessage: 'provider-123'
    });
  });

  test('plans due sends from a bounded repository query instead of listing every scheduled email', async () => {
    const { sendDueCampaigns } = await import('../src/lib/server/background');

    await sendDueCampaigns();

    expect(repo.listReadyScheduledEmailsDue).toHaveBeenCalledWith(expect.any(String), { limit: 100 });
    expect(repo.listCampaigns).not.toHaveBeenCalled();
  });

  test('does not run overlapping due-send batches', async () => {
    const { sendOutboundEmail } = await import('../src/lib/server/mailer');
    let releaseSend!: () => void;
    vi.mocked(sendOutboundEmail).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseSend = () =>
            resolve({
              providerMessage: 'provider-123',
              originalRecipient: 'maya@example.com',
              effectiveRecipient: 'maya@example.com',
              testMode: false,
              finalText: 'Hi Maya Patel, see you at Pool.',
              finalHtml: '',
              messageId: '<campaign-1@example.com>'
            });
        })
    );
    const { sendDueCampaigns } = await import('../src/lib/server/background');

    const firstRun = sendDueCampaigns();
    await vi.waitFor(() => expect(sendOutboundEmail).toHaveBeenCalledTimes(1));
    const secondRun = sendDueCampaigns();
    releaseSend();

    await expect(Promise.all([firstRun, secondRun])).resolves.toEqual([1, 0]);
    expect(sendOutboundEmail).toHaveBeenCalledTimes(1);
  });

  test('records attempted recipients when campaign delivery fails', async () => {
    const { sendOutboundEmail } = await import('../src/lib/server/mailer');
    vi.mocked(sendOutboundEmail).mockRejectedValueOnce(new Error('SMTP rejected'));
    const { sendDueCampaigns } = await import('../src/lib/server/background');

    await sendDueCampaigns();

    expect(repo.ensurePendingDeliveries).toHaveBeenCalledWith('campaign-1');
    expect(repo.recordCommunication).toHaveBeenCalledWith({
      contactId: 'contact-1',
      channel: 'email',
      source: 'campaign',
      sourceId: 'campaign-1',
      originalRecipient: 'maya@example.com',
      effectiveRecipient: 'maya@example.com',
      testMode: false,
      subject: 'Welcome Maya',
      body: 'Hi Maya Patel, see you at Pool.',
      status: 'failed',
      errorMessage: 'SMTP rejected'
    });
  });

  test('does not mark delivery failed when sent-state recording fails after SMTP acceptance', async () => {
    repo.markDeliverySent.mockImplementationOnce(() => {
      throw new Error('database unavailable');
    });
    const { sendDueCampaigns } = await import('../src/lib/server/background');

    await expect(sendDueCampaigns()).rejects.toThrow('database unavailable');

    expect(repo.markDeliveryFailed).not.toHaveBeenCalled();
    expect(repo.recordCommunication).not.toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }));
  });

  test('does not record failed communication when accepted-history recording fails after SMTP acceptance', async () => {
    repo.recordCommunication.mockImplementationOnce(() => {
      throw new Error('history unavailable');
    });
    const { sendDueCampaigns } = await import('../src/lib/server/background');

    await expect(sendDueCampaigns()).rejects.toThrow('history unavailable');

    expect(repo.markDeliverySent).toHaveBeenCalledWith('delivery-1', 'provider-123');
    expect(repo.markDeliveryFailed).not.toHaveBeenCalled();
    expect(repo.recordCommunication).toHaveBeenCalledTimes(1);
    expect(repo.recordCommunication).toHaveBeenCalledWith(expect.objectContaining({ status: 'accepted' }));
  });
});
