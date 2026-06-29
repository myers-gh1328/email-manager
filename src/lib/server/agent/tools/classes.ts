import type { AppRepository, ClassSessionInput, EnrollmentChecklistCompletionInput } from '../../repository';
import { getSettings, type AppSettings } from '../../settings';
import { agentError, agentOk } from '../envelope';
import type { AgentEnvelope } from '../envelope';

function requireReadAccess(settings: AppSettings = getSettings()) {
  if (!settings.agentEnabled) {
    return {
      settings,
      denied: agentError('agent_permission_denied', 'Agent access is disabled.', { permission: 'agentEnabled' }, { labels: settings.vocabulary })
    };
  }
  if (!settings.agentPermissions.viewData) {
    return {
      settings,
      denied: agentError(
        'agent_permission_denied',
        'Agents are not allowed to view app data.',
        { permission: 'viewData' },
        { labels: settings.vocabulary }
      )
    };
  }
  return { settings, denied: null };
}

function requireEditAccess(settings: AppSettings = getSettings()) {
  if (!settings.agentEnabled) {
    return {
      settings,
      denied: agentError('agent_permission_denied', 'Agent access is disabled.', { permission: 'agentEnabled' }, { labels: settings.vocabulary })
    };
  }
  if (!settings.agentPermissions.viewData) {
    return {
      settings,
      denied: agentError(
        'agent_permission_denied',
        'Agents are not allowed to view app data.',
        { permission: 'viewData' },
        { labels: settings.vocabulary }
      )
    };
  }
  if (!settings.agentPermissions.editRecords) {
    return {
      settings,
      denied: agentError(
        'agent_permission_denied',
        'Agents are not allowed to draft or edit records.',
        { permission: 'editRecords' },
        { labels: settings.vocabulary }
      )
    };
  }
  return { settings, denied: null };
}

export function listClassSessionsTool(repo: AppRepository, input: { query?: string; limit?: number }, settingsOverride?: AppSettings) {
  const { settings, denied } = requireReadAccess(settingsOverride);
  if (denied) return denied;
  const query = (input.query ?? '').trim();
  const limit = clampLimit(input.limit);
  const classSessions = repo.listClassSessionsPage({ search: query, limit }).items;
  return agentOk(
    { classSessions },
    { labels: settings.vocabulary, nextActions: ['create_class_session', 'update_class_session', 'enroll_contact'] }
  );
}

export function getClassSessionTool(repo: AppRepository, classSessionId: string, settingsOverride?: AppSettings) {
  const { settings, denied } = requireReadAccess(settingsOverride);
  if (denied) return denied;
  return withRepositoryEnvelope(settings, () =>
    agentOk(
      {
        classSession: repo.getClassSession(classSessionId),
        roster: repo.listEnrollments(classSessionId),
        checklist: repo.listEnrollmentChecklistState(classSessionId)
      },
      { labels: settings.vocabulary, nextActions: ['enroll_contact', 'set_enrollment_checklist_completion'] }
    )
  );
}

export function createClassSessionTool(repo: AppRepository, input: ClassSessionInput, settingsOverride?: AppSettings) {
  const { settings, denied } = requireEditAccess(settingsOverride);
  if (denied) return denied;
  return withRepositoryEnvelope(settings, () => {
    const classSession = repo.createClassSession(input);
    return agentOk({ classSession }, { labels: settings.vocabulary, nextActions: ['get_class_session', 'enroll_contact'] });
  });
}

export function updateClassSessionTool(repo: AppRepository, id: string, input: ClassSessionInput, settingsOverride?: AppSettings) {
  const { settings, denied } = requireEditAccess(settingsOverride);
  if (denied) return denied;
  return withRepositoryEnvelope(settings, () => {
    const classSession = repo.updateClassSession(id, input);
    return agentOk({ classSession }, { labels: settings.vocabulary, nextActions: ['get_class_session'] });
  });
}

export function enrollContactTool(repo: AppRepository, input: { classSessionId: string; contactId: string }, settingsOverride?: AppSettings) {
  const { settings, denied } = requireEditAccess(settingsOverride);
  if (denied) return denied;
  return withRepositoryEnvelope(settings, () => {
    repo.enrollContact(input.classSessionId, input.contactId);
    return agentOk(
      { classSessionId: input.classSessionId, contactId: input.contactId, roster: repo.listEnrollments(input.classSessionId) },
      { labels: settings.vocabulary, nextActions: ['get_class_session'] }
    );
  });
}

export function setEnrollmentChecklistCompletionTool(
  repo: AppRepository,
  input: EnrollmentChecklistCompletionInput,
  settingsOverride?: AppSettings
) {
  const { settings, denied } = requireEditAccess(settingsOverride);
  if (denied) return denied;
  return withRepositoryEnvelope(settings, () => {
    repo.setEnrollmentChecklistCompletion(input);
    return agentOk(
      { classSessionId: input.classSessionId, contactId: input.contactId, checklist: repo.listEnrollmentChecklistState(input.classSessionId) },
      { labels: settings.vocabulary, nextActions: ['get_class_session'] }
    );
  });
}

function clampLimit(limit: number | undefined) {
  return Math.min(Math.max(limit ?? 25, 1), 100);
}

function withRepositoryEnvelope<T>(settings: AppSettings, callback: () => AgentEnvelope<T>) {
  try {
    return callback();
  } catch (error) {
    return repositoryErrorEnvelope<T>(settings, error);
  }
}

function repositoryErrorEnvelope<T>(settings: AppSettings, error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown repository error.';
  if (/duplicate/i.test(message)) {
    return agentError<T>('conflict', message, undefined, { labels: settings.vocabulary });
  }
  if (/not found/i.test(message)) {
    return agentError<T>('not_found', message, undefined, { labels: settings.vocabulary });
  }
  return agentError<T>('validation_failed', message, undefined, { labels: settings.vocabulary });
}
