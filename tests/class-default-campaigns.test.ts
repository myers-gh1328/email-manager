import { describe, expect, test } from 'vitest';
import { syncDefaultCampaignsForClass, syncDefaultCampaignsForCourseType } from '../src/lib/server/class-default-campaigns';
import { createTestRepository } from './repository-helpers';

describe('class default campaign sync', () => {
  test('creates approved scheduled campaigns from course defaults when a class is created', () => {
    const repo = createTestRepository();
    const course = repo.createCourseType({ name: 'Open Water' });
    const template = repo.createTemplate({ name: 'Welcome', subject: 'Welcome', body: 'Details' });
    repo.setCourseTypeDefaultTemplate({
      courseTypeId: course.id,
      purpose: 'welcome',
      templateId: template.id,
      sendOffsetMinutes: -24 * 60
    });
    const session = repo.createClassSession({ courseTypeId: course.id, startsOn: '2026-08-02', startTime: '09:00', location: 'Pool' });

    const created = syncDefaultCampaignsForClass(repo, session.id);
    const campaigns = repo.listCampaignsForClassSession(session.id);

    expect(created).toHaveLength(1);
    expect(campaigns).toMatchObject([
      {
        source: 'course_default',
        defaultPurpose: 'welcome',
        templateId: template.id,
        scheduledFor: '2026-08-01T09:00',
        approved: true
      }
    ]);
  });

  test('syncs changed course defaults across existing classes without touching sent campaigns', () => {
    const repo = createTestRepository();
    const course = repo.createCourseType({ name: 'Advanced' });
    const firstTemplate = repo.createTemplate({ name: 'Old reminder', subject: 'Old', body: 'Old' });
    const secondTemplate = repo.createTemplate({ name: 'New reminder', subject: 'New', body: 'New' });
    const firstSession = repo.createClassSession({ courseTypeId: course.id, startsOn: '2026-08-02', startTime: '09:00', location: 'Pool' });
    const secondSession = repo.createClassSession({ courseTypeId: course.id, startsOn: '2026-08-03', startTime: '09:00', location: 'Pool' });
    repo.setCourseTypeDefaultTemplate({ courseTypeId: course.id, purpose: 'reminder', templateId: firstTemplate.id, sendOffsetMinutes: -24 * 60 });
    syncDefaultCampaignsForCourseType(repo, course.id);
    const sentCampaign = repo.listCampaignsForClassSession(firstSession.id)[0];
    const contact = repo.createContact({ firstName: 'Sam', lastName: 'Diver', email: 'sam@example.com' });
    repo.enrollContact(firstSession.id, contact.id);
    const [delivery] = repo.ensurePendingDeliveries(sentCampaign.id);
    repo.markDeliverySent(delivery.id, 'accepted');

    repo.setCourseTypeDefaultTemplate({ courseTypeId: course.id, purpose: 'reminder', templateId: secondTemplate.id, sendOffsetMinutes: -12 * 60 });
    const result = syncDefaultCampaignsForCourseType(repo, course.id);

    expect(result).toEqual({ created: 0, updated: 1, deleted: 0, skippedSent: 1 });
    expect(repo.listCampaignsForClassSession(firstSession.id)[0]).toMatchObject({ templateId: firstTemplate.id, sendOffsetMinutes: -24 * 60 });
    expect(repo.listCampaignsForClassSession(secondSession.id)[0]).toMatchObject({ templateId: secondTemplate.id, sendOffsetMinutes: -12 * 60 });
  });

  test('resyncs unsent inherited campaign times after a class schedule changes', () => {
    const repo = createTestRepository();
    const course = repo.createCourseType({ name: 'Open Water' });
    const template = repo.createTemplate({ name: 'Reminder', subject: 'Class', body: 'Details' });
    repo.setCourseTypeDefaultTemplate({
      courseTypeId: course.id,
      purpose: 'reminder',
      templateId: template.id,
      sendOffsetMinutes: -24 * 60
    });
    const session = repo.createClassSession({ courseTypeId: course.id, startsOn: '2026-08-02', startTime: '09:00', location: 'Pool' });
    syncDefaultCampaignsForClass(repo, session.id);
    expect(repo.listCampaignsForClassSession(session.id)[0]).toMatchObject({ scheduledFor: '2026-08-01T09:00' });

    repo.updateClassSession(session.id, { courseTypeId: course.id, startsOn: '2026-08-03', startTime: '18:00', location: 'Pool' });
    syncDefaultCampaignsForClass(repo, session.id);

    expect(repo.listCampaignsForClassSession(session.id)[0]).toMatchObject({ scheduledFor: '2026-08-02T18:00' });
  });

  test('preserves failed delivery state when inherited campaign settings change', () => {
    const repo = createTestRepository();
    const course = repo.createCourseType({ name: 'Advanced' });
    const firstTemplate = repo.createTemplate({ name: 'Old reminder', subject: 'Old', body: 'Old' });
    const secondTemplate = repo.createTemplate({ name: 'New reminder', subject: 'New', body: 'New' });
    const session = repo.createClassSession({ courseTypeId: course.id, startsOn: '2026-08-02', startTime: '09:00', location: 'Pool' });
    const contact = repo.createContact({ firstName: 'Sam', lastName: 'Diver', email: 'sam@example.com' });
    repo.enrollContact(session.id, contact.id);
    repo.setCourseTypeDefaultTemplate({ courseTypeId: course.id, purpose: 'reminder', templateId: firstTemplate.id, sendOffsetMinutes: -24 * 60 });
    syncDefaultCampaignsForClass(repo, session.id);
    const campaign = repo.listCampaignsForClassSession(session.id)[0];
    const [delivery] = repo.ensurePendingDeliveries(campaign.id);
    repo.markDeliveryFailed(delivery.id, 'temporary SMTP error');

    repo.setCourseTypeDefaultTemplate({ courseTypeId: course.id, purpose: 'reminder', templateId: secondTemplate.id, sendOffsetMinutes: -12 * 60 });
    syncDefaultCampaignsForCourseType(repo, course.id);

    expect(repo.listDeliveries(campaign.id)).toMatchObject([{ id: delivery.id, status: 'failed', errorMessage: 'temporary SMTP error' }]);
    expect(repo.listPendingDeliveries(campaign.id)).toHaveLength(0);
  });
});
