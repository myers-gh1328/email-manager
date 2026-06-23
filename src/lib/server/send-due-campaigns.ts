import { renderTemplate } from '../shared/template';
import { variablesFor } from './form-utils';
import { sendOutboundEmail } from './mailer';
import type { AppRepository } from './repository';
import type { AppSettings } from './settings';

export async function sendDueCampaignsWithDependencies(
  repository: Pick<
    AppRepository,
    | 'listCampaigns'
    | 'getClassSession'
    | 'getTemplate'
    | 'ensurePendingDeliveries'
    | 'claimNextPendingDelivery'
    | 'getContact'
    | 'markDeliverySent'
    | 'markDeliveryFailed'
    | 'recordCommunication'
  >,
  settings: Pick<AppSettings, 'schedulerEnabled' | 'emailTestModeEnabled' | 'instructorName'>,
  sendEmail = sendOutboundEmail
) {
  if (!settings.schedulerEnabled) return 0;
  if (settings.emailTestModeEnabled) return 0;
  let sent = 0;

  for (const campaign of repository.listCampaigns()) {
    if (!campaign.approved || new Date(campaign.scheduledFor).getTime() > Date.now()) continue;
    const classSession = repository.getClassSession(campaign.classSessionId);
    const template = repository.getTemplate(campaign.templateId);
    repository.ensurePendingDeliveries(campaign.id);

    let delivery = repository.claimNextPendingDelivery(campaign.id);
    while (delivery) {
      const contact = repository.getContact(delivery.recipientId);
      const variables = variablesFor(contact, classSession, settings.instructorName);
      const subject = renderTemplate(template.subject, variables);
      const body = renderTemplate(template.body, variables);
      sent += await sendDelivery(repository, campaign.id, delivery.id, contact, subject, body, sendEmail);
      delivery = repository.claimNextPendingDelivery(campaign.id);
    }
  }

  return sent;
}

async function sendDelivery(
  repository: Pick<AppRepository, 'markDeliverySent' | 'markDeliveryFailed' | 'recordCommunication'>,
  campaignId: string,
  deliveryId: string,
  contact: ReturnType<AppRepository['getContact']>,
  subject: string,
  body: string,
  sendEmail: typeof sendOutboundEmail
) {
  let result: Awaited<ReturnType<typeof sendOutboundEmail>>;
  try {
    result = await sendEmail({ to: contact.email, subject, text: body });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    repository.markDeliveryFailed(deliveryId, errorMessage);
    repository.recordCommunication({
      contactId: contact.id,
      channel: 'email',
      source: 'campaign',
      sourceId: campaignId,
      originalRecipient: contact.email,
      effectiveRecipient: contact.email,
      testMode: false,
      subject,
      body,
      status: 'failed',
      errorMessage
    });
    return 0;
  }

  if (!result.testMode) {
    repository.markDeliverySent(deliveryId, result.providerMessage);
    repository.recordCommunication({
      contactId: contact.id,
      channel: 'email',
      source: 'campaign',
      sourceId: campaignId,
      originalRecipient: result.originalRecipient,
      effectiveRecipient: result.effectiveRecipient,
      testMode: result.testMode,
      subject,
      body: result.finalText,
      status: 'accepted',
      messageId: result.messageId,
      providerMessage: result.providerMessage
    });
  }
  return 1;
}
