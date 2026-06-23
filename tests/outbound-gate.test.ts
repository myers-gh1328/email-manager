import { describe, expect, test, beforeEach } from 'vitest';
import { assertOutboundBatchAllowed, reserveOutboundAttempt, resetOutboundGateForTests } from '../src/lib/server/outbound-gate';

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

  test('rate limit consumes one budget per reserved attempt', () => {
    const settings = { outboundMaxPerMinute: 1, outboundMaxPerHour: 50 };

    reserveOutboundAttempt({ surface: 'direct_email', settings, now: 100_000 });

    expect(() => reserveOutboundAttempt({ surface: 'direct_email', settings, now: 101_000 })).toThrow('Outbound rate limit reached.');
  });
});
