import { describe, expect, test } from 'vitest';
import { syncRepliesWithMailbox, type ReplySyncMailbox } from '../src/lib/server/reply-sync';
import { createTestRepository } from './repository-helpers';

describe('reply sync', () => {
  test('imports only inbox messages that reply to app-sent email', async () => {
    const repo = createTestRepository();
    const contact = repo.createContact({ firstName: 'Maya', lastName: 'Patel', email: 'maya@example.com' });
    const communication = repo.recordCommunication({
      contactId: contact.id,
      channel: 'email',
      source: 'direct',
      subject: 'Please confirm',
      body: 'Can you confirm?',
      status: 'accepted',
      messageId: '<app-message@example.com>'
    });
    const mailbox = fakeMailbox([
      {
        providerKey: 'inbox:1',
        providerMessageId: '<reply-1@example.com>',
        inReplyTo: '<app-message@example.com>',
        fromEmail: 'maya@example.com',
        subject: 'Re: Please confirm',
        textBody: 'Confirmed.',
        receivedAt: '2026-06-22T13:00:00.000Z'
      },
      {
        providerKey: 'inbox:2',
        providerMessageId: '<unrelated@example.com>',
        subject: 'Other mail',
        textBody: 'Not for this app.',
        receivedAt: '2026-06-22T13:01:00.000Z'
      }
    ]);

    await expect(syncRepliesWithMailbox(repo, mailbox)).resolves.toEqual({
      status: 'synced',
      checked: 2,
      imported: 1,
      matched: 1,
      skipped: 1
    });
    await expect(syncRepliesWithMailbox(repo, mailbox)).resolves.toMatchObject({ imported: 0, matched: 1 });

    const history = repo.listContactCommunications(contact.id)[0];
    expect(history.id).toBe(communication.id);
    expect(history.replyCount).toBe(1);
    expect(history.replies[0]).toMatchObject({
      providerKey: 'inbox:1',
      fromEmail: 'maya@example.com',
      snippet: 'Confirmed.'
    });
  });
});

function fakeMailbox(messages: Awaited<ReturnType<ReplySyncMailbox['fetchRecent']>>): ReplySyncMailbox {
  return {
    fetchRecent: async () => messages,
    close: async () => undefined
  };
}
