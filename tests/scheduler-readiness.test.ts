import { describe, expect, test } from 'vitest';
import { defaultAgentPermissions } from '../src/lib/server/agent/permissions';
import { defaultVocabulary } from '../src/lib/server/agent/vocabulary';
import { schedulerStatus } from '../src/lib/server/page-data';
import type { AppSettings } from '../src/lib/server/settings';

const baseSettings: AppSettings = {
  instructorName: 'Alex',
  publicBaseUrl: '',
  schedulerEnabled: true,
  emailTestModeEnabled: false,
  emailSignature: '',
  remoteAccessEnabled: false,
  trustedProxyEnabled: false,
  smtpHost: 'smtp.example.com',
  smtpPort: '587',
  smtpUser: 'alex@example.com',
  smtpFrom: 'alex@example.com',
  smtpAuthMethod: 'password',
  smtpPasswordConfigured: true,
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

describe('scheduler readiness', () => {
  test('blocks password SMTP when username is set but password is missing', () => {
    const status = schedulerStatus({ ...baseSettings, smtpPasswordConfigured: false }, []);

    expect(status.ready).toBe(false);
    expect(status.blockedReasons).toContain('SMTP authentication is incomplete');
  });

  test('blocks Microsoft SMTP when refresh token is missing', () => {
    const status = schedulerStatus(
      { ...baseSettings, smtpAuthMethod: 'microsoft-oauth2', microsoftRefreshTokenConfigured: false },
      []
    );

    expect(status.ready).toBe(false);
    expect(status.blockedReasons).toContain('Microsoft Outlook is not connected');
  });
});
