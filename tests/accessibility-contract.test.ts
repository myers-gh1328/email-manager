import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

describe('app accessibility contracts', () => {
  test('active navigation exposes aria-current', () => {
    const layout = readFileSync('src/routes/+layout.svelte', 'utf8');

    expect(layout).toContain('aria-current');
  });

  test('interactive controls have a global focus-visible style', () => {
    const styles = readFileSync('src/styles.css', 'utf8');

    expect(styles).toContain(':focus-visible');
    expect(styles).toContain('outline');
  });

  test('keeps settings searchable and grouped with native collapsible sections', () => {
    const source = readFileSync('src/routes/settings/+page.svelte', 'utf8');

    expect(source).toContain('Search settings');
    expect(source).toContain('<details');
    expect(source).toContain('function sectionOpen');
    expect(source).toContain("Boolean(settingsSearch.trim())");
    expect(source).not.toContain('<details class="settings-section settings-panel" open>');
    expect(source).not.toContain('<details class="settings-section settings-panel wide" open>');
    expect(source).toContain('<summary>Agent Access</summary>');
    expect(source).toContain('<summary>Agent Permissions</summary>');
    expect(source).toContain('<summary>Vocabulary</summary>');
  });
});
