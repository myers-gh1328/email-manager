import { describe, expect, test } from 'vitest';
import { variablesFor } from '../src/lib/server/form-utils';
import { classTemplateTokens, directEmailTokens } from '../src/lib/shared/template-fields';

describe('template field descriptors', () => {
  test('class template tokens match server-rendered class variables', () => {
    const variables = variablesFor(
      { firstName: 'Maya', lastName: 'Patel' },
      {
        courseName: 'Open Water',
        startsOn: '2026-08-02',
        endsOn: '2026-08-03',
        startTime: '09:00',
        location: 'Pool',
        notes: 'Bring gear.'
      },
      'Alex'
    );

    expect(classTemplateTokens.map((token) => token.replace(/[{}]/g, '')).sort()).toEqual(Object.keys(variables).sort());
  });

  test('direct email tokens stay intentionally narrower than class templates', () => {
    expect(directEmailTokens).toEqual(['{{firstName}}', '{{fullName}}', '{{instructorName}}']);
  });
});
