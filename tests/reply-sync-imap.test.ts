import { beforeEach, describe, expect, test, vi } from 'vitest';

const client = vi.hoisted(() => ({
  connect: vi.fn(),
  mailboxOpen: vi.fn(),
  fetch: vi.fn(),
  logout: vi.fn(),
  on: vi.fn()
}));

const repo = vi.hoisted(() => ({
  listRecentCommunicationMessageIds: vi.fn(),
  recordCommunicationReply: vi.fn()
}));

const settings = vi.hoisted(() => ({
  replySyncHost: 'imap.example.com',
  replySyncPort: '993',
  replySyncTls: true,
  replySyncAllowSelfSignedCertificate: false,
  replySyncUsername: 'user@example.com',
  replySyncPasswordConfigured: true,
  replySyncMode: 'imap' as 'imap' | 'disabled'
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
    settings.replySyncMode = 'imap';
    settings.replySyncPasswordConfigured = true;
    settings.replySyncHost = 'imap.example.com';
    settings.replySyncPort = '993';
    settings.replySyncTls = true;
    settings.replySyncAllowSelfSignedCertificate = false;
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

  test('allows the Proton Bridge certificate only for a loopback IMAP host', async () => {
    settings.replySyncHost = '127.0.0.1';
    settings.replySyncPort = '1143';
    settings.replySyncTls = false;
    settings.replySyncAllowSelfSignedCertificate = true;
    const { ImapFlow } = await import('imapflow');
    const { syncRepliesNow } = await import('../src/lib/server/reply-sync');

    await syncRepliesNow();

    expect(ImapFlow).toHaveBeenCalledWith(expect.objectContaining({
      host: '127.0.0.1',
      port: 1143,
      secure: false,
      tls: { rejectUnauthorized: false }
    }));
    expect(client.on).toHaveBeenCalledWith('error', expect.any(Function));
  });

  test('keeps certificate verification enabled for non-loopback hosts', async () => {
    settings.replySyncHost = 'imap.example.com';
    settings.replySyncAllowSelfSignedCertificate = true;
    const { ImapFlow } = await import('imapflow');
    const { syncRepliesNow } = await import('../src/lib/server/reply-sync');

    await syncRepliesNow();

    expect(ImapFlow).toHaveBeenCalledWith(expect.objectContaining({
      tls: { rejectUnauthorized: true }
    }));
  });

  test('returns not configured before opening IMAP', async () => {
    settings.replySyncPasswordConfigured = false;
    const { syncRepliesNow } = await import('../src/lib/server/reply-sync');

    await expect(syncRepliesNow()).resolves.toMatchObject({ status: 'not_configured' });

    expect(client.connect).not.toHaveBeenCalled();
  });

  test('returns disabled before opening IMAP when reply sync is off', async () => {
    settings.replySyncMode = 'disabled';
    const { syncRepliesNow } = await import('../src/lib/server/reply-sync');

    await expect(syncRepliesNow()).resolves.toMatchObject({ status: 'disabled' });

    expect(client.connect).not.toHaveBeenCalled();
  });
});
