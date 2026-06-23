import { defaultAgentPermissions } from '../src/lib/server/agent/permissions';
import { defaultVocabulary } from '../src/lib/server/agent/vocabulary';
import type { AppSettings } from '../src/lib/server/settings';

export function baseAppSettings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    instructorName: '',
    publicBaseUrl: '',
    schedulerEnabled: false,
    emailTestModeEnabled: false,
    emailSignature: '',
    outboundKillSwitchEnabled: false,
    outboundDirectMaxRecipients: 12,
    outboundPacingSeconds: 5,
    outboundMaxPerMinute: 10,
    outboundMaxPerHour: 50,
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
    replySyncHost: '',
    replySyncPort: '993',
    replySyncTls: true,
    replySyncUsername: '',
    replySyncPasswordConfigured: false,
    replySyncPollingEnabled: true,
    themeMode: 'system',
    agentEnabled: false,
    agentPermissions: defaultAgentPermissions,
    vocabulary: defaultVocabulary,
    ...overrides
  };
}
