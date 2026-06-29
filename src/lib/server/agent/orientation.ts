import { loadDashboardData } from '../page-data';
import { agentError, agentOk } from './envelope';
import { agentPermissionKeys } from './permissions';

type DashboardData = ReturnType<typeof loadDashboardData>;

function requireAgentReadAccess(dashboard: DashboardData) {
  const { settings } = dashboard;
  if (!settings.agentEnabled) {
    return agentError(
      'agent_permission_denied',
      'Agent access is disabled.',
      { permission: 'agentEnabled' },
      { labels: settings.vocabulary }
    );
  }
  if (!settings.agentPermissions.viewData) {
    return agentError(
      'agent_permission_denied',
      'Agents are not allowed to view app data.',
      { permission: 'viewData' },
      { labels: settings.vocabulary }
    );
  }
  return null;
}

export function getSchedulerReadiness() {
  const dashboard = loadDashboardData();
  const denied = requireAgentReadAccess(dashboard);
  if (denied) return denied;
  const status = dashboard.schedulerStatus;
  return agentOk(
    {
      ready: status.ready,
      blockedReasons: status.blockedReasons,
      dueReadyCount: status.dueReadyCount,
      nextReady: status.nextReady
        ? {
            id: status.nextReady.id,
            classSessionId: status.nextReady.classSessionId,
            templateId: status.nextReady.templateId,
            scheduledFor: status.nextReady.scheduledFor,
            ready: status.nextReady.readyToSend
          }
        : null,
      schedulerEnabled: dashboard.settings.schedulerEnabled,
      emailTestModeEnabled: dashboard.settings.emailTestModeEnabled,
      smtpConfigured: Boolean(dashboard.settings.smtpHost && dashboard.settings.smtpFrom),
      smtpPasswordConfigured: dashboard.settings.smtpPasswordConfigured,
      microsoftRefreshTokenConfigured: dashboard.settings.microsoftRefreshTokenConfigured,
      smtpAuthMethod: dashboard.settings.smtpAuthMethod
    },
    { labels: dashboard.settings.vocabulary }
  );
}

export function getAgentCapabilities() {
  const { settings } = loadDashboardData();
  const unavailableOperations = agentPermissionKeys
    .filter((key) => !settings.agentPermissions[key])
    .map((permission) => ({ permission, reason: 'Permission is disabled in settings.' }));

  return agentOk(
    {
      agentEnabled: settings.agentEnabled,
      permissions: settings.agentPermissions,
      unavailableOperations,
      tools: ['get_app_overview', 'get_scheduler_readiness', 'get_agent_capabilities']
    },
    {
      labels: settings.vocabulary,
      nextActions: settings.agentEnabled ? ['get_app_overview'] : ['Enable agent access in settings.']
    }
  );
}

export function getAppOverview() {
  const dashboard = loadDashboardData();
  const denied = requireAgentReadAccess(dashboard);
  if (denied) return denied;
  const { settings } = dashboard;
  return agentOk(
    {
      productName: 'Training Communications Studio',
      stats: dashboard.stats,
      schedulerStatus: dashboard.schedulerStatus,
      remoteStatus: dashboard.remoteStatus,
      settingsReadiness: {
        instructorNameConfigured: Boolean(settings.instructorName),
        publicBaseUrlConfigured: Boolean(settings.publicBaseUrl),
        schedulerEnabled: settings.schedulerEnabled,
        emailTestModeEnabled: settings.emailTestModeEnabled,
        remoteAccessEnabled: settings.remoteAccessEnabled,
        trustedProxyEnabled: settings.trustedProxyEnabled,
        smtpConfigured: Boolean(settings.smtpHost && settings.smtpFrom),
        smtpAuthMethod: settings.smtpAuthMethod,
        smtpPasswordConfigured: settings.smtpPasswordConfigured,
        microsoftClientSecretConfigured: settings.microsoftClientSecretConfigured,
        microsoftRefreshTokenConfigured: settings.microsoftRefreshTokenConfigured,
        aiEnabled: settings.aiEnabled,
        aiVisionEnabled: settings.aiVisionEnabled,
        aiBaseUrlConfigured: Boolean(settings.aiBaseUrl),
        aiModelConfigured: Boolean(settings.aiModel),
        aiApiKeyConfigured: settings.aiApiKeyConfigured,
        agentEnabled: settings.agentEnabled
      }
    },
    { labels: settings.vocabulary, nextActions: ['get_scheduler_readiness', 'get_agent_capabilities'] }
  );
}
