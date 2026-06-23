import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

describe('service worker contract', () => {
  const source = readFileSync('src/service-worker.ts', 'utf8');

  test('uses the current product cache namespace', () => {
    expect(source).toContain('training-communications-studio-${version}');
    expect(source).not.toContain('scuba-email-studio-${version}');
  });

  test('does not force activate a new worker over an active app session', () => {
    expect(source).not.toContain('skipWaiting()');
    expect(source).not.toContain('clients.claim()');
  });
});
