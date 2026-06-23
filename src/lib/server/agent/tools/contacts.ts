import type { AppRepository, ContactInput } from '../../repository';
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

export function searchContactsTool(repo: AppRepository, input: { query?: string; limit?: number }, settingsOverride?: AppSettings) {
  const { settings, denied } = requireReadAccess(settingsOverride);
  if (denied) return denied;
  const query = (input.query ?? '').trim().toLowerCase();
  const limit = clampLimit(input.limit);
  const contacts = repo
    .listContacts()
    .filter((contact) => {
      if (!query) return true;
      return [contact.firstName, contact.lastName, contact.email, contact.phone, contact.notes].join(' ').toLowerCase().includes(query);
    })
    .slice(0, limit);
  return agentOk({ contacts }, { labels: settings.vocabulary, nextActions: ['create_contact', 'update_contact'] });
}

export function createContactTool(repo: AppRepository, input: ContactInput, settingsOverride?: AppSettings) {
  const { settings, denied } = requireEditAccess(settingsOverride);
  if (denied) return denied;
  return withRepositoryEnvelope(settings, () => {
    const contact = repo.createContact(input);
    return agentOk({ contact }, { labels: settings.vocabulary, nextActions: ['search_contacts', 'update_contact'] });
  });
}

export function updateContactTool(repo: AppRepository, id: string, input: ContactInput, settingsOverride?: AppSettings) {
  const { settings, denied } = requireEditAccess(settingsOverride);
  if (denied) return denied;
  return withRepositoryEnvelope(settings, () => {
    const contact = repo.updateContact(id, input);
    return agentOk({ contact }, { labels: settings.vocabulary, nextActions: ['search_contacts'] });
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
