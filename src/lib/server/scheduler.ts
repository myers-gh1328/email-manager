export type DeliveryStatus = 'pending' | 'sending' | 'sent' | 'failed' | 'skipped';

export interface CampaignDelivery {
  id: string;
  campaignId: string;
  recipientId: string;
  status: DeliveryStatus;
  createdAt: string;
  sentAt?: string;
  providerMessage?: string;
  errorMessage?: string;
}

export interface DeliveryPlanInput {
  campaignId: string;
  recipientIds: string[];
  existingDeliveries: CampaignDelivery[];
}

export function createDeliveryPlan(input: DeliveryPlanInput): CampaignDelivery[] {
  const completed = new Set(
    input.existingDeliveries
      .filter((delivery) => delivery.campaignId === input.campaignId && delivery.status === 'sent')
      .map((delivery) => delivery.recipientId)
  );
  const alreadyPlanned = new Set(
    input.existingDeliveries
      .filter((delivery) => delivery.campaignId === input.campaignId)
      .map((delivery) => delivery.recipientId)
  );
  const now = new Date().toISOString();

  return [...new Set(input.recipientIds)]
    .filter((recipientId) => !completed.has(recipientId) && !alreadyPlanned.has(recipientId))
    .map((recipientId) => ({
      id: `${input.campaignId}:${recipientId}`,
      campaignId: input.campaignId,
      recipientId,
      status: 'pending',
      createdAt: now
    }));
}

export function markDeliverySent(delivery: CampaignDelivery, providerMessage: string): CampaignDelivery {
  return {
    ...delivery,
    status: 'sent',
    sentAt: new Date().toISOString(),
    providerMessage,
    errorMessage: undefined
  };
}
