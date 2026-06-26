import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const userFacingFiles = [
  'src/app.html',
  'src/routes/+layout.svelte',
  'src/routes/+page.svelte',
  'src/routes/setup/+page.svelte',
  'src/routes/scheduled-emails/+page.svelte',
  'src/routes/classes/+page.svelte',
  'src/routes/contacts/+page.svelte',
  'src/routes/templates/+page.svelte',
  'src/routes/test-audit/+page.svelte',
  'static/icons/icon.svg',
  'static/manifest.webmanifest'
];

describe('app branding', () => {
  test('uses product-neutral app names in user-facing shell surfaces', () => {
    const manifest = JSON.parse(readFileSync('static/manifest.webmanifest', 'utf8'));

    expect(manifest.name).toBe('Training Communications Studio');
    expect(manifest.short_name).toBe('Training Comms');
    expect(readFileSync('src/app.html', 'utf8')).toContain('apple-mobile-web-app-title" content="Training Comms"');
    expect(readFileSync('static/icons/icon.svg', 'utf8')).toContain('Training Communications Studio');
  });

  test('does not show the legacy product name in user-facing shell surfaces', () => {
    const combined = userFacingFiles.map((file) => readFileSync(file, 'utf8')).join('\n');

    expect(combined).not.toContain('Scuba Email Studio');
    expect(combined).not.toContain('Scuba Email');
  });
});
