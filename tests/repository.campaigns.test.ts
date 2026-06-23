import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { createTestRepository } from './repository-helpers';
import { AppRepository } from '../src/lib/server/repository';

describe('repository campaigns and deliveries', () => {
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

  test('leaves failed delivery rows failed unless retry is explicitly requested', () => {
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

  test('reuses failed delivery rows for explicit retry instead of inserting duplicates', () => {
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
    const retry = repo.ensurePendingDeliveries(campaign.id, { retryFailed: true });

    expect(retry).toHaveLength(1);
    expect(retry[0].id).toBe(delivery.id);
    expect(retry[0].status).toBe('pending');
    expect(repo.listDeliveries(campaign.id)).toHaveLength(1);
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

  test('claimed failed deliveries may be planned and claimed for retry', () => {
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

    repo.ensurePendingDeliveries(campaign.id, { retryFailed: true });
    const retryClaim = repo.claimNextPendingDelivery(campaign.id);

    expect(retryClaim).toMatchObject({ id: firstClaim!.id, recipientId: contact.id, status: 'sending' });
    expect(repo.listDeliveries(campaign.id)).toHaveLength(1);
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

    repo.ensurePendingDeliveries(campaign.id, { retryFailed: false });
    const firstClaim = repo.claimNextPendingDelivery(campaign.id);
    expect(firstClaim).toBeDefined();
    repo.markDeliveryFailed(firstClaim!.id, 'SMTP rejected');

    repo.ensurePendingDeliveries(campaign.id, { retryFailed: false });
    const secondClaim = repo.claimNextPendingDelivery(campaign.id);

    expect(secondClaim).toBeUndefined();
    expect(repo.listDeliveries(campaign.id)).toMatchObject([{ id: firstClaim!.id, status: 'failed', errorMessage: 'SMTP rejected' }]);
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
