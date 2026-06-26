import { describe, expect, test } from 'vitest';
import { createTestRepository } from './repository-helpers';

describe('repository communications', () => {
  test('records outbound communication history by contact with newest first', () => {
    const repo = createTestRepository();
    const contact = repo.createContact({ firstName: 'Maya', lastName: 'Patel', email: 'maya@example.com' });

    repo.recordCommunication({
      contactId: contact.id,
      channel: 'email',
      source: 'direct',
      subject: 'First note',
      body: 'Earlier message.',
      status: 'accepted',
      messageId: '<app-first@example.com>',
      providerMessage: 'accepted-first'
    });
    repo.recordCommunication({
      contactId: contact.id,
      channel: 'email',
      source: 'campaign',
      sourceId: 'campaign-123',
      subject: 'Second note',
      body: 'Later message.',
      status: 'failed',
      errorMessage: 'temporary SMTP error'
    });

    expect(repo.listContactCommunications(contact.id)).toMatchObject([
      {
        contactId: contact.id,
        contactName: 'Maya Patel',
        contactEmail: 'maya@example.com',
        channel: 'email',
        source: 'campaign',
        sourceId: 'campaign-123',
        subject: 'Second note',
        body: 'Later message.',
        status: 'failed',
        errorMessage: 'temporary SMTP error'
      },
      {
        contactId: contact.id,
        contactName: 'Maya Patel',
        contactEmail: 'maya@example.com',
        channel: 'email',
        source: 'direct',
        subject: 'First note',
        body: 'Earlier message.',
        status: 'accepted',
        messageId: '<app-first@example.com>',
        providerMessage: 'accepted-first'
      }
    ]);
    expect(repo.listCommunications()).toHaveLength(2);
    expect(repo.listCommunicationMessageIds()).toEqual([{ id: expect.any(String), messageId: '<app-first@example.com>' }]);
  });

  test('records reply acknowledgements idempotently', () => {
    const repo = createTestRepository();
    const contact = repo.createContact({ firstName: 'Maya', lastName: 'Patel', email: 'maya@example.com' });
    const communication = repo.recordCommunication({
      contactId: contact.id,
      channel: 'email',
      source: 'direct',
      subject: 'Can you confirm?',
      body: 'Please reply when you see this.',
      status: 'accepted',
      messageId: '<app-reply-key@example.com>'
    });

    const first = repo.recordCommunicationReply({
      communicationId: communication.id,
      providerKey: 'inbox:42',
      providerMessageId: '<reply@example.com>',
      fromEmail: 'maya@example.com',
      subject: 'Re: Can you confirm?',
      textBody: 'Got it.',
      receivedAt: '2026-06-22T12:00:00.000Z'
    });
    const duplicate = repo.recordCommunicationReply({
      communicationId: communication.id,
      providerKey: 'inbox:42',
      textBody: 'Got it again.',
      receivedAt: '2026-06-22T12:01:00.000Z'
    });

    expect(first.created).toBe(true);
    expect(duplicate.created).toBe(false);
    const history = repo.listContactCommunications(contact.id)[0];
    expect(history.replyCount).toBe(1);
    expect(history.unreviewedReplyCount).toBe(1);
    expect(history.acknowledgedAt).toBe('2026-06-22T12:00:00.000Z');
    expect(history.replies[0]).toMatchObject({
      fromEmail: 'maya@example.com',
      snippet: 'Got it.'
    });

    repo.markCommunicationReplyReviewed(history.replies[0].id);
    expect(repo.listContactCommunications(contact.id)[0].unreviewedReplyCount).toBe(0);
  });

  test('lists communication history with pagination and search for summary pages', () => {
    const repo = createTestRepository();
    const maya = repo.createContact({ firstName: 'Maya', lastName: 'Patel', email: 'maya@example.com' });
    const jo = repo.createContact({ firstName: 'Jo', lastName: 'Rivera', email: 'jo@example.com' });

    repo.recordCommunication({
      contactId: maya.id,
      channel: 'email',
      source: 'direct',
      subject: 'Pool reminder',
      body: 'Earlier Maya body.',
      status: 'accepted'
    });
    repo.recordCommunication({
      contactId: jo.id,
      channel: 'email',
      source: 'direct',
      subject: 'Schedule change',
      body: 'Jo body.',
      status: 'accepted'
    });
    repo.recordCommunication({
      contactId: maya.id,
      channel: 'email',
      source: 'campaign',
      subject: 'Final details',
      body: 'Later Maya body.',
      status: 'failed',
      errorMessage: 'SMTP rejected'
    });

    const page = repo.listCommunicationsPage({ limit: 1, offset: 0, search: 'maya' });

    expect(page.total).toBe(2);
    expect(page.limit).toBe(1);
    expect(page.offset).toBe(0);
    expect(page.items).toMatchObject([
      {
        contactId: maya.id,
        contactName: 'Maya Patel',
        subject: 'Final details',
        status: 'failed',
        errorMessage: 'SMTP rejected'
      }
    ]);
  });

  test('filters communication history by scheduled email source', () => {
    const repo = createTestRepository();
    const maya = repo.createContact({ firstName: 'Maya', lastName: 'Patel', email: 'maya@example.com' });
    const jo = repo.createContact({ firstName: 'Jo', lastName: 'Rivera', email: 'jo@example.com' });

    repo.recordCommunication({
      contactId: maya.id,
      channel: 'email',
      source: 'campaign',
      sourceId: 'campaign-123',
      subject: 'Open Water reminder',
      body: 'Maya body.',
      status: 'accepted'
    });
    repo.recordCommunication({
      contactId: jo.id,
      channel: 'email',
      source: 'campaign',
      sourceId: 'campaign-456',
      subject: 'Rescue reminder',
      body: 'Jo body.',
      status: 'accepted'
    });
    repo.recordCommunication({
      contactId: maya.id,
      channel: 'email',
      source: 'direct',
      subject: 'Direct followup',
      body: 'Direct body.',
      status: 'accepted'
    });

    const page = repo.listCommunicationsPage({ sourceId: 'campaign-123' });

    expect(page.total).toBe(1);
    expect(page.sourceId).toBe('campaign-123');
    expect(page.items).toMatchObject([
      {
        contactId: maya.id,
        source: 'campaign',
        sourceId: 'campaign-123',
        subject: 'Open Water reminder'
      }
    ]);
  });

  test('records redirected test email audits separately from student history', () => {
    const repo = createTestRepository();

    repo.recordEmailTestAudit({
      originalRecipient: 'maya@example.com',
      effectiveRecipient: 'instructor@example.com',
      subject: 'Welcome',
      body: 'Test body',
      providerMessage: 'provider-123'
    });

    expect(repo.listEmailTestAudits()).toMatchObject([
      {
        originalRecipient: 'maya@example.com',
        effectiveRecipient: 'instructor@example.com',
        subject: 'Welcome',
        body: 'Test body',
        providerMessage: 'provider-123'
      }
    ]);
  });

  test('lists redirected test email audits with pagination and search', () => {
    const repo = createTestRepository();

    repo.recordEmailTestAudit({
      originalRecipient: 'maya@example.com',
      effectiveRecipient: 'instructor@example.com',
      subject: 'Pool reminder',
      body: 'Test body',
      providerMessage: 'provider-123'
    });
    repo.recordEmailTestAudit({
      originalRecipient: 'jo@example.com',
      effectiveRecipient: 'instructor@example.com',
      subject: 'Schedule change',
      body: 'Another body',
      providerMessage: 'provider-456'
    });
    repo.recordEmailTestAudit({
      originalRecipient: 'maya@example.com',
      effectiveRecipient: 'instructor@example.com',
      subject: 'Final details',
      body: 'Later body',
      providerMessage: 'provider-789'
    });

    const page = repo.listEmailTestAuditsPage({ limit: 1, offset: 0, search: 'maya' });

    expect(page.total).toBe(2);
    expect(page.limit).toBe(1);
    expect(page.offset).toBe(0);
    expect(page.items).toMatchObject([
      {
        originalRecipient: 'maya@example.com',
        subject: 'Final details',
        providerMessage: 'provider-789'
      }
    ]);
  });
});
