import { describe, expect, it } from 'vitest';
import { agentPermissionKeys, defaultAgentPermissions } from '../src/lib/server/agent/permissions';
import { defaultVocabulary, normalizeVocabulary } from '../src/lib/server/agent/vocabulary';

describe('agent settings defaults', () => {
  it('defaults to read-only agent permissions', () => {
    expect(defaultAgentPermissions.viewData).toBe(true);
    for (const key of agentPermissionKeys.filter((key) => key !== 'viewData')) {
      expect(defaultAgentPermissions[key]).toBe(false);
    }
  });

  it('uses stable default vocabulary labels', () => {
    expect(defaultVocabulary.courseTypeLabel).toBe('Course type');
    expect(defaultVocabulary.classSessionLabel).toBe('Class session');
    expect(defaultVocabulary.studentLabel).toBe('Student');
    expect(defaultVocabulary.instructorLabel).toBe('Instructor');
  });

  it('trims vocabulary overrides and falls back when blank', () => {
    const labels = normalizeVocabulary({
      courseTypeLabel: ' Program ',
      classSessionLabel: '',
      studentLabel: ' Participant ',
      instructorLabel: ''
    });
    expect(labels.courseTypeLabel).toBe('Program');
    expect(labels.classSessionLabel).toBe('Class session');
    expect(labels.studentLabel).toBe('Participant');
    expect(labels.instructorLabel).toBe('Instructor');
  });
});
