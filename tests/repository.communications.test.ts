import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, test } from 'vitest';
import { AppRepository } from '../src/lib/server/repository';
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
    expect(history.unhandledReplyCount).toBe(1);
    expect(history.acknowledgedAt).toBe('2026-06-22T12:00:00.000Z');
    expect(history.replies[0]).toMatchObject({
      fromEmail: 'maya@example.com',
      snippet: 'Got it.'
    });

    repo.markCommunicationReplyHandled(history.replies[0].id);
    expect(repo.listContactCommunications(contact.id)[0].unhandledReplyCount).toBe(0);
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

  test('updates one scheduled communication with retry counts instead of duplicating the full body', () => {
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
    repo.enrollContact(session.id, contact.id);
    repo.ensurePendingDeliveries(campaign.id);

    const firstAttempt = repo.claimNextEligibleDelivery(campaign.id, { source: 'manual', subject: '', body: '' })!;
    repo.finalizeDeliveryAttemptFailed({
      deliveryId: firstAttempt.id,
      attemptId: firstAttempt.attemptId!,
      failureKind: 'transient',
      failureSummary: 'SMTP timed out',
      retryable: false
    });
    const firstCommunication = repo.recordCommunication({
      contactId: contact.id,
      channel: 'email',
      source: 'campaign',
      sourceId: campaign.id,
      deliveryAttemptId: firstAttempt.attemptId,
      originalRecipient: contact.email,
      effectiveRecipient: contact.email,
      subject: 'Pool reminder',
      body: 'Canonical rendered email body.',
      status: 'failed',
      errorMessage: 'SMTP timed out'
    });

    repo.retryCampaignDeliveries(campaign.id, [contact.id]);
    const secondAttempt = repo.claimNextEligibleDelivery(campaign.id, { source: 'manual', subject: '', body: '' })!;
    repo.finalizeDeliveryAttemptFailed({
      deliveryId: secondAttempt.id,
      attemptId: secondAttempt.attemptId!,
      failureKind: 'transient',
      failureSummary: 'SMTP timed out again',
      retryable: false
    });
    repo.recordCommunication({
      contactId: contact.id,
      channel: 'email',
      source: 'campaign',
      sourceId: campaign.id,
      deliveryAttemptId: secondAttempt.attemptId,
      originalRecipient: contact.email,
      effectiveRecipient: contact.email,
      subject: 'Pool reminder retry',
      body: 'Duplicate body should not be stored as another history row.',
      status: 'failed',
      errorMessage: 'SMTP timed out again'
    });

    repo.retryCampaignDeliveries(campaign.id, [contact.id]);
    const thirdAttempt = repo.claimNextEligibleDelivery(campaign.id, { source: 'manual', subject: '', body: '' })!;
    repo.finalizeDeliveryAttemptAccepted({
      deliveryId: thirdAttempt.id,
      attemptId: thirdAttempt.attemptId!,
      providerMessage: 'provider-accepted'
    });
    const finalCommunication = repo.recordCommunication({
      contactId: contact.id,
      channel: 'email',
      source: 'campaign',
      sourceId: campaign.id,
      deliveryAttemptId: thirdAttempt.attemptId,
      originalRecipient: contact.email,
      effectiveRecipient: contact.email,
      subject: 'Pool reminder accepted',
      body: 'Accepted retry body should not replace the canonical body.',
      status: 'accepted',
      messageId: '<accepted@example.com>',
      providerMessage: 'provider-accepted'
    });

    expect(finalCommunication.id).toBe(firstCommunication.id);
    expect(repo.listCommunications()).toHaveLength(1);
    expect(repo.getCommunication(firstCommunication.id)).toMatchObject({
      subject: 'Pool reminder',
      body: 'Canonical rendered email body.',
      status: 'accepted',
      providerMessage: 'provider-accepted',
      errorMessage: undefined,
      deliveryAttemptCount: 3,
      failedAttemptCount: 2
    });
    expect(repo.listCommunicationsPage({ sourceId: campaign.id })).toMatchObject({
      total: 1,
      items: [
        {
          id: firstCommunication.id,
          status: 'accepted',
          body: '',
          deliveryAttemptCount: 3,
          failedAttemptCount: 2
        }
      ]
    });
  });

  test('migration collapses existing duplicate scheduled communication rows by delivery', () => {
    const dbPath = join(mkdtempSync(join(tmpdir(), 'scuba-email-legacy-')), 'app.sqlite');
    const db = new DatabaseSync(dbPath);
    db.exec(`
      create table contacts (
        id text primary key,
        first_name text not null,
        last_name text not null,
        email text not null,
        phone text not null default '',
        notes text not null default '',
        do_not_email integer not null default 0,
        created_at text not null
      );
      create table delivery_attempts (
        id text primary key,
        delivery_id text not null,
        attempt_number integer not null,
        source text not null,
        status text not null,
        claimed_at text not null,
        finalized_at text,
        claim_expires_at text not null,
        subject text not null default '',
        body text not null default '',
        provider_message text not null default '',
        failure_kind text not null default '',
        failure_summary text not null default '',
        retry_policy_max_auto_retries integer not null default 3,
        retry_policy_backoff text not null default '[300,1800,7200]'
      );
      create table campaign_deliveries (
        id text primary key,
        campaign_id text not null,
        recipient_id text not null,
        status text not null,
        created_at text not null,
        sent_at text,
        provider_message text,
        error_message text,
        attempt_count integer not null default 0,
        last_attempt_at text,
        next_attempt_at text,
        claim_expires_at text,
        failure_kind text not null default '',
        failure_summary text not null default '',
        needs_audit_repair integer not null default 0,
        retry_policy_max_auto_retries integer not null default 3,
        retry_policy_backoff text not null default '[300,1800,7200]'
      );
      create table communications (
        id text primary key,
        contact_id text not null,
        channel text not null,
        source text not null,
        source_id text,
        original_recipient text not null default '',
        effective_recipient text not null default '',
        test_mode integer not null default 0,
        subject text not null,
        body text not null,
        status text not null,
        sent_at text,
        message_id text not null default '',
        provider_message text,
        error_message text,
        delivery_attempt_id text,
        created_at text not null
      );
      insert into contacts (id, first_name, last_name, email, created_at)
      values ('contact-1', 'Maya', 'Patel', 'maya@example.com', '2026-06-20T10:00:00.000Z');
      insert into delivery_attempts (id, delivery_id, attempt_number, source, status, claimed_at, finalized_at, claim_expires_at)
      values
        ('attempt-1', 'delivery-1', 1, 'manual', 'failed', '2026-06-20T10:00:00.000Z', '2026-06-20T10:01:00.000Z', '2026-06-20T10:15:00.000Z'),
        ('attempt-2', 'delivery-1', 2, 'manual', 'failed', '2026-06-20T10:10:00.000Z', '2026-06-20T10:11:00.000Z', '2026-06-20T10:25:00.000Z'),
        ('attempt-3', 'delivery-1', 3, 'manual', 'accepted', '2026-06-20T10:20:00.000Z', '2026-06-20T10:21:00.000Z', '2026-06-20T10:35:00.000Z');
      insert into campaign_deliveries (
        id, campaign_id, recipient_id, status, created_at, sent_at, provider_message, attempt_count
      ) values (
        'delivery-1', 'campaign-1', 'contact-1', 'sent', '2026-06-20T10:00:00.000Z',
        '2026-06-20T10:21:00.000Z', 'provider-accepted', 3
      );
      insert into communications (
        id, contact_id, channel, source, source_id, original_recipient, effective_recipient,
        subject, body, status, message_id, provider_message, error_message, delivery_attempt_id, created_at
      ) values
        ('comm-1', 'contact-1', 'email', 'campaign', 'campaign-1', 'maya@example.com', 'maya@example.com',
          'Reminder', 'Canonical body.', 'failed', '', null, 'SMTP timed out', 'attempt-1', '2026-06-20T10:01:00.000Z'),
        ('comm-2', 'contact-1', 'email', 'campaign', 'campaign-1', 'maya@example.com', 'maya@example.com',
          'Reminder retry', 'Duplicate failed body.', 'failed', '', null, 'SMTP timed out again', 'attempt-2', '2026-06-20T10:11:00.000Z'),
        ('comm-3', 'contact-1', 'email', 'campaign', 'campaign-1', 'maya@example.com', 'maya@example.com',
          'Reminder accepted', 'Duplicate accepted body.', 'accepted', '<accepted@example.com>', 'provider-accepted', null, 'attempt-3', '2026-06-20T10:21:00.000Z');
    `);
    db.close();

    const repo = new AppRepository(dbPath);

    expect(repo.listCommunications()).toHaveLength(1);
    expect(repo.getCommunication('comm-1')).toMatchObject({
      id: 'comm-1',
      subject: 'Reminder',
      body: 'Canonical body.',
      status: 'accepted',
      messageId: '<accepted@example.com>',
      providerMessage: 'provider-accepted',
      deliveryAttemptCount: 3,
      failedAttemptCount: 2
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
      unhandledReplyCount: 1,
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
    repo.markCommunicationReplyHandled(reply.id);

    const page = repo.listCommunicationsPage({ replyStatus: 'needs_reply' });

    expect(page.replyStatus).toBe('needs_reply');
    expect(page.total).toBe(1);
    expect(page.items).toMatchObject([
      {
        id: needsReply.id,
        contactName: 'Maya Patel',
        subject: 'Needs answer',
        replyCount: 1,
        unhandledReplyCount: 1
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

  test('filters communication history by delivery status', () => {
    const repo = createTestRepository();
    const maya = repo.createContact({ firstName: 'Maya', lastName: 'Patel', email: 'maya@example.com' });
    const lee = repo.createContact({ firstName: 'Lee', lastName: 'Morgan', email: 'lee@example.com' });

    repo.recordCommunication({
      contactId: maya.id,
      channel: 'email',
      source: 'direct',
      originalRecipient: 'maya@example.com',
      effectiveRecipient: 'maya@example.com',
      subject: 'Accepted update',
      body: 'Accepted.',
      status: 'accepted'
    });
    repo.recordCommunication({
      contactId: lee.id,
      channel: 'email',
      source: 'direct',
      originalRecipient: 'lee@example.com',
      effectiveRecipient: 'lee@example.com',
      subject: 'Failed update',
      body: 'Failed.',
      status: 'failed',
      errorMessage: 'SMTP rejected'
    });

    const failed = repo.listCommunicationsPage({ status: 'failed' });
    const sent = repo.listCommunicationsPage({ status: 'sent' });

    expect(failed).toMatchObject({
      status: 'failed',
      total: 1,
      items: [{ subject: 'Failed update', status: 'failed' }]
    });
    expect(sent).toMatchObject({
      status: 'sent',
      total: 1,
      items: [{ subject: 'Accepted update', status: 'accepted' }]
    });
  });

  test('filters communication history by email type', () => {
    const repo = createTestRepository();
    const maya = repo.createContact({ firstName: 'Maya', lastName: 'Patel', email: 'maya@example.com' });
    const lee = repo.createContact({ firstName: 'Lee', lastName: 'Morgan', email: 'lee@example.com' });

    repo.recordCommunication({
      contactId: maya.id,
      channel: 'email',
      source: 'direct',
      subject: 'Direct update',
      body: 'Direct.',
      status: 'accepted'
    });
    repo.recordCommunication({
      contactId: lee.id,
      channel: 'email',
      source: 'campaign',
      sourceId: 'campaign-123',
      subject: 'Scheduled update',
      body: 'Scheduled.',
      status: 'accepted'
    });

    const direct = repo.listCommunicationsPage({ type: 'direct' });
    const scheduled = repo.listCommunicationsPage({ type: 'scheduled' });

    expect(direct).toMatchObject({
      type: 'direct',
      total: 1,
      items: [{ subject: 'Direct update', source: 'direct' }]
    });
    expect(scheduled).toMatchObject({
      type: 'scheduled',
      total: 1,
      items: [{ subject: 'Scheduled update', source: 'campaign' }]
    });
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
