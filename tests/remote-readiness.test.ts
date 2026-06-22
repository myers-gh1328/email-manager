import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { defaultAgentPermissions } from '../src/lib/server/agent/permissions';
import { defaultVocabulary } from '../src/lib/server/agent/vocabulary';
import { remoteAccessStatus } from '../src/lib/server/page-data';
import type { AppSettings } from '../src/lib/server/settings';

const settings: AppSettings = {
  instructorName: 'Alex',
  publicBaseUrl: 'https://mail.example.com',
  schedulerEnabled: false,
  emailTestModeEnabled: false,
  emailSignature: '',
  remoteAccessEnabled: true,
  trustedProxyEnabled: true,
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
  agentEnabled: false,
  agentPermissions: defaultAgentPermissions,
  vocabulary: defaultVocabulary
};

describe('remote access readiness', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test('reports concrete blockers when remote mode is enabled without hardening', () => {
    vi.stubEnv('SCUBA_EMAIL_APP_SECRET', '');
    vi.stubEnv('SCUBA_EMAIL_APP_SECRET_FILE', join(mkdtempSync(join(tmpdir(), 'scuba-secret-')), 'missing-secret'));
    vi.stubEnv('SCUBA_EMAIL_SECURE_COOKIES', 'false');

    const status = remoteAccessStatus(settings);

    expect(status.ready).toBe(false);
    expect(status.blockedReasons).toContain('Configure a persistent app secret before remote access');
    expect(status.blockedReasons).toContain('Set SCUBA_EMAIL_SECURE_COOKIES=true when serving over HTTPS');
  });

  test('reports local mode when remote access is disabled', () => {
    expect(remoteAccessStatus({ ...settings, remoteAccessEnabled: false })).toEqual({
      enabled: false,
      ready: true,
      blockedReasons: []
    });
  });
});
