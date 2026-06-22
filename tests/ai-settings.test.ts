import { describe, expect, test } from 'vitest';
import { defaultAgentPermissions } from '../src/lib/server/agent/permissions';
import { defaultVocabulary } from '../src/lib/server/agent/vocabulary';
import { aiApiKeyForModelLoad } from '../src/lib/server/settings';
import type { AppSettings } from '../src/lib/server/settings';

const settings: AppSettings = {
  instructorName: 'Alex',
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
  aiEnabled: true,
  aiVisionEnabled: false,
  aiBaseUrl: 'http://localhost:1234/v1',
  aiModel: '',
  aiApiKeyConfigured: true,
  themeMode: 'system',
  agentEnabled: false,
  agentPermissions: defaultAgentPermissions,
  vocabulary: defaultVocabulary
};

describe('AI settings helpers', () => {
  test('does not reuse a saved AI key for a different posted base URL', () => {
    expect(aiApiKeyForModelLoad('http://evil.example/v1', '', settings, 'saved-key')).toBe('');
  });

  test('reuses a saved AI key only for the same base URL', () => {
    expect(aiApiKeyForModelLoad('http://localhost:1234/v1/', '', settings, 'saved-key')).toBe('saved-key');
  });

  test('prefers a newly posted AI key for unsaved model discovery', () => {
    expect(aiApiKeyForModelLoad('http://evil.example/v1', 'posted-key', settings, 'saved-key')).toBe('posted-key');
  });
});
