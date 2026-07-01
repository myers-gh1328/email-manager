import { describe, expect, test } from 'vitest';
import { replySyncConfigured, syncRepliesWithMailbox, type ReplySyncMailbox } from '../src/lib/server/reply-sync';
import { createTestRepository } from './repository-helpers';

describe('reply sync', () => {
  test('reports configured only when required IMAP settings are complete', () => {
    expect(replySyncConfigured({ replySyncMode: 'imap', replySyncHost: '', replySyncUsername: 'user', replySyncPasswordConfigured: true })).toBe(false);
    expect(replySyncConfigured({ replySyncMode: 'imap', replySyncHost: 'imap.example.com', replySyncUsername: '', replySyncPasswordConfigured: true })).toBe(false);
    expect(replySyncConfigured({ replySyncMode: 'imap', replySyncHost: 'imap.example.com', replySyncUsername: 'user', replySyncPasswordConfigured: false })).toBe(false);
    expect(replySyncConfigured({ replySyncMode: 'disabled', replySyncHost: 'imap.example.com', replySyncUsername: 'user', replySyncPasswordConfigured: true })).toBe(false);
    expect(replySyncConfigured({ replySyncMode: 'imap', replySyncHost: 'imap.example.com', replySyncUsername: 'user', replySyncPasswordConfigured: true })).toBe(true);
  });

  test('does not fetch the mailbox when there are no outbound message ids', async () => {
    const mailbox = fakeMailbox([]);
    const repo = {
      listRecentCommunicationMessageIds: () => [],
      recordCommunicationReply: () => {
        throw new Error('should not record replies');
      }
    };

    await expect(syncRepliesWithMailbox(repo, mailbox)).resolves.toEqual({
      status: 'synced',
      checked: 0,
      imported: 0,
      matched: 0,
      skipped: 0
    });
  });

  test('matches replies through a bounded recent message-id lookup', async () => {
    const repo = createTestRepository();
    const contact = repo.createContact({ firstName: 'Maya', lastName: 'Patel', email: 'maya@example.com' });
    const communication = repo.recordCommunication({
      contactId: contact.id,
      channel: 'email',
      source: 'direct',
      subject: 'Please confirm',
      body: 'Can you confirm?',
      status: 'accepted',
      messageId: '<recent-message@example.com>'
    });
    const listAll = repo.listCommunicationMessageIds.bind(repo);
    repo.listCommunicationMessageIds = () => {
      throw new Error('reply sync should not load every sent message id');
    };

    const result = await syncRepliesWithMailbox(
      repo,
      fakeMailbox([
        {
          providerKey: 'inbox:recent',
          providerMessageId: '<reply-recent@example.com>',
          inReplyTo: '<recent-message@example.com>',
          fromEmail: 'maya@example.com',
          subject: 'Re: Please confirm',
          textBody: 'Confirmed.',
          receivedAt: '2026-06-22T13:00:00.000Z'
        }
      ])
    );

    repo.listCommunicationMessageIds = listAll;
    expect(result).toMatchObject({ checked: 1, imported: 1, matched: 1 });
    expect(repo.listContactCommunications(contact.id)[0]).toMatchObject({ id: communication.id, replyCount: 1 });
  });

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

  test('matches replies through References headers', async () => {
    const repo = createTestRepository();
    const contact = repo.createContact({ firstName: 'Maya', lastName: 'Patel', email: 'maya@example.com' });
    repo.recordCommunication({
      contactId: contact.id,
      channel: 'email',
      source: 'direct',
      subject: 'Please confirm',
      body: 'Can you confirm?',
      status: 'accepted',
      messageId: '<app-reference@example.com>'
    });

    const result = await syncRepliesWithMailbox(
      repo,
      fakeMailbox([
        {
          providerKey: 'inbox:3',
          providerMessageId: '<reply-3@example.com>',
          references: ['<other@example.com>', '<app-reference@example.com>'],
          textBody: 'Reference match.',
          receivedAt: '2026-06-22T14:00:00.000Z'
        }
      ])
    );

    expect(result).toMatchObject({ checked: 1, matched: 1, imported: 1 });
    expect(repo.listContactCommunications(contact.id)[0].replies[0].snippet).toBe('Reference match.');
  });
});

function fakeMailbox(messages: Awaited<ReturnType<ReplySyncMailbox['fetchRecent']>>): ReplySyncMailbox {
  return {
    fetchRecent: async () => messages,
    close: async () => undefined
  };
}
