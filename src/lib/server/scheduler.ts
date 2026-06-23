export type DeliveryStatus = 'pending' | 'sending' | 'sent' | 'failed' | 'retry_scheduled' | 'needs_attention' | 'skipped';
export type FailureKind = 'transient' | 'permanent' | 'unknown' | '';
export type AttemptStatus = 'claimed' | 'accepted' | 'failed' | 'unknown' | 'abandoned' | 'accepted_audit_incomplete';
export type AttemptSource = 'automatic' | 'manual' | 'agent' | 'migrated';

export interface CampaignDelivery {
  id: string;
  campaignId: string;
  recipientId: string;
  status: DeliveryStatus;
  createdAt: string;
  sentAt?: string;
  providerMessage?: string;
  errorMessage?: string;
  attemptCount: number;
  lastAttemptAt?: string;
  nextAttemptAt?: string;
  claimExpiresAt?: string;
  failureKind?: FailureKind;
  failureSummary?: string;
  needsAuditRepair: boolean;
  retryPolicyMaxAutoRetries: number;
  retryPolicyBackoff: string;
  attemptId?: string;
  attemptNumber?: number;
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
      createdAt: now,
      attemptCount: 0,
      needsAuditRepair: false,
      retryPolicyMaxAutoRetries: 3,
      retryPolicyBackoff: '[300,1800,7200]'
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
