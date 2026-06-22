import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

describe('roster image import UI', () => {
  test('allows phone camera capture only when AI image import is configured', () => {
    const source = readFileSync('src/routes/classes/[id]/+page.svelte', 'utf8');

    expect(source).toContain('aiImageImportReady');
    expect(source).toContain('data.settings.aiBaseUrl');
    expect(source).toContain('data.settings.aiModel');
    expect(source).toContain('accept="image/*" capture="environment"');
  });
});
