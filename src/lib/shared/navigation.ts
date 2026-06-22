export interface NavigationSettings {
  emailTestModeEnabled?: boolean;
}

export const baseNavItems = [
  { href: '/', label: 'Dashboard' },
  { href: '/contacts', label: 'Contacts' },
  { href: '/classes', label: 'Classes' },
  { href: '/templates', label: 'Templates' },
  { href: '/campaigns', label: 'Campaigns' },
  { href: '/communications', label: 'Communications' },
  { href: '/settings', label: 'Settings' }
];

export function navigationItems(settings?: NavigationSettings) {
  if (!settings?.emailTestModeEnabled) return baseNavItems;
  return [...baseNavItems.slice(0, -1), { href: '/test-audit', label: 'Test audit' }, baseNavItems[baseNavItems.length - 1]];
}
