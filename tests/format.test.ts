import { describe, expect, test } from 'vitest';
import { formatClassSchedule, purposeLabel, timingLabel } from '../src/lib/shared/format';

describe('shared formatting helpers', () => {
  test('formats class schedules consistently', () => {
    expect(formatClassSchedule({ startsOn: '2026-08-02', startTime: '09:00' })).toBe('2026-08-02 · 09:00');
    expect(formatClassSchedule({ startsOn: '2026-08-02', endsOn: '2026-08-03' })).toBe('2026-08-02 - 2026-08-03');
  });

  test('formats inherited email purpose and timing labels', () => {
    expect(purposeLabel('pre_class_details')).toBe('Pre Class Details');
    expect(timingLabel(-24 * 60)).toBe('1 day before');
    expect(timingLabel(2 * 60)).toBe('2 hours after');
  });
});
