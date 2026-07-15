import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

describe('service worker contract', () => {
  const source = readFileSync('src/service-worker.ts', 'utf8');

  test('uses the current product cache namespace', () => {
    expect(source).toContain('training-communications-studio-${version}');
    expect(source).not.toContain('scuba-email-studio-${version}');
  });

  test('activates only when the shared lifecycle prompt requests it', () => {
    expect(source).toContain("import { installPwaUpdateHandler } from '@myers-gh1328/pwa-lifecycle'");
    expect(source).toContain('installPwaUpdateHandler(workerScope)');
    expect(source).not.toContain('clients.claim()');
  });

  test('disables SvelteKit auto-registration so the shared lifecycle owns registration', () => {
    expect(readFileSync('svelte.config.js', 'utf8')).toContain('register: false');
  });
});
