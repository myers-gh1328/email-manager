import { describe, expect, it } from 'vitest';
import { createTemplateTool, listTemplatesTool, updateTemplateTool } from '../src/lib/server/agent/tools/templates';
import { defaultAgentPermissions } from '../src/lib/server/agent/permissions';
import { defaultVocabulary } from '../src/lib/server/agent/vocabulary';
import type { AppSettings } from '../src/lib/server/settings';
import { createTestRepository } from './repository-helpers';

describe('agent template tools', () => {
  it('returns templates when agent access and viewData are enabled', () => {
    const repo = createTestRepository();
    repo.createTemplate({ name: 'Welcome', subject: 'Welcome', body: 'Hello {{firstName}}' });

    const result = listTemplatesTool(repo, { query: 'welcome' }, agentSettings({ viewData: true }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.templates).toHaveLength(1);
    expect(result.data.templates[0].subject).toBe('Welcome');
    expect(result.data).not.toHaveProperty('nextCursor');
    expect(result.labels.studentLabel).toBe('Student');
  });

  it('denies template reads when agent access or viewData are disabled', () => {
    const repo = createTestRepository();

    const disabledAgent = listTemplatesTool(repo, {}, agentSettings({ viewData: true }, false));
    const disabledView = listTemplatesTool(repo, {}, agentSettings({ viewData: false }));

    for (const result of [disabledAgent, disabledView]) {
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.error.code).toBe('agent_permission_denied');
    }
  });

  it('denies template mutations when editRecords is enabled but viewData is disabled', () => {
    const repo = createTestRepository();

    const result = createTemplateTool(
      repo,
      { name: 'Welcome', subject: 'Welcome', body: 'Hello' },
      agentSettings({ editRecords: true, viewData: false })
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('agent_permission_denied');
    expect(result.error.details).toEqual({ permission: 'viewData' });
  });

  it('denies template creation when editRecords is disabled', () => {
    const repo = createTestRepository();

    const result = createTemplateTool(repo, { name: 'Welcome', subject: 'Welcome', body: 'Hello' }, agentSettings());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('agent_permission_denied');
    expect(result.error.details).toEqual({ permission: 'editRecords' });
  });

  it('denies template updates when editRecords is disabled', () => {
    const repo = createTestRepository();
    const template = repo.createTemplate({ name: 'Welcome', subject: 'Welcome', body: 'Hello' });

    const result = updateTemplateTool(repo, template.id, { name: 'Updated', subject: 'Updated', body: 'Hi' }, agentSettings());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('agent_permission_denied');
  });

  it('returns not_found envelopes for missing templates', () => {
    const repo = createTestRepository();

    const result = updateTemplateTool(repo, 'missing-template', { name: 'Updated', subject: 'Updated', body: 'Hi' }, agentSettings({ editRecords: true }));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('not_found');
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
