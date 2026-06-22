import { isAgentDev, repo } from './app';
import { variablesFor } from './form-utils';
import { sendOutboundEmail } from './mailer';
import { getSettings } from './settings';
import { renderTemplate } from '../shared/template';
import type { AppRepository } from './repository';
import type { AppSettings } from './settings';

let started = false;
let sendingDue = false;

export function startBackgroundScheduler() {
  if (started || isAgentDev || process.env.SCUBA_EMAIL_DISABLE_BACKGROUND === 'true') return;
  started = true;
  setInterval(() => {
    void sendDueCampaigns().catch((error) => {
      console.error('Scheduled send failed', error);
    });
  }, 60_000);
}

export async function sendDueCampaigns() {
  if (sendingDue) return 0;
  sendingDue = true;
  try {
    return await sendDueCampaignsWithDependencies(repo, getSettings());
  } finally {
    sendingDue = false;
  }
}

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
      try {
        const result = await sendEmail({ to: contact.email, subject, text: body });
        if (!result.testMode) {
          repository.markDeliverySent(delivery.id, result.providerMessage);
          repository.recordCommunication({
            contactId: contact.id,
            channel: 'email',
            source: 'campaign',
            sourceId: campaign.id,
            originalRecipient: result.originalRecipient,
            effectiveRecipient: result.effectiveRecipient,
            testMode: result.testMode,
            subject,
            body: result.finalText,
            status: 'accepted',
            providerMessage: result.providerMessage
          });
        }
        sent += 1;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        repository.markDeliveryFailed(delivery.id, errorMessage);
        repository.recordCommunication({
          contactId: contact.id,
          channel: 'email',
          source: 'campaign',
          sourceId: campaign.id,
          originalRecipient: contact.email,
          effectiveRecipient: contact.email,
          testMode: false,
          subject,
          body,
          status: 'failed',
          errorMessage
        });
      }
      delivery = repository.claimNextPendingDelivery(campaign.id);
    }
  }

  return sent;
}
