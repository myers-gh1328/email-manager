import { describe, expect, test } from 'vitest';
import { createTestRepository } from './repository-helpers';

describe('repository templates', () => {
  test('updates a template in place', () => {
    const repo = createTestRepository();
    const template = repo.createTemplate({ name: 'Old', subject: 'Old subject', body: 'Old body' });

    const updated = repo.updateTemplate(template.id, {
      name: 'New',
      subject: 'New subject',
      body: 'New body'
    });

    expect(updated).toEqual({ id: template.id, name: 'New', subject: 'New subject', body: 'New body' });
    expect(repo.getTemplate(template.id).subject).toBe('New subject');
  });

  test('deletes unused templates', () => {
    const repo = createTestRepository();
    const template = repo.createTemplate({ name: 'Unused', subject: 'Subject', body: 'Body' });

    repo.deleteTemplate(template.id);

    expect(repo.listTemplates()).toEqual([]);
  });

  test('does not delete templates used by campaigns', () => {
    const repo = createTestRepository();
    const contact = repo.createContact({ firstName: 'Sam', lastName: 'Rivera', email: 'sam@example.com' });
    const course = repo.createCourseType({ name: 'Rescue Diver' });
    const session = repo.createClassSession({ courseTypeId: course.id, startsOn: '2026-08-02', location: 'Pool' });
    const template = repo.createTemplate({ name: 'Used', subject: 'Subject', body: 'Body' });
    repo.enrollContact(session.id, contact.id);
    repo.createCampaign({
      classSessionId: session.id,
      templateId: template.id,
      name: 'Campaign',
      scheduledFor: '2026-08-05T13:00:00.000Z',
      approved: true
    });

    expect(() => repo.deleteTemplate(template.id)).toThrow('Template is used by an existing campaign and cannot be deleted.');
    expect(repo.getTemplate(template.id).name).toBe('Used');
  });

  test('stores course type default templates by purpose', () => {
    const repo = createTestRepository();
    const course = repo.createCourseType({ name: 'Open Water' });
    const template = repo.createTemplate({ name: 'Welcome', subject: 'Welcome', body: 'Hi' });

    repo.setCourseTypeDefaultTemplate({ courseTypeId: course.id, purpose: 'welcome', templateId: template.id });

    expect(repo.listCourseTypeDefaultTemplates(course.id)).toMatchObject([
      { courseTypeId: course.id, purpose: 'welcome', templateId: template.id, templateName: 'Welcome' }
    ]);
  });
});
