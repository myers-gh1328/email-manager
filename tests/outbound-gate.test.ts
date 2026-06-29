import { describe, expect, test, beforeEach, vi } from 'vitest';
import { assertOutboundBatchAllowed, paceOutboundAttempt, reserveOutboundAttempt, resetOutboundGateForTests } from '../src/lib/server/outbound-gate';
import { classifyOutboundFailure, safeErrorSummary } from '../src/lib/server/outbound-errors';
import { createTestRepository } from './repository-helpers';

describe('outbound gate', () => {
  beforeEach(() => resetOutboundGateForTests());

  test('kill switch blocks outbound batches', () => {
    expect(() =>
      assertOutboundBatchAllowed({
        surface: 'direct_email',
        recipientCount: 1,
        settings: { outboundKillSwitchEnabled: true, outboundDirectMaxRecipients: 12 }
      })
    ).toThrow('Outbound email is paused in settings.');
  });

  test('direct recipient cap blocks oversized direct sends', () => {
    expect(() =>
      assertOutboundBatchAllowed({
        surface: 'direct_email',
        recipientCount: 13,
        settings: { outboundKillSwitchEnabled: false, outboundDirectMaxRecipients: 12 }
      })
    ).toThrow('Send to 12 or fewer recipients at a time.');
  });

  test('rate limit consumes one budget per reserved attempt', () => {
    const settings = { outboundMaxPerMinute: 1, outboundMaxPerHour: 50 };

    reserveOutboundAttempt({ surface: 'direct_email', settings, now: 100_000 });

    expect(() => reserveOutboundAttempt({ surface: 'direct_email', settings, now: 101_000 })).toThrow('Outbound rate limit reached.');
  });

  test('repository-backed rate limit persists reservations', () => {
    const repo = createTestRepository();

    repo.reserveOutboundRateEvent({ maxPerMinute: 1, maxPerHour: 50, nowIso: '2026-06-23T12:00:00.000Z' });

    expect(() =>
      repo.reserveOutboundRateEvent({ maxPerMinute: 1, maxPerHour: 50, nowIso: '2026-06-23T12:00:01.000Z' })
    ).toThrow('Outbound rate limit reached.');
  });

  test('repository-backed rate limit enforces hourly cap and prunes old reservations', () => {
    const repo = createTestRepository();

    repo.reserveOutboundRateEvent({ maxPerMinute: 10, maxPerHour: 1, nowIso: '2026-06-23T12:00:00.000Z' });

    expect(() =>
      repo.reserveOutboundRateEvent({ maxPerMinute: 10, maxPerHour: 1, nowIso: '2026-06-23T12:30:00.000Z' })
    ).toThrow('Outbound hourly limit reached.');
    expect(() =>
      repo.reserveOutboundRateEvent({ maxPerMinute: 10, maxPerHour: 1, nowIso: '2026-06-23T13:00:01.000Z' })
    ).not.toThrow();
  });

  test('pacing resolves immediately when disabled or running tests', async () => {
    expect(paceOutboundAttempt({ surface: 'direct_email', settings: { outboundPacingSeconds: 0 } })).toBeUndefined();

    vi.stubEnv('NODE_ENV', 'test');
    expect(paceOutboundAttempt({ surface: 'direct_email', settings: { outboundPacingSeconds: 5 } })).toBeUndefined();
    vi.unstubAllEnvs();
  });

  test('unknown send failures avoid review workflow wording', () => {
    const classified = classifyOutboundFailure({});
    const summary = safeErrorSummary({});

    expect(classified.summary).toBe('The mail server response was unclear. Check the failed send before retrying.');
    expect(summary).toBe('The mail server response was unclear. Check the failed send before retrying.');
    expect(classified.summary).not.toContain('Review before retrying');
    expect(summary).not.toContain('Review before retrying');
  });
});
