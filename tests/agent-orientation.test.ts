import { describe, expect, it } from 'vitest';
import { repo } from '../src/lib/server/app';
import { encryptSecret } from '../src/lib/server/crypto';
import { getAgentCapabilities, getAppOverview, getSchedulerReadiness } from '../src/lib/server/agent/orientation';

describe('agent orientation tools', () => {
  it('returns capabilities in an agent envelope', () => {
    repo.setSetting('agent.enabled', 'true');
    repo.setSetting('agent.permission.viewData', 'true');
    repo.setSetting('agent.permission.sendEmail', 'false');

    const result = getAgentCapabilities();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.agentEnabled).toBe(true);
    expect(result.data.permissions.viewData).toBe(true);
    expect(result.data.unavailableOperations).toContainEqual({
      permission: 'sendEmail',
      reason: 'Permission is disabled in settings.'
    });
    expect(result.labels?.studentLabel).toBe('Student');
  });

  it('uses dashboard schedulerStatus for scheduler readiness', () => {
    repo.setSetting('agent.enabled', 'true');
    repo.setSetting('agent.permission.viewData', 'true');
    repo.setSetting('scheduler.enabled', 'false');

    const result = getSchedulerReadiness();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.ready).toBe(false);
    expect(result.data.blockedReasons).toContain('Scheduled sending is disabled');
    expect(result.data).toHaveProperty('dueReadyCount');
    expect(result.data).toHaveProperty('nextReady');
    expect(result.data).not.toHaveProperty('dueApprovedCount');
    expect(result.data).not.toHaveProperty('nextApproved');
    expect(result.data).not.toHaveProperty('schedulerReadiness');
  });

  it('does not expose decrypted secrets or database paths in app overview', () => {
    repo.setSetting('agent.enabled', 'true');
    repo.setSetting('agent.permission.viewData', 'true');
    repo.setSetting('smtp.password', encryptSecret('smtp-secret-value'));
    repo.setSetting('ai.apiKey', encryptSecret('ai-secret-value'));
    repo.setSetting('microsoft.clientSecret', encryptSecret('microsoft-secret-value'));

    const result = getAppOverview();

    expect(result.ok).toBe(true);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('smtp-secret-value');
    expect(serialized).not.toContain('ai-secret-value');
    expect(serialized).not.toContain('microsoft-secret-value');
    expect(serialized).not.toContain('scuba-email.sqlite');
    expect(serialized).not.toContain('SCUBA_EMAIL_DB');
  });

  it('blocks app overview when agent access is disabled', () => {
    repo.setSetting('agent.enabled', 'false');
    repo.setSetting('agent.permission.viewData', 'true');

    const result = getAppOverview();

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('agent_permission_denied');
    expect(result.error.details).toEqual({ permission: 'agentEnabled' });
    expect(result.labels.studentLabel).toBe('Student');
  });

  it('blocks scheduler readiness when viewData permission is disabled', () => {
    repo.setSetting('agent.enabled', 'true');
    repo.setSetting('agent.permission.viewData', 'false');

    const result = getSchedulerReadiness();

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('agent_permission_denied');
    expect(result.error.details).toEqual({ permission: 'viewData' });
    expect(result.labels.studentLabel).toBe('Student');
  });
});
