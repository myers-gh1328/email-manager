import { describe, expect, test } from 'vitest';
import { findMissingVariables, renderTemplate } from '../src/lib/shared/template';

describe('template personalization', () => {
  test('renders shared class information with per-student fields', () => {
    const result = renderTemplate('Hi {{firstName}}, welcome to {{courseName}} on {{classDate}}.', {
      firstName: 'Maya',
      courseName: 'Open Water',
      classDate: 'July 12, 2026'
    });

    expect(result).toBe('Hi Maya, welcome to Open Water on July 12, 2026.');
  });

  test('reports missing variables before sending', () => {
    const missing = findMissingVariables('Hi {{firstName}}, meet at {{classLocation}}.', {
      firstName: 'Maya'
    });

    expect(missing).toEqual(['classLocation']);
  });
});
