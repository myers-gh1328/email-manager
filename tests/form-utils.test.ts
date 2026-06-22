import { describe, expect, test } from 'vitest';
import { variablesFor } from '../src/lib/server/form-utils';

describe('form utilities', () => {
  test('builds class date and time template variables', () => {
    expect(
      variablesFor(
        { firstName: 'Maya', lastName: 'Patel' },
        {
          courseName: 'Open Water',
          startsOn: '2026-07-12',
          endsOn: '2026-07-14',
          startTime: '09:30',
          location: 'Blue Quarry',
          locationAddress: '123 Quarry Road',
          locationPhone: '555-0101',
          locationWebsite: 'https://example.com',
          locationParkingNotes: 'Park by the shop.',
          locationMeetingInstructions: 'Meet at the counter.',
          locationNotes: 'Bring waiver.',
          notes: 'Bring logbooks.'
        },
        'Alex Instructor'
      )
    ).toMatchObject({
      firstName: 'Maya',
      fullName: 'Maya Patel',
      courseName: 'Open Water',
      classDate: '2026-07-12',
      classStartDate: '2026-07-12',
      classEndDate: '2026-07-14',
      classStartTime: '09:30',
      classDateRange: '2026-07-12 - 2026-07-14',
      classLocation: 'Blue Quarry',
      locationName: 'Blue Quarry',
      locationAddress: '123 Quarry Road',
      locationPhone: '555-0101',
      locationWebsite: 'https://example.com',
      locationParkingNotes: 'Park by the shop.',
      locationMeetingInstructions: 'Meet at the counter.',
      locationNotes: 'Bring waiver.',
      classNotes: 'Bring logbooks.',
      instructorName: 'Alex Instructor'
    });
  });
});
