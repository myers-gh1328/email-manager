import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

describe('layout busy overlay contract', () => {
  test('does not attach global submit busy handling to enhanced forms', () => {
    const layout = readFileSync('src/routes/+layout.svelte', 'utf8');
    expect(layout).not.toContain("document.addEventListener('submit'");
    expect(layout).toContain("document.addEventListener('click'");
  });
});
