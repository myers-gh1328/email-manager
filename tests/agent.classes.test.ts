import { describe, expect, it } from 'vitest';
import {
  createClassSessionTool,
  enrollContactTool,
  listClassSessionsTool,
  setEnrollmentChecklistCompletionTool,
  updateClassSessionTool
} from '../src/lib/server/agent/tools/classes';
import { defaultAgentPermissions } from '../src/lib/server/agent/permissions';
import { defaultVocabulary } from '../src/lib/server/agent/vocabulary';
import type { AppSettings } from '../src/lib/server/settings';
import { createTestRepository } from './repository-helpers';

describe('agent class tools', () => {
  it('returns class sessions when agent access and viewData are enabled', () => {
    const repo = createTestRepository();
    const course = repo.createCourseType({ name: 'Open Water' });
    repo.createClassSession({ courseTypeId: course.id, startsOn: '2026-08-02', location: 'Pool' });

    const result = listClassSessionsTool(repo, { query: 'open' }, agentSettings({ viewData: true }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.classSessions).toHaveLength(1);
    expect(result.data.classSessions[0].courseName).toBe('Open Water');
    expect(result.data).not.toHaveProperty('nextCursor');
    expect(result.labels.classSessionLabel).toBe('Class session');
  });

  it('denies class reads when agent access or viewData are disabled', () => {
    const repo = createTestRepository();

    const disabledAgent = listClassSessionsTool(repo, {}, agentSettings({ viewData: true }, false));
    const disabledView = listClassSessionsTool(repo, {}, agentSettings({ viewData: false }));

    for (const result of [disabledAgent, disabledView]) {
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.error.code).toBe('agent_permission_denied');
    }
  });

  it('denies class mutations when editRecords is enabled but viewData is disabled', () => {
    const repo = createTestRepository();
    const course = repo.createCourseType({ name: 'Open Water' });

    const result = createClassSessionTool(
      repo,
      { courseTypeId: course.id, startsOn: '2026-08-02', location: 'Pool' },
      agentSettings({ editRecords: true, viewData: false })
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('agent_permission_denied');
    expect(result.error.details).toEqual({ permission: 'viewData' });
  });

  it('denies class session creation when editRecords is disabled', () => {
    const repo = createTestRepository();
    const course = repo.createCourseType({ name: 'Open Water' });

    const result = createClassSessionTool(repo, { courseTypeId: course.id, startsOn: '2026-08-02', location: 'Pool' }, agentSettings());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('agent_permission_denied');
    expect(result.error.details).toEqual({ permission: 'editRecords' });
  });

  it('denies class session updates and enrollment workflow mutations when editRecords is disabled', () => {
    const repo = createTestRepository();
    const course = repo.createCourseType({ name: 'Open Water' });
    const session = repo.createClassSession({ courseTypeId: course.id, startsOn: '2026-08-02', location: 'Pool' });
    const contact = repo.createContact({ firstName: 'Sam', lastName: 'Rivera', email: 'sam@example.test' });
    const checklistItem = repo.createChecklistItem({ label: 'Waiver signed' });

    const update = updateClassSessionTool(
      repo,
      session.id,
      {
        courseTypeId: course.id,
        startsOn: '2026-08-03',
        location: 'Pool'
      },
      agentSettings()
    );
    const enroll = enrollContactTool(repo, { classSessionId: session.id, contactId: contact.id }, agentSettings());
    const checklist = setEnrollmentChecklistCompletionTool(
      repo,
      {
        classSessionId: session.id,
        contactId: contact.id,
        itemScope: 'global',
        itemId: checklistItem.id,
        completed: true
      },
      agentSettings()
    );

    for (const result of [update, enroll, checklist]) {
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.error.code).toBe('agent_permission_denied');
    }
  });

  it('returns conflict envelopes for duplicate class sessions', () => {
    const repo = createTestRepository();
    const course = repo.createCourseType({ name: 'Open Water' });
    const input = { courseTypeId: course.id, startsOn: '2026-08-02', startTime: '09:00', location: 'Pool' };
    repo.createClassSession(input);

    const result = createClassSessionTool(repo, input, agentSettings({ editRecords: true }));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('conflict');
  });

  it('returns not_found and validation envelopes for invalid class workflow inputs', () => {
    const repo = createTestRepository();
    const course = repo.createCourseType({ name: 'Open Water' });
    const missingSession = updateClassSessionTool(
      repo,
      'missing-session',
      { courseTypeId: course.id, startsOn: '2026-08-02', location: 'Pool' },
      agentSettings({ editRecords: true })
    );
    const badEnrollment = enrollContactTool(
      repo,
      { classSessionId: 'missing-session', contactId: 'missing-contact' },
      agentSettings({ editRecords: true })
    );

    expect(missingSession.ok).toBe(false);
    if (!missingSession.ok) expect(missingSession.error.code).toBe('not_found');
    expect(badEnrollment.ok).toBe(false);
    if (!badEnrollment.ok) expect(badEnrollment.error.code).toBe('validation_failed');
  });
});

function agentSettings(permissions: Partial<AppSettings['agentPermissions']> = {}, agentEnabled = true): AppSettings {
  return {
    instructorName: '',
    publicBaseUrl: '',
    schedulerEnabled: false,
    emailTestModeEnabled: false,
    emailSignature: '',
    remoteAccessEnabled: false,
    trustedProxyEnabled: false,
    smtpHost: '',
    smtpPort: '587',
    smtpUser: '',
    smtpFrom: '',
    smtpAuthMethod: 'password',
    smtpPasswordConfigured: false,
    microsoftTenantId: 'common',
    microsoftClientId: '',
    microsoftClientSecretConfigured: false,
    microsoftRefreshTokenConfigured: false,
    aiEnabled: false,
    aiVisionEnabled: false,
    aiBaseUrl: '',
    aiModel: '',
    aiApiKeyConfigured: false,
    themeMode: 'system',
    agentEnabled,
    agentPermissions: { ...defaultAgentPermissions, ...permissions },
    vocabulary: defaultVocabulary
  };
}
