export type ThemeMode = 'system' | 'light' | 'dark';

export function normalizeThemeMode(value: string): ThemeMode {
  return value === 'light' || value === 'dark' ? value : 'system';
}
