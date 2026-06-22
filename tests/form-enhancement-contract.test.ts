import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

describe('form enhancement contract', () => {
  test('page POST forms use SvelteKit enhancement to avoid refresh resubmission warnings', () => {
    const offenders = globSync('src/routes/**/+page.svelte')
      .flatMap((path) => {
        const content = readFileSync(path, 'utf8');
        return [...content.matchAll(/<form method="POST"(?<attrs>[^>]*)>/g)]
          .filter((match) => !match.groups?.attrs.includes('use:enhance'))
          .map((match) => `${path}:${lineNumber(content, match.index ?? 0)}`);
      });

    expect(offenders).toEqual([]);
  });
});

function lineNumber(content: string, index: number) {
  return content.slice(0, index).split('\n').length;
}
