import { createHash } from 'node:crypto';
import { describe, expect, test } from 'vitest';
import { buildCampaignEmailPreviews, campaignEmailPreviewToken, scheduledForFromClassOffset } from '../src/lib/server/campaign-email';
import { createTestRepository } from './repository-helpers';

describe('campaign email helpers', () => {
  test('computes default send time from class start and offset', () => {
    const classSession = { startsOn: '2026-08-02', startTime: '09:00' };

    expect(scheduledForFromClassOffset(classSession, -24 * 60)).toBe('2026-08-01T09:00');
    expect(scheduledForFromClassOffset(classSession, 2 * 60)).toBe('2026-08-02T11:00');
  });

  test('uses noon when a class has no start time', () => {
    const classSession = { startsOn: '2026-08-02', startTime: '' };

    expect(scheduledForFromClassOffset(classSession, -60)).toBe('2026-08-02T11:00');
  });

  test('preview token changes when template content changes', () => {
    const repo = createTestRepository();
    const contact = repo.createContact({ firstName: 'Maya', lastName: 'Patel', email: 'maya@example.com' });
    const course = repo.createCourseType({ name: 'Open Water' });
    const session = repo.createClassSession({ courseTypeId: course.id, startsOn: '2026-08-02', location: 'Pool' });
    const template = repo.createTemplate({ name: 'Reminder', subject: 'Hi {{firstName}}', body: 'See you at {{courseName}}.' });
    repo.enrollContact(session.id, contact.id);

    const previews = buildCampaignEmailPreviews(repo, session.id, template.id, 'Alex');
    const firstToken = campaignEmailPreviewToken({ classSessionId: session.id, template, previews });

    repo.updateTemplate(template.id, { name: 'Reminder', subject: 'Changed {{firstName}}', body: 'See you at {{courseName}}.' });
    const changedTemplate = repo.getTemplate(template.id);
    const changedPreviews = buildCampaignEmailPreviews(repo, session.id, template.id, 'Alex');

    expect(campaignEmailPreviewToken({ classSessionId: session.id, template: changedTemplate, previews: changedPreviews })).not.toBe(firstToken);
  });

  test('preview token changes when roster changes', () => {
    const repo = createTestRepository();
    const maya = repo.createContact({ firstName: 'Maya', lastName: 'Patel', email: 'maya@example.com' });
    const jo = repo.createContact({ firstName: 'Jo', lastName: 'Kim', email: 'jo@example.com' });
    const course = repo.createCourseType({ name: 'Open Water' });
    const session = repo.createClassSession({ courseTypeId: course.id, startsOn: '2026-08-02', location: 'Pool' });
    const template = repo.createTemplate({ name: 'Reminder', subject: 'Hi {{firstName}}', body: 'See you at {{courseName}}.' });
    repo.enrollContact(session.id, maya.id);

    const previews = buildCampaignEmailPreviews(repo, session.id, template.id, 'Alex');
    const firstToken = campaignEmailPreviewToken({ classSessionId: session.id, template, previews });

    repo.enrollContact(session.id, jo.id);
    const changedPreviews = buildCampaignEmailPreviews(repo, session.id, template.id, 'Alex');

    expect(campaignEmailPreviewToken({ classSessionId: session.id, template, previews: changedPreviews })).not.toBe(firstToken);
  });

  test('campaign preview token is not the old unsigned payload hash', () => {
    const repo = createTestRepository();
    const contact = repo.createContact({ firstName: 'Maya', lastName: 'Patel', email: 'maya@example.com' });
    const course = repo.createCourseType({ name: 'Open Water' });
    const session = repo.createClassSession({ courseTypeId: course.id, startsOn: '2026-08-02', location: 'Pool' });
    const template = repo.createTemplate({ name: 'Reminder', subject: 'Hi {{firstName}}', body: 'See you at {{courseName}}.' });
    repo.enrollContact(session.id, contact.id);
    const previews = buildCampaignEmailPreviews(repo, session.id, template.id, 'Alex');
    const payload = {
      classSessionId: session.id,
      templateId: template.id,
      subject: template.subject,
      body: template.body,
      recipients: previews.map((preview) => ({
        id: preview.contact.id,
        email: preview.contact.email,
        doNotEmail: preview.contact.doNotEmail,
        subject: preview.subject,
        body: preview.body,
        missing: preview.missing
      }))
    };

    expect(campaignEmailPreviewToken({ classSessionId: session.id, template, previews })).not.toBe(
      createHash('sha256').update(JSON.stringify(payload)).digest('hex')
    );
  });
});
