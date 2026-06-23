import { renderTemplate } from '../shared/template';
import { variablesFor } from './form-utils';
import { sendOutboundEmail } from './mailer';
import { assertOutboundBatchAllowed, paceOutboundAttempt, reserveOutboundAttempt, type OutboundSurface } from './outbound-gate';
import { classifyOutboundFailure } from './outbound-errors';
import type { AppRepository } from './repository';
import type { AppSettings } from './settings';

export async function sendDueCampaignsWithDependencies(
  repository: Pick<
    AppRepository,
    | 'listCampaigns'
    | 'getClassSession'
    | 'getTemplate'
    | 'ensurePendingDeliveries'
    | 'getContact'
    | 'markDeliverySent'
    | 'markDeliveryFailed'
    | 'claimNextPendingDelivery'
    | 'finalizeDeliveryAttemptAccepted'
    | 'finalizeDeliveryAttemptFailed'
    | 'markAcceptedAttemptAuditIncomplete'
    | 'updateDeliveryAttemptSnapshot'
    | 'recordCommunication'
  >,
  settings: Pick<
    AppSettings,
    | 'schedulerEnabled'
    | 'emailTestModeEnabled'
    | 'instructorName'
    | 'outboundKillSwitchEnabled'
    | 'outboundMaxPerMinute'
    | 'outboundMaxPerHour'
    | 'outboundPacingSeconds'
    | 'outboundDirectMaxRecipients'
  >,
  sendEmail = sendOutboundEmail,
  options: { surface?: OutboundSurface } = {}
) {
  if (!settings.schedulerEnabled) return 0;
  if (settings.emailTestModeEnabled) return 0;
  const surface = options.surface ?? 'campaign_auto';
  assertOutboundBatchAllowed({ surface, settings });
  let sent = 0;

  for (const campaign of repository.listCampaigns()) {
    if (!campaign.approved || new Date(campaign.scheduledFor).getTime() > Date.now()) continue;
    const classSession = repository.getClassSession(campaign.classSessionId);
    const template = repository.getTemplate(campaign.templateId);
    repository.ensurePendingDeliveries(campaign.id);

    let delivery = claimNext(repository, campaign.id, surface);
    while (delivery) {
      const contact = repository.getContact(delivery.recipientId);
      const variables = variablesFor(contact, classSession, settings.instructorName);
      const subject = renderTemplate(template.subject, variables);
      const body = renderTemplate(template.body, variables);
      sent += await sendDelivery(repository, campaign.id, delivery.id, delivery.attemptId ?? '', contact, subject, body, sendEmail, { surface, settings });
      delivery = claimNext(repository, campaign.id, surface);
    }
  }

  return sent;
}

function claimNext(
  repository: Pick<AppRepository, 'claimNextPendingDelivery'> & Partial<Pick<AppRepository, 'claimNextEligibleDelivery'>>,
  campaignId: string,
  surface: OutboundSurface
) {
  return repository.claimNextEligibleDelivery
    ? repository.claimNextEligibleDelivery(campaignId, {
        source: surface === 'mcp_send_due' ? 'agent' : surface === 'manual_send_due' ? 'manual' : 'automatic',
        subject: '',
        body: ''
      })
    : repository.claimNextPendingDelivery(campaignId);
}

async function sendDelivery(
  repository: Pick<
    AppRepository,
    | 'markDeliverySent'
    | 'markDeliveryFailed'
    | 'finalizeDeliveryAttemptAccepted'
    | 'finalizeDeliveryAttemptFailed'
    | 'markAcceptedAttemptAuditIncomplete'
    | 'updateDeliveryAttemptSnapshot'
    | 'recordCommunication'
  >,
  campaignId: string,
  deliveryId: string,
  attemptId: string,
  contact: ReturnType<AppRepository['getContact']>,
  subject: string,
  body: string,
  sendEmail: typeof sendOutboundEmail,
  gate: { surface: OutboundSurface; settings: Parameters<typeof reserveOutboundAttempt>[0]['settings'] }
) {
  if (attemptId) repository.updateDeliveryAttemptSnapshot({ attemptId, subject, body });
  let result: Awaited<ReturnType<typeof sendOutboundEmail>>;
  try {
    reserveOutboundAttempt(gate);
    const pacing = paceOutboundAttempt(gate);
    if (pacing) await pacing;
    result = await sendEmail({ to: contact.email, subject, text: body });
  } catch (error) {
    const classified = classifyOutboundFailure(error);
    if (attemptId) {
      repository.finalizeDeliveryAttemptFailed({
        deliveryId,
        attemptId,
        failureKind: classified.kind,
        failureSummary: classified.summary,
        retryable: classified.retryable
      });
    } else {
      repository.markDeliveryFailed(deliveryId, classified.summary);
    }
    repository.recordCommunication({
      contactId: contact.id,
      channel: 'email',
      source: 'campaign',
      sourceId: campaignId,
      deliveryAttemptId: attemptId || undefined,
      originalRecipient: contact.email,
      effectiveRecipient: contact.email,
      testMode: false,
      subject,
      body,
      status: 'failed',
      errorMessage: classified.summary
    });
    return 0;
  }

  if (!result.testMode) {
    try {
      if (attemptId) repository.finalizeDeliveryAttemptAccepted({ deliveryId, attemptId, providerMessage: result.providerMessage });
      else repository.markDeliverySent(deliveryId, result.providerMessage);
      repository.recordCommunication({
        contactId: contact.id,
        channel: 'email',
        source: 'campaign',
        sourceId: campaignId,
        deliveryAttemptId: attemptId || undefined,
        originalRecipient: result.originalRecipient,
        effectiveRecipient: result.effectiveRecipient,
        testMode: result.testMode,
        subject,
        body: result.finalText,
        status: 'accepted',
        messageId: result.messageId,
        providerMessage: result.providerMessage
      });
    } catch (error) {
      if (attemptId) {
        repository.markAcceptedAttemptAuditIncomplete({
          deliveryId,
          attemptId,
          summary: 'Mail server accepted this send, but local history was not fully recorded.'
        });
      }
      throw error;
    }
  }
  return 1;
}
