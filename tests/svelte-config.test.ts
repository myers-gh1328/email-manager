import { describe, expect, test } from 'vitest';
import { parseTrustedOrigins } from '../svelte.config.js';

describe('SvelteKit trusted origins', () => {
  test('accepts a deployment-provided list of exact origins', () => {
    expect(
      parseTrustedOrigins(
        ' http://192.0.2.10:3010,https://training.example.com '
      )
    ).toEqual(['http://192.0.2.10:3010', 'https://training.example.com']);
  });

  test.each([
    'https://training.example.com/path',
    'https://user:password@training.example.com',
    '*'
  ])('rejects non-origin trusted value %s', (value) => {
    expect(() => parseTrustedOrigins(value)).toThrow('exact http or https origins');
  });

  test('ignores empty list entries', () => {
    expect(parseTrustedOrigins(' , ')).toEqual([]);
  });
});
