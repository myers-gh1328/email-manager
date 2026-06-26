import { beforeEach, describe, expect, test, vi } from 'vitest';

const client = vi.hoisted(() => ({
  connect: vi.fn(),
  mailboxOpen: vi.fn(),
  fetch: vi.fn(),
  logout: vi.fn()
}));

const repo = vi.hoisted(() => ({
  listRecentCommunicationMessageIds: vi.fn(),
  recordCommunicationReply: vi.fn()
}));

const settings = vi.hoisted(() => ({
  replySyncHost: 'imap.example.com',
  replySyncPort: '993',
  replySyncTls: true,
  replySyncUsername: 'user@example.com',
  replySyncPasswordConfigured: true
}));

vi.mock('imapflow', () => ({
  ImapFlow: vi.fn(() => client)
}));

vi.mock('mailparser', () => ({
  simpleParser: vi.fn(async () => ({
    messageId: '<reply@example.com>',
    inReplyTo: '<sent@example.com>',
    references: '<sent@example.com>',
    from: { value: [{ name: 'Maya Patel', address: 'maya@example.com' }] },
    subject: 'Re: Sent',
    text: 'Confirmed.',
    html: '<p>Confirmed.</p>',
    date: new Date('2026-06-22T15:00:00.000Z')
  }))
}));

vi.mock('../src/lib/server/app', () => ({ repo }));
vi.mock('../src/lib/server/settings', () => ({
  getSettings: () => settings,
  getReplySyncPassword: () => 'secret'
}));

describe('reply sync IMAP adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    settings.replySyncPasswordConfigured = true;
    repo.listRecentCommunicationMessageIds.mockReturnValue([{ id: 'communication-1', messageId: '<sent@example.com>' }]);
    repo.recordCommunicationReply.mockReturnValue({ created: true });
    client.connect.mockResolvedValue(undefined);
    client.mailboxOpen.mockResolvedValue({ exists: 2, uidValidity: 99 });
    client.logout.mockResolvedValue(undefined);
    client.fetch.mockImplementation(async function* () {
      yield { uid: 1, source: Buffer.from('raw email') };
      yield { uid: 2 };
    });
  });

  test('opens INBOX read-only and imports parsed matching replies', async () => {
    const { syncRepliesNow } = await import('../src/lib/server/reply-sync');

    await expect(syncRepliesNow()).resolves.toEqual({
      status: 'synced',
      checked: 1,
      imported: 1,
      matched: 1,
      skipped: 0
    });

    expect(client.connect).toHaveBeenCalledOnce();
    expect(client.mailboxOpen).toHaveBeenCalledWith('INBOX', { readOnly: true });
    expect(client.fetch).toHaveBeenCalledWith('1:*', { uid: true, source: true });
    expect(repo.recordCommunicationReply).toHaveBeenCalledWith({
      communicationId: 'communication-1',
      providerKey: '99:1',
      providerMessageId: '<reply@example.com>',
      fromName: 'Maya Patel',
      fromEmail: 'maya@example.com',
      subject: 'Re: Sent',
      textBody: 'Confirmed.',
      htmlBody: '<p>Confirmed.</p>',
      snippet: 'Confirmed.',
      receivedAt: '2026-06-22T15:00:00.000Z'
    });
    expect(client.logout).toHaveBeenCalledOnce();
  });

  test('returns not configured before opening IMAP', async () => {
    settings.replySyncPasswordConfigured = false;
    const { syncRepliesNow } = await import('../src/lib/server/reply-sync');

    await expect(syncRepliesNow()).resolves.toMatchObject({ status: 'not_configured' });

    expect(client.connect).not.toHaveBeenCalled();
  });
});
