import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { createTestRepository } from './repository-helpers';
import { AppRepository } from '../src/lib/server/repository';
import { sendDueCampaignsWithDependencies } from '../src/lib/server/send-due-campaigns';
import { baseAppSettings } from './settings-helpers';

describe('repository campaigns and deliveries', () => {
  test('summarizes ready scheduled emails for dashboard without listing every schedule', () => {
    const repo = createTestRepository();
    const course = repo.createCourseType({ name: 'Rescue Diver' });
    const session = repo.createClassSession({ courseTypeId: course.id, startsOn: '2026-08-02', location: 'Pool' });
    const template = repo.createTemplate({ name: 'Reminder', subject: 'Reminder', body: 'Details.' });
    repo.createCampaign({
      classSessionId: session.id,
      templateId: template.id,
      name: 'Due ready',
      scheduledFor: '2026-08-01T13:00:00.000Z',
      approved: true
    });
    repo.createCampaign({
      classSessionId: session.id,
      templateId: template.id,
      name: 'Next ready',
      scheduledFor: '2026-08-03T13:00:00.000Z',
      approved: true
    });
    repo.createCampaign({
      classSessionId: session.id,
      templateId: template.id,
      name: 'Draft due',
      scheduledFor: '2026-08-01T12:00:00.000Z',
      approved: false
    });

    expect(repo.countReadyScheduledEmailsDue('2026-08-02T00:00:00.000Z')).toBe(1);
    expect(repo.getNextReadyScheduledEmail('2026-08-02T00:00:00.000Z')).toMatchObject({
      name: 'Next ready',
      scheduledFor: '2026-08-03T13:00:00.000Z'
    });
  });

  test('lists scheduled emails with pagination and search', () => {
    const repo = createTestRepository();
    const course = repo.createCourseType({ name: 'Rescue Diver' });
    const session = repo.createClassSession({ courseTypeId: course.id, startsOn: '2026-08-02', location: 'Pool' });
    const reminder = repo.createTemplate({ name: 'Reminder', subject: 'Reminder', body: 'Details.' });
    const welcome = repo.createTemplate({ name: 'Welcome', subject: 'Welcome', body: 'Hello.' });
    repo.createCampaign({
      classSessionId: session.id,
      templateId: reminder.id,
      name: 'Rescue prep',
      scheduledFor: '2026-08-01T13:00:00.000Z',
      approved: true
    });
    repo.createCampaign({
      classSessionId: session.id,
      templateId: welcome.id,
      name: 'Welcome note',
      scheduledFor: '2026-07-31T13:00:00.000Z',
      approved: false
    });

    const page = repo.listCampaignsPage({ limit: 1, offset: 0, search: 'prep' });

    expect(page.total).toBe(1);
    expect(page.limit).toBe(1);
    expect(page.offset).toBe(0);
    expect(page.items).toMatchObject([{ name: 'Rescue prep', courseName: 'Rescue Diver' }]);
  });

  test('includes delivery counts on scheduled email list rows', () => {
    const repo = createTestRepository();
    const course = repo.createCourseType({ name: 'Rescue Diver' });
    const session = repo.createClassSession({ courseTypeId: course.id, startsOn: '2026-08-02', location: 'Pool' });
    const template = repo.createTemplate({ name: 'Reminder', subject: 'Reminder', body: 'Details.' });
    const preparedContact = repo.createContact({ firstName: 'Maya', lastName: 'Patel', email: 'maya@example.com' });
    const sentContact = repo.createContact({ firstName: 'Sam', lastName: 'Rivera', email: 'sam@example.com' });
    const failedContact = repo.createContact({ firstName: 'Lee', lastName: 'Morgan', email: 'lee@example.com' });
    repo.enrollContact(session.id, preparedContact.id);
    repo.enrollContact(session.id, sentContact.id);
    repo.enrollContact(session.id, failedContact.id);
    const campaign = repo.createCampaign({
      classSessionId: session.id,
      templateId: template.id,
      name: 'Delivery summary',
      scheduledFor: '2026-08-01T13:00:00.000Z',
      approved: true
    });
    const deliveries = repo.ensurePendingDeliveries(campaign.id);
    repo.markDeliverySent(deliveries.find((delivery) => delivery.recipientId === sentContact.id)!.id, 'accepted');
    repo.markDeliveryFailed(deliveries.find((delivery) => delivery.recipientId === failedContact.id)!.id, 'Temporary failure');

    const page = repo.listCampaignsPage({ search: 'summary' });

    expect(page.items).toMatchObject([
      {
        name: 'Delivery summary',
        recipientCount: 3,
        pendingCount: 1,
        sentCount: 1,
        failedCount: 1
      }
    ]);
  });

  test('filters scheduled email list by draft readiness', () => {
    const repo = createTestRepository();
    const course = repo.createCourseType({ name: 'Rescue Diver' });
    const session = repo.createClassSession({ courseTypeId: course.id, startsOn: '2026-08-02', location: 'Pool' });
    const template = repo.createTemplate({ name: 'Reminder', subject: 'Reminder', body: 'Details.' });
    repo.createCampaign({
      classSessionId: session.id,
      templateId: template.id,
      name: 'Ready email',
      scheduledFor: '2026-08-01T13:00:00.000Z',
      approved: true
    });
    repo.createCampaign({
      classSessionId: session.id,
      templateId: template.id,
      name: 'Needs preview',
      scheduledFor: '2026-07-31T13:00:00.000Z',
      approved: false
    });

    const page = repo.listCampaignsPage({ status: 'draft' });

    expect(page.total).toBe(1);
    expect(page.status).toBe('draft');
    expect(page.items).toMatchObject([{ name: 'Needs preview', approved: false }]);
  });

  test('filters scheduled email list to messages needing review', () => {
    const repo = createTestRepository();
    const course = repo.createCourseType({ name: 'Rescue Diver' });
    const session = repo.createClassSession({ courseTypeId: course.id, startsOn: '2026-08-02', location: 'Pool' });
    const template = repo.createTemplate({ name: 'Reminder', subject: 'Reminder', body: 'Details.' });
    const failedContact = repo.createContact({ firstName: 'Lee', lastName: 'Morgan', email: 'lee@example.com' });
    const sentContact = repo.createContact({ firstName: 'Sam', lastName: 'Rivera', email: 'sam@example.com' });
    repo.enrollContact(session.id, failedContact.id);
    repo.enrollContact(session.id, sentContact.id);
    const needsReview = repo.createCampaign({
      classSessionId: session.id,
      templateId: template.id,
      name: 'Review failures',
      scheduledFor: '2026-08-01T13:00:00.000Z',
      approved: true
    });
    const allGood = repo.createCampaign({
      classSessionId: session.id,
      templateId: template.id,
      name: 'All good',
      scheduledFor: '2026-07-31T13:00:00.000Z',
      approved: true
    });
    const failedDelivery = repo.ensurePendingDeliveries(needsReview.id).find((delivery) => delivery.recipientId === failedContact.id)!;
    repo.markDeliveryFailed(failedDelivery.id, 'Temporary failure');
    for (const delivery of repo.ensurePendingDeliveries(allGood.id)) repo.markDeliverySent(delivery.id, 'accepted');

    const page = repo.listCampaignsPage({ status: 'needs_review' });

    expect(page.total).toBe(1);
    expect(page.status).toBe('needs_review');
    expect(page.items).toMatchObject([{ name: 'Review failures' }]);
  });

  test('filters scheduled email list to fully sent messages', () => {
    const repo = createTestRepository();
    const course = repo.createCourseType({ name: 'Rescue Diver' });
    const session = repo.createClassSession({ courseTypeId: course.id, startsOn: '2026-08-02', location: 'Pool' });
    const template = repo.createTemplate({ name: 'Reminder', subject: 'Reminder', body: 'Details.' });
    const contact = repo.createContact({ firstName: 'Sam', lastName: 'Rivera', email: 'sam@example.com' });
    repo.enrollContact(session.id, contact.id);
    const sent = repo.createCampaign({
      classSessionId: session.id,
      templateId: template.id,
      name: 'Already sent',
      scheduledFor: '2026-08-01T13:00:00.000Z',
      approved: true
    });
    repo.createCampaign({
      classSessionId: session.id,
      templateId: template.id,
      name: 'Still prepared',
      scheduledFor: '2026-07-31T13:00:00.000Z',
      approved: true
    });
    for (const delivery of repo.ensurePendingDeliveries(sent.id)) repo.markDeliverySent(delivery.id, 'accepted');

    const page = repo.listCampaignsPage({ status: 'sent' });

    expect(page.total).toBe(1);
    expect(page.status).toBe('sent');
    expect(page.items).toMatchObject([{ name: 'Already sent' }]);
  });

  test('filters scheduled email list to upcoming ready messages', () => {
    const repo = createTestRepository();
    const course = repo.createCourseType({ name: 'Rescue Diver' });
    const session = repo.createClassSession({ courseTypeId: course.id, startsOn: '2026-08-02', location: 'Pool' });
    const template = repo.createTemplate({ name: 'Reminder', subject: 'Reminder', body: 'Details.' });
    repo.createCampaign({
      classSessionId: session.id,
      templateId: template.id,
      name: 'Upcoming ready',
      scheduledFor: '2026-08-01T13:00:00.000Z',
      approved: true
    });
    repo.createCampaign({
      classSessionId: session.id,
      templateId: template.id,
      name: 'Past ready',
      scheduledFor: '2026-07-30T13:00:00.000Z',
      approved: true
    });
    repo.createCampaign({
      classSessionId: session.id,
      templateId: template.id,
      name: 'Upcoming draft',
      scheduledFor: '2026-08-02T13:00:00.000Z',
      approved: false
    });

    const page = repo.listCampaignsPage({ status: 'upcoming', nowIso: '2026-08-01T00:00:00.000Z' });

    expect(page.total).toBe(1);
    expect(page.status).toBe('upcoming');
    expect(page.items).toMatchObject([{ name: 'Upcoming ready' }]);
  });

  test('records successful campaign delivery once per contact', () => {
    const repo = createTestRepository();
    const contact = repo.createContact({ firstName: 'Sam', lastName: 'Rivera', email: 'sam@example.com' });
    const course = repo.createCourseType({ name: 'Rescue Diver' });
    const session = repo.createClassSession({ courseTypeId: course.id, startsOn: '2026-08-02', location: 'Pool' });
    const template = repo.createTemplate({
      name: 'Thank you',
      subject: 'Thanks, {{firstName}}',
      body: 'Thanks for joining {{courseName}}.'
    });
    repo.enrollContact(session.id, contact.id);
    const campaign = repo.createCampaign({
      classSessionId: session.id,
      templateId: template.id,
      name: 'Post-class thanks',
      scheduledFor: '2026-08-05T13:00:00.000Z',
      approved: true
    });

    const first = repo.ensurePendingDeliveries(campaign.id);
    repo.markDeliverySent(first[0].id, 'accepted');
    const second = repo.ensurePendingDeliveries(campaign.id);

    expect(first).toHaveLength(1);
    expect(second).toHaveLength(0);
    expect(repo.listDeliveries(campaign.id)[0].status).toBe('sent');
  });

  test('returns existing pending deliveries when a campaign was planned earlier', () => {
    const repo = createTestRepository();
    const contact = repo.createContact({ firstName: 'Jo', lastName: 'Kim', email: 'jo@example.com' });
    const course = repo.createCourseType({ name: 'Nitrox' });
    const session = repo.createClassSession({ courseTypeId: course.id, startsOn: '2026-09-10', location: 'Shop' });
    const template = repo.createTemplate({ name: 'Reminder', subject: 'Class', body: 'See you soon.' });
    repo.enrollContact(session.id, contact.id);
    const campaign = repo.createCampaign({
      classSessionId: session.id,
      templateId: template.id,
      name: 'Reminder',
      scheduledFor: '2026-09-09T13:00:00.000Z',
      approved: true
    });

    const planned = repo.ensurePendingDeliveries(campaign.id);
    const due = repo.ensurePendingDeliveries(campaign.id);

    expect(planned).toHaveLength(1);
    expect(due).toHaveLength(1);
    expect(due[0].id).toBe(planned[0].id);
  });

  test('leaves failed delivery rows failed during send-due planning', () => {
    const repo = createTestRepository();
    const contact = repo.createContact({ firstName: 'Lee', lastName: 'Morgan', email: 'lee@example.com' });
    const course = repo.createCourseType({ name: 'Divemaster' });
    const session = repo.createClassSession({ courseTypeId: course.id, startsOn: '2026-10-01', location: 'Dock' });
    const template = repo.createTemplate({ name: 'Prep', subject: 'Prep', body: 'Details.' });
    repo.enrollContact(session.id, contact.id);
    const campaign = repo.createCampaign({
      classSessionId: session.id,
      templateId: template.id,
      name: 'Prep',
      scheduledFor: '2026-09-30T13:00:00.000Z',
      approved: true
    });
    const [delivery] = repo.ensurePendingDeliveries(campaign.id);

    repo.markDeliveryFailed(delivery.id, 'temporary SMTP error');
    const retry = repo.ensurePendingDeliveries(campaign.id);

    expect(retry).toHaveLength(0);
    expect(repo.listDeliveries(campaign.id)).toMatchObject([{ id: delivery.id, status: 'failed' }]);
  });

  test('does not requeue failed delivery rows or insert duplicates during send-due planning', () => {
    const repo = createTestRepository();
    const contact = repo.createContact({ firstName: 'Lee', lastName: 'Morgan', email: 'lee@example.com' });
    const course = repo.createCourseType({ name: 'Divemaster' });
    const session = repo.createClassSession({ courseTypeId: course.id, startsOn: '2026-10-01', location: 'Dock' });
    const template = repo.createTemplate({ name: 'Prep', subject: 'Prep', body: 'Details.' });
    repo.enrollContact(session.id, contact.id);
    const campaign = repo.createCampaign({
      classSessionId: session.id,
      templateId: template.id,
      name: 'Prep',
      scheduledFor: '2026-09-30T13:00:00.000Z',
      approved: true
    });
    const [delivery] = repo.ensurePendingDeliveries(campaign.id);

    repo.markDeliveryFailed(delivery.id, 'temporary SMTP error');
    const retry = repo.ensurePendingDeliveries(campaign.id);

    expect(retry).toHaveLength(0);
    expect(repo.listDeliveries(campaign.id)).toMatchObject([{ id: delivery.id, status: 'failed', errorMessage: 'temporary SMTP error' }]);
  });

  test('claims each pending delivery once across repository instances', () => {
    const dbPath = join(mkdtempSync(join(tmpdir(), 'scuba-email-')), 'app.sqlite');
    const repo = new AppRepository(dbPath);
    const contact = repo.createContact({ firstName: 'Lee', lastName: 'Morgan', email: 'lee@example.com' });
    const course = repo.createCourseType({ name: 'Divemaster' });
    const session = repo.createClassSession({ courseTypeId: course.id, startsOn: '2026-10-01', location: 'Dock' });
    const template = repo.createTemplate({ name: 'Prep', subject: 'Prep', body: 'Details.' });
    repo.enrollContact(session.id, contact.id);
    const campaign = repo.createCampaign({
      classSessionId: session.id,
      templateId: template.id,
      name: 'Prep',
      scheduledFor: '2026-09-30T13:00:00.000Z',
      approved: true
    });
    repo.ensurePendingDeliveries(campaign.id);
    const secondRepo = new AppRepository(dbPath);

    const firstClaim = repo.claimNextPendingDelivery(campaign.id);
    const secondClaim = secondRepo.claimNextPendingDelivery(campaign.id);

    expect(firstClaim).toMatchObject({ recipientId: contact.id, status: 'sending' });
    expect(secondClaim).toBeUndefined();
    expect(repo.listDeliveries(campaign.id)).toMatchObject([{ recipientId: contact.id, status: 'sending' }]);
  });

  test('claimed failed deliveries are not planned and claimed again by send-due', () => {
    const repo = createTestRepository();
    const contact = repo.createContact({ firstName: 'Lee', lastName: 'Morgan', email: 'lee@example.com' });
    const course = repo.createCourseType({ name: 'Divemaster' });
    const session = repo.createClassSession({ courseTypeId: course.id, startsOn: '2026-10-01', location: 'Dock' });
    const template = repo.createTemplate({ name: 'Prep', subject: 'Prep', body: 'Details.' });
    repo.enrollContact(session.id, contact.id);
    const campaign = repo.createCampaign({
      classSessionId: session.id,
      templateId: template.id,
      name: 'Prep',
      scheduledFor: '2026-09-30T13:00:00.000Z',
      approved: true
    });
    repo.ensurePendingDeliveries(campaign.id);
    const firstClaim = repo.claimNextPendingDelivery(campaign.id);
    expect(firstClaim).toBeDefined();
    repo.markDeliveryFailed(firstClaim!.id, 'temporary SMTP error');

    repo.ensurePendingDeliveries(campaign.id);
    const retryClaim = repo.claimNextPendingDelivery(campaign.id);

    expect(retryClaim).toBeUndefined();
    expect(repo.listDeliveries(campaign.id)).toMatchObject([{ id: firstClaim!.id, recipientId: contact.id, status: 'failed' }]);
  });

  test('automatic planning does not claim failed deliveries again on later passes', () => {
    const repo = createTestRepository();
    const contact = repo.createContact({ firstName: 'Lee', lastName: 'Morgan', email: 'lee@example.com' });
    const course = repo.createCourseType({ name: 'Divemaster' });
    const session = repo.createClassSession({ courseTypeId: course.id, startsOn: '2026-10-01', location: 'Dock' });
    const template = repo.createTemplate({ name: 'Prep', subject: 'Prep', body: 'Details.' });
    repo.enrollContact(session.id, contact.id);
    const campaign = repo.createCampaign({
      classSessionId: session.id,
      templateId: template.id,
      name: 'Prep',
      scheduledFor: '2026-09-30T13:00:00.000Z',
      approved: true
    });

    repo.ensurePendingDeliveries(campaign.id);
    const firstClaim = repo.claimNextPendingDelivery(campaign.id);
    expect(firstClaim).toBeDefined();
    repo.markDeliveryFailed(firstClaim!.id, 'SMTP rejected');

    repo.ensurePendingDeliveries(campaign.id);
    const secondClaim = repo.claimNextPendingDelivery(campaign.id);

    expect(secondClaim).toBeUndefined();
    expect(repo.listDeliveries(campaign.id)).toMatchObject([{ id: firstClaim!.id, status: 'failed', errorMessage: 'SMTP rejected' }]);
  });

  test('classified transient attempt failure schedules a bounded retry', () => {
    const repo = createTestRepository();
    const contact = repo.createContact({ firstName: 'Lee', lastName: 'Morgan', email: 'lee@example.com' });
    const course = repo.createCourseType({ name: 'Divemaster' });
    const session = repo.createClassSession({ courseTypeId: course.id, startsOn: '2026-10-01', location: 'Dock' });
    const template = repo.createTemplate({ name: 'Prep', subject: 'Prep', body: 'Details.' });
    repo.enrollContact(session.id, contact.id);
    const campaign = repo.createCampaign({
      classSessionId: session.id,
      templateId: template.id,
      name: 'Prep',
      scheduledFor: '2026-09-30T13:00:00.000Z',
      approved: true
    });
    repo.ensurePendingDeliveries(campaign.id);

    const claimed = repo.claimNextEligibleDelivery(campaign.id, { source: 'automatic', subject: 'Prep', body: 'Details.' });
    expect(claimed).toMatchObject({ recipientId: contact.id, status: 'sending', attemptCount: 1 });
    repo.finalizeDeliveryAttemptFailed({
      deliveryId: claimed!.id,
      attemptId: claimed!.attemptId!,
      failureKind: 'transient',
      failureSummary: 'Temporary failure',
      retryable: true
    });

    const [delivery] = repo.listDeliveries(campaign.id);
    expect(delivery).toMatchObject({
      status: 'retry_scheduled',
      attemptCount: 1,
      failureKind: 'transient',
      failureSummary: 'Temporary failure'
    });
    expect(delivery.nextAttemptAt).toBeTruthy();
  });

  test('automatic claims do not pick up scheduled retries', () => {
    const repo = createTestRepository();
    const contact = repo.createContact({ firstName: 'Lee', lastName: 'Morgan', email: 'lee@example.com' });
    const course = repo.createCourseType({ name: 'Divemaster' });
    const session = repo.createClassSession({ courseTypeId: course.id, startsOn: '2026-10-01', location: 'Dock' });
    const template = repo.createTemplate({ name: 'Prep', subject: 'Prep', body: 'Details.' });
    repo.enrollContact(session.id, contact.id);
    const campaign = repo.createCampaign({
      classSessionId: session.id,
      templateId: template.id,
      name: 'Prep',
      scheduledFor: '2026-09-30T13:00:00.000Z',
      approved: true
    });
    repo.ensurePendingDeliveries(campaign.id);
    const firstClaim = repo.claimNextEligibleDelivery(campaign.id, {
      source: 'automatic',
      subject: 'Prep',
      body: 'Details.',
      nowIso: '2026-09-30T13:00:00.000Z'
    });
    repo.finalizeDeliveryAttemptFailed({
      deliveryId: firstClaim!.id,
      attemptId: firstClaim!.attemptId!,
      failureKind: 'transient',
      failureSummary: 'Temporary failure',
      retryable: true
    });

    const automaticRetry = repo.claimNextEligibleDelivery(campaign.id, {
      source: 'automatic',
      subject: 'Prep',
      body: 'Details.',
      nowIso: '2026-09-30T13:06:00.000Z'
    });
    const manualRetry = repo.claimNextEligibleDelivery(campaign.id, {
      source: 'manual',
      subject: 'Prep',
      body: 'Details.',
      nowIso: '2026-09-30T13:06:00.000Z'
    });

    expect(automaticRetry).toBeUndefined();
    expect(manualRetry).toMatchObject({ id: firstClaim!.id, status: 'sending', attemptCount: 2 });
  });

  test('automatic send-due does not send due scheduled retries', async () => {
    const repo = createTestRepository();
    const contact = repo.createContact({ firstName: 'Lee', lastName: 'Morgan', email: 'lee@example.com' });
    const course = repo.createCourseType({ name: 'Divemaster' });
    const session = repo.createClassSession({ courseTypeId: course.id, startsOn: '2026-10-01', location: 'Dock' });
    const template = repo.createTemplate({ name: 'Prep', subject: 'Prep', body: 'Details.' });
    repo.enrollContact(session.id, contact.id);
    const campaign = repo.createCampaign({
      classSessionId: session.id,
      templateId: template.id,
      name: 'Prep',
      scheduledFor: '2000-01-01T00:00:00.000Z',
      approved: true
    });
    repo.ensurePendingDeliveries(campaign.id);
    const firstClaim = repo.claimNextEligibleDelivery(campaign.id, {
      source: 'automatic',
      subject: 'Prep',
      body: 'Details.',
      nowIso: '2026-09-30T13:00:00.000Z'
    });
    repo.finalizeDeliveryAttemptFailed({
      deliveryId: firstClaim!.id,
      attemptId: firstClaim!.attemptId!,
      failureKind: 'transient',
      failureSummary: 'Temporary failure',
      retryable: true
    });
    const send = async () => {
      throw new Error('scheduled retry should not send');
    };

    const sent = await sendDueCampaignsWithDependencies(repo, baseAppSettings(), send, { surface: 'campaign_auto' });

    expect(sent).toBe(0);
    expect(repo.listDeliveries(campaign.id)).toMatchObject([{ id: firstClaim!.id, status: 'retry_scheduled' }]);
  });

  test('manual send-due can intentionally send due scheduled retries', async () => {
    const repo = createTestRepository();
    const contact = repo.createContact({ firstName: 'Lee', lastName: 'Morgan', email: 'lee@example.com' });
    const course = repo.createCourseType({ name: 'Divemaster' });
    const session = repo.createClassSession({ courseTypeId: course.id, startsOn: '2026-10-01', location: 'Dock' });
    const template = repo.createTemplate({ name: 'Prep', subject: 'Prep {{firstName}}', body: 'Details for {{courseName}}.' });
    repo.enrollContact(session.id, contact.id);
    const campaign = repo.createCampaign({
      classSessionId: session.id,
      templateId: template.id,
      name: 'Prep',
      scheduledFor: '2000-01-01T00:00:00.000Z',
      approved: true
    });
    repo.ensurePendingDeliveries(campaign.id);
    const firstClaim = repo.claimNextEligibleDelivery(campaign.id, {
      source: 'automatic',
      subject: 'Prep',
      body: 'Details.',
      nowIso: '2026-09-30T13:00:00.000Z'
    });
    repo.finalizeDeliveryAttemptFailed({
      deliveryId: firstClaim!.id,
      attemptId: firstClaim!.attemptId!,
      failureKind: 'transient',
      failureSummary: 'Temporary failure',
      retryable: true
    });
    const db = (repo as unknown as { db: { prepare: (sql: string) => { run: (...args: unknown[]) => void } } }).db;
    db.prepare("update campaign_deliveries set next_attempt_at = '2000-01-01T00:05:00.000Z' where id = ?").run(firstClaim!.id);
    const send = async () => ({
      providerMessage: 'provider-456',
      originalRecipient: 'lee@example.com',
      effectiveRecipient: 'lee@example.com',
      testMode: false,
      finalText: 'Details for Divemaster.',
      finalHtml: '',
      messageId: '<retry@example.com>'
    });

    const sent = await sendDueCampaignsWithDependencies(repo, baseAppSettings({ schedulerEnabled: true }), send, { surface: 'manual_send_due' });

    expect(sent).toBe(1);
    expect(repo.listDeliveries(campaign.id)).toMatchObject([{ id: firstClaim!.id, status: 'sent', providerMessage: 'provider-456' }]);
    expect(repo.listContactCommunications(contact.id)[0]).toMatchObject({
      status: 'accepted',
      subject: 'Prep Lee'
    });
  });

  test('makes only failed campaign deliveries from today retryable for manual resend', async () => {
    const repo = createTestRepository();
    const today = '2026-06-23T14:00:00.000Z';
    const yesterday = '2026-06-22T14:00:00.000Z';
    const course = repo.createCourseType({ name: 'Divemaster' });
    const session = repo.createClassSession({ courseTypeId: course.id, startsOn: '2026-10-01', location: 'Dock' });
    const template = repo.createTemplate({ name: 'Prep', subject: 'Prep', body: 'Details.' });
    const failedToday = repo.createContact({ firstName: 'Lee', lastName: 'Morgan', email: 'lee@example.com' });
    const sentToday = repo.createContact({ firstName: 'Sam', lastName: 'Rivera', email: 'sam@example.com' });
    const failedYesterday = repo.createContact({ firstName: 'Jo', lastName: 'Kim', email: 'jo@example.com' });
    repo.enrollContact(session.id, failedToday.id);
    repo.enrollContact(session.id, sentToday.id);
    repo.enrollContact(session.id, failedYesterday.id);
    const campaign = repo.createCampaign({
      classSessionId: session.id,
      templateId: template.id,
      name: 'Prep',
      scheduledFor: '2000-01-01T00:00:00.000Z',
      approved: true
    });
    const deliveries = repo.ensurePendingDeliveries(campaign.id);
    const byRecipient = new Map(deliveries.map((delivery) => [delivery.recipientId, delivery]));
    repo.markDeliveryFailed(byRecipient.get(failedToday.id)!.id, 'Temporary failure');
    repo.markDeliverySent(byRecipient.get(sentToday.id)!.id, 'accepted');
    repo.markDeliveryFailed(byRecipient.get(failedYesterday.id)!.id, 'Old temporary failure');
    const db = (repo as unknown as { db: { prepare: (sql: string) => { run: (...args: unknown[]) => void } } }).db;
    db.prepare('update campaign_deliveries set last_attempt_at = ? where recipient_id in (?, ?)').run(today, failedToday.id, sentToday.id);
    db.prepare('update campaign_deliveries set last_attempt_at = ? where recipient_id = ?').run(yesterday, failedYesterday.id);

    const count = repo.countFailedCampaignDeliveriesBetween('2026-06-23T00:00:00.000Z', '2026-06-24T00:00:00.000Z');
    const retryable = repo.retryFailedCampaignDeliveriesBetween('2026-06-23T00:00:00.000Z', '2026-06-24T00:00:00.000Z');

    expect(count).toBe(1);
    expect(retryable).toBe(1);
    expect(repo.listDeliveries(campaign.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ recipientId: failedToday.id, status: 'pending' }),
        expect.objectContaining({ recipientId: sentToday.id, status: 'sent' }),
        expect.objectContaining({ recipientId: failedYesterday.id, status: 'failed' })
      ])
    );
  });

  test('manual send-due sends a failed-today delivery made retryable', async () => {
    const repo = createTestRepository();
    const contact = repo.createContact({ firstName: 'Lee', lastName: 'Morgan', email: 'lee@example.com' });
    const course = repo.createCourseType({ name: 'Divemaster' });
    const session = repo.createClassSession({ courseTypeId: course.id, startsOn: '2026-10-01', location: 'Dock' });
    const template = repo.createTemplate({ name: 'Prep', subject: 'Prep {{firstName}}', body: 'Details for {{courseName}}.' });
    repo.enrollContact(session.id, contact.id);
    const campaign = repo.createCampaign({
      classSessionId: session.id,
      templateId: template.id,
      name: 'Prep',
      scheduledFor: '2000-01-01T00:00:00.000Z',
      approved: true
    });
    const [delivery] = repo.ensurePendingDeliveries(campaign.id);
    repo.markDeliveryFailed(delivery.id, 'Temporary failure');
    const db = (repo as unknown as { db: { prepare: (sql: string) => { run: (...args: unknown[]) => void } } }).db;
    db.prepare('update campaign_deliveries set last_attempt_at = ? where id = ?').run('2026-06-23T14:00:00.000Z', delivery.id);
    repo.retryFailedCampaignDeliveriesBetween('2026-06-23T00:00:00.000Z', '2026-06-24T00:00:00.000Z');
    const send = async () => ({
      providerMessage: 'provider-retry',
      originalRecipient: 'lee@example.com',
      effectiveRecipient: 'lee@example.com',
      testMode: false,
      finalText: 'Details for Divemaster.',
      finalHtml: '',
      messageId: '<retry-today@example.com>'
    });

    const sent = await sendDueCampaignsWithDependencies(repo, baseAppSettings({ schedulerEnabled: true }), send, { surface: 'manual_send_due' });

    expect(sent).toBe(1);
    expect(repo.listDeliveries(campaign.id)).toMatchObject([{ id: delivery.id, status: 'sent', providerMessage: 'provider-retry' }]);
  });

  test('loads campaign detail with recipient status including skipped do-not-email contacts', () => {
    const repo = createTestRepository();
    const sendable = repo.createContact({ firstName: 'Sam', lastName: 'Rivera', email: 'sam@example.com' });
    const skipped = repo.createContact({
      firstName: 'No',
      lastName: 'Email',
      email: 'skip@example.com',
      doNotEmail: true
    });
    const course = repo.createCourseType({ name: 'Rescue Diver' });
    const session = repo.createClassSession({ courseTypeId: course.id, startsOn: '2026-08-02', location: 'Pool' });
    const template = repo.createTemplate({ name: 'Prep', subject: 'Hi {{firstName}}', body: 'Class: {{courseName}}' });
    repo.enrollContact(session.id, sendable.id);
    repo.enrollContact(session.id, skipped.id);
    const campaign = repo.createCampaign({
      classSessionId: session.id,
      templateId: template.id,
      name: 'Prep',
      scheduledFor: '2026-08-01T13:00:00.000Z',
      approved: false
    });

    repo.ensurePendingDeliveries(campaign.id);
    const detail = repo.getCampaignDetail(campaign.id);

    expect(detail.campaign.id).toBe(campaign.id);
    expect(detail.template.subject).toBe('Hi {{firstName}}');
    expect(detail.recipients).toMatchObject([
      { contactId: skipped.id, email: 'skip@example.com', status: 'skipped', reason: 'Do not email' },
      { contactId: sendable.id, email: 'sam@example.com', status: 'pending' }
    ]);
  });

  test('updates campaign lifecycle fields while protecting sent campaigns from deletion', () => {
    const repo = createTestRepository();
    const contact = repo.createContact({ firstName: 'Sam', lastName: 'Rivera', email: 'sam@example.com' });
    const course = repo.createCourseType({ name: 'Rescue Diver' });
    const session = repo.createClassSession({ courseTypeId: course.id, startsOn: '2026-08-02', location: 'Pool' });
    const template = repo.createTemplate({ name: 'Prep', subject: 'Prep', body: 'Details' });
    repo.enrollContact(session.id, contact.id);
    const campaign = repo.createCampaign({
      classSessionId: session.id,
      templateId: template.id,
      name: 'Prep',
      scheduledFor: '2026-08-01T13:00:00.000Z',
      approved: false
    });

    repo.updateCampaign(campaign.id, { name: 'Updated prep', scheduledFor: '2026-08-01T14:00:00.000Z', approved: true });

    expect(repo.getCampaign(campaign.id)).toMatchObject({
      name: 'Updated prep',
      scheduledFor: '2026-08-01T14:00:00.000Z',
      approved: true
    });

    const [delivery] = repo.ensurePendingDeliveries(campaign.id);
    repo.markDeliverySent(delivery.id, 'accepted');

    expect(() => repo.deleteCampaign(campaign.id)).toThrow('Campaign has sent deliveries and cannot be deleted.');
  });

  test('stores course default source metadata with campaigns', () => {
    const repo = createTestRepository();
    const course = repo.createCourseType({ name: 'Open Water' });
    const session = repo.createClassSession({ courseTypeId: course.id, startsOn: '2026-08-02', location: 'Pool' });
    const template = repo.createTemplate({ name: 'Reminder', subject: 'Class', body: 'Details' });

    const campaign = repo.createCampaign({
      classSessionId: session.id,
      templateId: template.id,
      name: 'Reminder',
      scheduledFor: '2026-08-01T09:00',
      approved: false,
      source: 'course_default',
      defaultPurpose: 'reminder',
      defaultLabel: '',
      sendOffsetMinutes: -24 * 60
    });

    expect(repo.getCampaign(campaign.id)).toMatchObject({
      source: 'course_default',
      defaultPurpose: 'reminder',
      defaultLabel: '',
      sendOffsetMinutes: -24 * 60
    });
  });

  test('excludes contacts marked do-not-email after delivery planning from pending sends', () => {
    const repo = createTestRepository();
    const contact = repo.createContact({ firstName: 'Sam', lastName: 'Rivera', email: 'sam@example.com' });
    const course = repo.createCourseType({ name: 'Rescue Diver' });
    const session = repo.createClassSession({ courseTypeId: course.id, startsOn: '2026-08-02', location: 'Pool' });
    const template = repo.createTemplate({ name: 'Prep', subject: 'Prep', body: 'Details' });
    repo.enrollContact(session.id, contact.id);
    const campaign = repo.createCampaign({
      classSessionId: session.id,
      templateId: template.id,
      name: 'Prep',
      scheduledFor: '2026-08-01T13:00',
      approved: true
    });

    expect(repo.ensurePendingDeliveries(campaign.id)).toHaveLength(1);
    repo.updateContact(contact.id, { firstName: 'Sam', lastName: 'Rivera', email: 'sam@example.com', doNotEmail: true });

    expect(repo.listPendingDeliveries(campaign.id)).toHaveLength(0);
    expect(repo.ensurePendingDeliveries(campaign.id)).toHaveLength(0);
  });

  test('does not add late enrollments to an already planned manual campaign', () => {
    const repo = createTestRepository();
    const maya = repo.createContact({ firstName: 'Maya', lastName: 'Patel', email: 'maya@example.com' });
    const jo = repo.createContact({ firstName: 'Jo', lastName: 'Kim', email: 'jo@example.com' });
    const course = repo.createCourseType({ name: 'Rescue Diver' });
    const session = repo.createClassSession({ courseTypeId: course.id, startsOn: '2026-08-02', location: 'Pool' });
    const template = repo.createTemplate({ name: 'Prep', subject: 'Prep', body: 'Details' });
    repo.enrollContact(session.id, maya.id);
    const campaign = repo.createCampaign({
      classSessionId: session.id,
      templateId: template.id,
      name: 'Prep',
      scheduledFor: '2026-08-01T13:00',
      approved: true,
      source: 'manual'
    });
    expect(repo.ensurePendingDeliveries(campaign.id)).toHaveLength(1);

    repo.enrollContact(session.id, jo.id);

    expect(repo.ensurePendingDeliveries(campaign.id).map((delivery) => delivery.recipientId)).toEqual([maya.id]);
  });
});
