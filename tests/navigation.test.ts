import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { navigationItems } from '../src/lib/shared/navigation';

describe('navigation visibility', () => {
  test('shows test audit only while email test mode is enabled', () => {
    expect(navigationItems({ emailTestModeEnabled: false }).map((item) => item.href)).not.toContain('/test-audit');
    expect(navigationItems({ emailTestModeEnabled: true }).map((item) => item.href)).toContain('/test-audit');
  });

  test('uses an icon-only mobile navigation toggle with an accessible label', () => {
    const layout = readFileSync('src/routes/+layout.svelte', 'utf8');
    expect(layout).toContain('aria-label={navOpen ?');
    expect(layout).toContain('<span aria-hidden="true"></span>');
    expect(layout).not.toContain('>Menu</button>');
  });
});
