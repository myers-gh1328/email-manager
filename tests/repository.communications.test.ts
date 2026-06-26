import { describe, expect, test } from 'vitest';
import { createTestRepository } from './repository-helpers';

describe('repository communications', () => {
  test('creates indexes for scalable history pagination and filters', () => {
    const repo = createTestRepository();
    const db = (repo as unknown as { db: { prepare: (sql: string) => { all: (...args: unknown[]) => Array<{ name: string }> } } }).db;

    const indexNames = db
      .prepare("select name from sqlite_master where type = 'index' and tbl_name = 'communications'")
      .all()
      .map((row) => row.name);

    expect(indexNames).toEqual(
      expect.arrayContaining([
        'idx_communications_created',
        'idx_communications_contact_created',
        'idx_communications_source_created',
        'idx_communications_status_created'
      ])
    );
  });

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

  test('loads one communication with body and replies for the history detail view', () => {
    const repo = createTestRepository();
    const contact = repo.createContact({ firstName: 'Maya', lastName: 'Patel', email: 'maya@example.com' });
    const communication = repo.recordCommunication({
      contactId: contact.id,
      channel: 'email',
      source: 'direct',
      subject: 'Pool reminder',
      body: 'Full rendered email body.',
      status: 'accepted',
      messageId: '<detail@example.com>'
    });
    repo.recordCommunicationReply({
      communicationId: communication.id,
      providerKey: 'inbox:detail',
      fromEmail: 'maya@example.com',
      subject: 'Re: Pool reminder',
      textBody: 'I will be there.',
      receivedAt: '2026-06-22T12:00:00.000Z'
    });

    expect(repo.getCommunication(communication.id)).toMatchObject({
      id: communication.id,
      contactId: contact.id,
      contactName: 'Maya Patel',
      subject: 'Pool reminder',
      body: 'Full rendered email body.',
      replies: [
        {
          fromEmail: 'maya@example.com',
          subject: 'Re: Pool reminder',
          textBody: 'I will be there.'
        }
      ]
    });
  });

  test('loads scheduled class context for campaign communication detail', () => {
    const repo = createTestRepository();
    const contact = repo.createContact({ firstName: 'Maya', lastName: 'Patel', email: 'maya@example.com' });
    const course = repo.createCourseType({ name: 'Open Water' });
    const session = repo.createClassSession({ courseTypeId: course.id, startsOn: '2026-08-02', location: 'Pool' });
    const template = repo.createTemplate({ name: 'Reminder', subject: 'Reminder', body: 'Details.' });
    const campaign = repo.createCampaign({
      classSessionId: session.id,
      templateId: template.id,
      name: 'Pool reminder',
      scheduledFor: '2026-08-01T13:00:00.000Z',
      approved: true
    });
    const communication = repo.recordCommunication({
      contactId: contact.id,
      channel: 'email',
      source: 'campaign',
      sourceId: campaign.id,
      subject: 'Pool reminder',
      body: 'Full rendered email body.',
      status: 'accepted'
    });

    expect(repo.getCommunication(communication.id)).toMatchObject({
      id: communication.id,
      source: 'campaign',
      sourceId: campaign.id,
      classSessionId: session.id,
      className: 'Open Water'
    });
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

  test('keeps paginated history rows summary-only while preserving reply counts', () => {
    const repo = createTestRepository();
    const contact = repo.createContact({ firstName: 'Maya', lastName: 'Patel', email: 'maya@example.com' });
    const communication = repo.recordCommunication({
      contactId: contact.id,
      channel: 'email',
      source: 'direct',
      subject: 'Summary row',
      body: 'Full body belongs on the detail page.',
      status: 'accepted'
    });
    repo.recordCommunicationReply({
      communicationId: communication.id,
      providerKey: 'inbox:summary',
      fromEmail: 'maya@example.com',
      textBody: 'Reply text belongs on the detail page.',
      receivedAt: '2026-06-22T12:00:00.000Z'
    });

    const [item] = repo.listCommunicationsPage({ search: 'summary' }).items;

    expect(item).toMatchObject({
      id: communication.id,
      subject: 'Summary row',
      body: '',
      replies: [],
      replyCount: 1,
      unreviewedReplyCount: 1,
      acknowledgedAt: '2026-06-22T12:00:00.000Z'
    });
  });

  test('filters communication history to emails needing a reply', () => {
    const repo = createTestRepository();
    const maya = repo.createContact({ firstName: 'Maya', lastName: 'Patel', email: 'maya@example.com' });
    const jo = repo.createContact({ firstName: 'Jo', lastName: 'Rivera', email: 'jo@example.com' });
    const needsReply = repo.recordCommunication({
      contactId: maya.id,
      channel: 'email',
      source: 'direct',
      subject: 'Needs answer',
      body: 'Please reply.',
      status: 'accepted'
    });
    const handledReply = repo.recordCommunication({
      contactId: jo.id,
      channel: 'email',
      source: 'direct',
      subject: 'Already handled',
      body: 'Thanks.',
      status: 'accepted'
    });
    repo.recordCommunicationReply({
      communicationId: needsReply.id,
      providerKey: 'inbox:needs-reply',
      fromEmail: 'maya@example.com',
      textBody: 'Question for you.',
      receivedAt: '2026-06-22T12:00:00.000Z'
    });
    const reply = repo.recordCommunicationReply({
      communicationId: handledReply.id,
      providerKey: 'inbox:handled-reply',
      fromEmail: 'jo@example.com',
      textBody: 'All good.',
      receivedAt: '2026-06-22T12:01:00.000Z'
    });
    repo.markCommunicationReplyReviewed(reply.id);

    const page = repo.listCommunicationsPage({ replyStatus: 'needs_reply' });

    expect(page.replyStatus).toBe('needs_reply');
    expect(page.total).toBe(1);
    expect(page.items).toMatchObject([
      {
        id: needsReply.id,
        contactName: 'Maya Patel',
        subject: 'Needs answer',
        replyCount: 1,
        unreviewedReplyCount: 1
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
