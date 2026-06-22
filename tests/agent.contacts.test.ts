import { describe, expect, it } from 'vitest';
import { createContactTool, searchContactsTool, updateContactTool } from '../src/lib/server/agent/tools/contacts';
import { defaultAgentPermissions } from '../src/lib/server/agent/permissions';
import type { AppSettings } from '../src/lib/server/settings';
import { createTestRepository } from './repository-helpers';
import { baseAppSettings } from './settings-helpers';

describe('agent contact tools', () => {
  it('returns contacts when agent access and viewData are enabled', () => {
    const repo = createTestRepository();
    repo.createContact({ firstName: 'Jane', lastName: 'Diver', email: 'jane@example.test' });

    const result = searchContactsTool(repo, { query: 'jane' }, agentSettings({ viewData: true }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.contacts).toHaveLength(1);
    expect(result.data.contacts[0].email).toBe('jane@example.test');
    expect(result.data).not.toHaveProperty('nextCursor');
    expect(result.labels.studentLabel).toBe('Student');
  });

  it('denies contact reads when agent access or viewData are disabled', () => {
    const repo = createTestRepository();

    const disabledAgent = searchContactsTool(repo, {}, agentSettings({ viewData: true }, false));
    const disabledView = searchContactsTool(repo, {}, agentSettings({ viewData: false }));

    for (const result of [disabledAgent, disabledView]) {
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.error.code).toBe('agent_permission_denied');
    }
  });

  it('denies contact mutations when editRecords is enabled but viewData is disabled', () => {
    const repo = createTestRepository();

    const result = createContactTool(
      repo,
      { firstName: 'Jane', lastName: 'Diver', email: 'jane@example.test' },
      agentSettings({ editRecords: true, viewData: false })
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('agent_permission_denied');
    expect(result.error.details).toEqual({ permission: 'viewData' });
  });

  it('denies contact creation when editRecords is disabled', () => {
    const repo = createTestRepository();

    const result = createContactTool(repo, { firstName: 'Jane', lastName: 'Diver', email: 'jane@example.test' }, agentSettings());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('agent_permission_denied');
    expect(result.error.details).toEqual({ permission: 'editRecords' });
  });

  it('denies contact updates when editRecords is disabled', () => {
    const repo = createTestRepository();
    const contact = repo.createContact({ firstName: 'Jane', lastName: 'Diver', email: 'jane@example.test' });

    const result = updateContactTool(
      repo,
      contact.id,
      {
        firstName: 'Janet',
        lastName: 'Diver',
        email: 'janet@example.test'
      },
      agentSettings()
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('agent_permission_denied');
  });

  it('returns conflict envelopes for duplicate contact emails', () => {
    const repo = createTestRepository();
    repo.createContact({ firstName: 'Jane', lastName: 'Diver', email: 'jane@example.test' });

    const result = createContactTool(
      repo,
      { firstName: 'Janet', lastName: 'Diver', email: 'JANE@example.test' },
      agentSettings({ editRecords: true })
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('conflict');
  });

  it('returns not_found envelopes for missing contacts', () => {
    const repo = createTestRepository();

    const result = updateContactTool(
      repo,
      'missing-contact',
      { firstName: 'Janet', lastName: 'Diver', email: 'janet@example.test' },
      agentSettings({ editRecords: true })
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('not_found');
  });
});

function agentSettings(permissions: Partial<AppSettings['agentPermissions']> = {}, agentEnabled = true): AppSettings {
  return baseAppSettings({
    agentEnabled,
    agentPermissions: { ...defaultAgentPermissions, ...permissions }
  });
}
