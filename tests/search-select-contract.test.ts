import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

describe('SearchSelect contract', () => {
  test('submits through a real select instead of a hidden datalist value', () => {
    const source = readFileSync('src/lib/SearchSelect.svelte', 'utf8');

    expect(source).toContain('<select');
    expect(source).not.toContain('type="hidden"');
    expect(source).not.toContain('<datalist');
  });
});
