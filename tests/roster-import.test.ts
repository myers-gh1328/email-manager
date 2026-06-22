import { describe, expect, test, vi } from 'vitest';
import { createTestRepository } from './repository-helpers';
import { extractRosterRowsFromImage, importContactRows, importRosterRows, parseRosterCsv } from '../src/lib/server/roster-import';

describe('roster import', () => {
  test('parses roster CSV with common student columns', () => {
    expect(
      parseRosterCsv('First Name,Last Name,Email,Phone,Notes\nMaya,Patel,maya@example.com,555-0100,Needs gear\n')
    ).toEqual([
      {
        firstName: 'Maya',
        lastName: 'Patel',
        email: 'maya@example.com',
        phone: '555-0100',
        notes: 'Needs gear'
      }
    ]);
  });

  test('creates missing contacts, reuses existing email matches, and enrolls rows', () => {
    const repo = createTestRepository();
    const existing = repo.createContact({ firstName: 'Maya', lastName: 'Patel', email: 'maya@example.com' });
    const course = repo.createCourseType({ name: 'Open Water' });
    const session = repo.createClassSession({ courseTypeId: course.id, startsOn: '2026-07-12', location: 'Pool' });

    const result = importRosterRows(repo, session.id, [
      { firstName: 'Maya', lastName: 'Patel', email: 'maya@example.com' },
      { firstName: 'Jo', lastName: 'Kim', email: 'jo@example.com', phone: '555-0199' },
      { firstName: '', lastName: 'Missing', email: '' }
    ]);

    expect(result).toEqual({ created: 1, reused: 1, skipped: 1, enrolled: 2 });
    expect(repo.listEnrollments(session.id).map((contact) => contact.id).sort()).toEqual(
      [existing.id, repo.listContacts().find((contact) => contact.email === 'jo@example.com')?.id].sort()
    );
  });

  test('reports enrolled count from unique persisted roster enrollments', () => {
    const repo = createTestRepository();
    const course = repo.createCourseType({ name: 'Open Water' });
    const session = repo.createClassSession({ courseTypeId: course.id, startsOn: '2026-07-12', location: 'Pool' });

    const result = importRosterRows(repo, session.id, [
      { firstName: 'Maya', lastName: 'Patel', email: 'maya@example.com' },
      { firstName: 'Maya', lastName: 'Patel', email: 'maya@example.com' },
      { firstName: 'Maya', lastName: 'Patel', email: 'MAYA@example.com' }
    ]);

    expect(result.enrolled).toBe(1);
    expect(repo.listEnrollments(session.id)).toHaveLength(1);
  });

  test('imports contacts without requiring a class session', () => {
    const repo = createTestRepository();
    repo.createContact({ firstName: 'Maya', lastName: 'Patel', email: 'maya@example.com' });

    const result = importContactRows(repo, [
      { firstName: 'Maya', lastName: 'Patel', email: 'maya@example.com' },
      { firstName: 'Lee', lastName: 'Morgan', email: 'lee@example.com', phone: '5550199000' }
    ]);

    expect(result.created).toBe(1);
    expect(result.reused).toBe(1);
    expect(result.skipped).toBe(0);
    expect(repo.listContacts().map((contact) => contact.email).sort()).toEqual(['lee@example.com', 'maya@example.com']);
    expect(repo.listContacts().find((contact) => contact.email === 'lee@example.com')?.phone).toBe('(555) 019-9000');
  });

  test('requires an enabled vision model before extracting rows from an image', async () => {
    await expect(
      extractRosterRowsFromImage(
        {
          aiEnabled: true,
          aiVisionEnabled: false,
          aiBaseUrl: 'http://localhost:1234/v1',
          aiModel: 'local-text-only',
          aiApiKeyConfigured: false
        },
        vi.fn(),
        'data:image/png;base64,abc'
      )
    ).rejects.toThrow('Enable a vision-capable AI model before importing screenshots.');
  });
});
