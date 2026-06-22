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
        providerMessage: 'accepted-first'
      }
    ]);
    expect(repo.listCommunications()).toHaveLength(2);
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
});
