import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { normalizeThemeMode } from '../src/lib/shared/theme';

describe('theme mode', () => {
  test('normalizes persisted theme values', () => {
    expect(normalizeThemeMode('light')).toBe('light');
    expect(normalizeThemeMode('dark')).toBe('dark');
    expect(normalizeThemeMode('')).toBe('system');
    expect(normalizeThemeMode('neon')).toBe('system');
  });

	  test('keeps the theme toggle in app chrome instead of settings', () => {
    const layout = readFileSync('src/routes/+layout.svelte', 'utf8');
    const settingsPage = readFileSync('src/routes/settings/+page.svelte', 'utf8');

    expect(layout).toContain('action="/theme"');
    expect(layout).toContain('theme-toggle');
    expect(settingsPage).not.toContain('themeMode');
	    expect(settingsPage).not.toContain('theme-toggle');
	  });

	  test('applies theme mode to the document root', () => {
	    const layout = readFileSync('src/routes/+layout.svelte', 'utf8');
	    const styles = readFileSync('src/styles.css', 'utf8');

	    expect(layout).toContain('document.documentElement.dataset.theme');
	    expect(styles).toContain(":root[data-theme='dark']");
	  });
	});
