import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { navigationItems } from '../src/lib/shared/navigation';

describe('navigation visibility', () => {
  test('uses plain operator language for email workflow navigation', () => {
    const items = navigationItems({ emailTestModeEnabled: true });
    const labels = items.map((item) => item.label);
    expect(labels).toContain('Scheduled Emails');
    expect(labels).toContain('History');
    expect(labels).toContain('Test Sends');
    expect(labels).not.toContain('Campaigns');
    expect(labels).not.toContain('Communications');
    expect(labels).not.toContain('Test audit');
  });

  test('uses plain operator language on email workflow pages', () => {
    const scheduledEmailsPage = readFileSync('src/routes/campaigns/+page.svelte', 'utf8');
    const historyPage = readFileSync('src/routes/communications/+page.svelte', 'utf8');
    const testSendsPage = readFileSync('src/routes/test-audit/+page.svelte', 'utf8');

    expect(scheduledEmailsPage).toContain('<title>Scheduled Emails · Training Communications Studio</title>');
    expect(scheduledEmailsPage).toContain('<p class="eyebrow">Scheduled Emails</p>');
    expect(scheduledEmailsPage).not.toContain('>Campaigns<');
    expect(scheduledEmailsPage).not.toContain('Approved after preview');

    expect(historyPage).toContain('<title>History · Training Communications Studio</title>');
    expect(historyPage).toContain('<p class="eyebrow">History</p>');
    expect(historyPage).not.toContain('>Communications<');
    expect(historyPage).not.toContain('Scheduled campaign');

    expect(testSendsPage).toContain('<title>Test Sends · Training Communications Studio</title>');
    expect(testSendsPage).not.toContain('Test audit');
  });

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
