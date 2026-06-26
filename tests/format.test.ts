import { describe, expect, test } from 'vitest';
import {
  deliveryStatusLabel,
  formatClassSchedule,
  messageStatusLabel,
  replySummary,
  scheduledEmailDeliverySummary,
  scheduledEmailStatusLabel,
  purposeLabel,
  timingLabel
} from '../src/lib/shared/format';

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

  test('formats technical send statuses for instructors', () => {
    expect(deliveryStatusLabel('retry_scheduled')).toBe('Will retry');
    expect(deliveryStatusLabel('needs_attention')).toBe('Needs attention');
    expect(deliveryStatusLabel('not planned')).toBe('Not prepared');
    expect(messageStatusLabel('accepted')).toBe('Accepted by mail server');
    expect(messageStatusLabel('sent')).toBe('Sent');
  });

  test('formats scheduled email readiness without approval wording', () => {
    expect(scheduledEmailStatusLabel(true)).toBe('Ready to send');
    expect(scheduledEmailStatusLabel(false)).toBe('Draft');
  });

  test('summarizes scheduled email delivery counts in operator language', () => {
    expect(scheduledEmailDeliverySummary({ recipientCount: 4, pendingCount: 3, sentCount: 1, failedCount: 0 })).toBe(
      '4 recipients · 3 prepared · 1 sent'
    );
    expect(scheduledEmailDeliverySummary({ recipientCount: 2, pendingCount: 0, sentCount: 1, failedCount: 1 })).toBe(
      '2 recipients · 1 sent · 1 needs attention'
    );
  });

  test('summarizes replies in plain instructor language', () => {
    expect(replySummary({ replyCount: 0, unhandledReplyCount: 0 })).toBe('No replies');
    expect(replySummary({ replyCount: 1, unhandledReplyCount: 0 })).toBe('1 reply handled');
    expect(replySummary({ replyCount: 1, unhandledReplyCount: 1 })).toBe('1 reply needs response');
    expect(replySummary({ replyCount: 3, unhandledReplyCount: 2 })).toBe('3 replies · 2 need response');
  });
});
