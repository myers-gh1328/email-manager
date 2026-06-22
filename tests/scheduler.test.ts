import { describe, expect, test } from 'vitest';
import { createDeliveryPlan, markDeliverySent } from '../src/lib/server/scheduler';

describe('scheduled campaign delivery', () => {
  test('creates one delivery per recipient and excludes already-sent recipients', () => {
    const firstPlan = createDeliveryPlan({
      campaignId: 'campaign-1',
      recipientIds: ['student-1', 'student-2'],
      existingDeliveries: []
    });

    expect(firstPlan.map((delivery) => delivery.recipientId)).toEqual(['student-1', 'student-2']);

    const sent = markDeliverySent(firstPlan[0], 'smtp-accepted');
    const secondPlan = createDeliveryPlan({
      campaignId: 'campaign-1',
      recipientIds: ['student-1', 'student-2'],
      existingDeliveries: [sent]
    });

    expect(secondPlan.map((delivery) => delivery.recipientId)).toEqual(['student-2']);
  });
});
