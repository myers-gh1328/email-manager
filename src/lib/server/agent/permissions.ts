export const agentPermissionKeys = [
  'viewData',
  'editRecords',
  'importData',
  'prepareEmail',
  'scheduleEmail',
  'sendEmail',
  'updateSettings',
  'manageAgentAccess'
] as const;

export type AgentPermissionKey = (typeof agentPermissionKeys)[number];
export type AgentPermissions = Record<AgentPermissionKey, boolean>;

export const defaultAgentPermissions: AgentPermissions = {
  viewData: true,
  editRecords: false,
  importData: false,
  prepareEmail: false,
  scheduleEmail: false,
  sendEmail: false,
  updateSettings: false,
  manageAgentAccess: false
};

export function settingKeyForAgentPermission(key: AgentPermissionKey) {
  return `agent.permission.${key}`;
}

export function normalizeAgentPermissions(values: Partial<Record<AgentPermissionKey, boolean | string>>): AgentPermissions {
  const permissions = { ...defaultAgentPermissions };
  for (const key of agentPermissionKeys) {
    const value = values[key];
    if (typeof value === 'boolean') permissions[key] = value;
    if (typeof value === 'string') permissions[key] = value === 'true' || value === 'on';
  }
  return permissions;
}
