import { createHmac } from 'node:crypto';
import { findMissingVariables, renderTemplate } from '../shared/template';
import { getAppSecret } from './app-secret';

interface ContactLike {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  doNotEmail?: boolean;
}

interface DirectEmailRepository {
  getContact(id: string): ContactLike;
  recordCommunication(input: {
    contactId: string;
    channel: 'email';
    source: 'direct';
    originalRecipient?: string;
    effectiveRecipient?: string;
    testMode?: boolean;
    subject: string;
    body: string;
    status: 'accepted' | 'failed';
    messageId?: string;
    providerMessage?: string;
    errorMessage?: string;
  }): unknown;
}

export interface DirectEmailInput {
  contactIds: string[];
  subject: string;
  body: string;
  instructorName: string;
  previewToken?: string;
}

export interface DirectEmailPreview {
  contact: ContactLike;
  subject: string;
  body: string;
  missing: string[];
}

export interface DirectEmailSendResult {
  sent: number;
  failed: number;
  previews: DirectEmailPreview[];
}

type SendEmail = (
  to: string,
  subject: string,
  text: string
) => Promise<string | { providerMessage: string; originalRecipient: string; effectiveRecipient: string; testMode: boolean; finalText: string; messageId?: string }>;

export function previewDirectEmail(repo: DirectEmailRepository, input: DirectEmailInput): DirectEmailPreview[] {
  const uniqueContactIds = [...new Set(input.contactIds)];
  return uniqueContactIds.map((contactId) => {
    const contact = repo.getContact(contactId);
    const variables = variablesForContact(contact, input.instructorName);
    return {
      contact,
      subject: renderTemplate(input.subject, variables),
      body: renderTemplate(input.body, variables),
      missing: [...findMissingVariables(input.subject, variables), ...findMissingVariables(input.body, variables)]
    };
  });
}

export function directEmailPreviewToken(input: Pick<DirectEmailInput, 'contactIds' | 'subject' | 'body'>) {
  return signedPreviewToken({
    contactIds: [...new Set(input.contactIds)].sort(),
    subject: input.subject,
    body: input.body
  });
}

export async function sendDirectEmail(
  repo: DirectEmailRepository,
  sendEmail: SendEmail,
  input: DirectEmailInput
): Promise<DirectEmailSendResult> {
  if (input.previewToken !== directEmailPreviewToken(input)) {
    throw new Error('Preview this exact email before sending.');
  }
  const previews = previewDirectEmail(repo, input);
  if (previews.some((preview) => preview.missing.length > 0)) {
    throw new Error('Resolve missing template variables before sending.');
  }
  const blocked = previews.find((preview) => preview.contact.doNotEmail);
  if (blocked) {
    throw new Error(`${contactName(blocked.contact)} is marked do not email.`);
  }

  let sent = 0;
  let failed = 0;
  for (const preview of previews) {
    try {
      const result = await sendEmail(preview.contact.email, preview.subject, preview.body);
      const normalized = typeof result === 'string' ? { providerMessage: result, finalText: preview.body, testMode: false } : result;
      repo.recordCommunication({
        contactId: preview.contact.id,
        channel: 'email',
        source: 'direct',
        originalRecipient: preview.contact.email,
        effectiveRecipient: 'effectiveRecipient' in normalized ? normalized.effectiveRecipient : preview.contact.email,
        testMode: normalized.testMode,
        subject: preview.subject,
        body: normalized.finalText,
        status: 'accepted',
        messageId: 'messageId' in normalized ? normalized.messageId : undefined,
        providerMessage: normalized.providerMessage
      });
      sent += 1;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      repo.recordCommunication({
        contactId: preview.contact.id,
        channel: 'email',
        source: 'direct',
        originalRecipient: preview.contact.email,
        effectiveRecipient: preview.contact.email,
        testMode: false,
        subject: preview.subject,
        body: preview.body,
        status: 'failed',
        errorMessage
      });
      failed += 1;
    }
  }

  return { sent, failed, previews };
}

function variablesForContact(contact: ContactLike, instructorName: string) {
  return {
    firstName: contact.firstName,
    fullName: contactName(contact),
    instructorName
  };
}

function contactName(contact: ContactLike) {
  return `${contact.firstName} ${contact.lastName}`.trim();
}

function signedPreviewToken(payload: unknown) {
  const serialized = JSON.stringify(payload);
  const signature = createHmac('sha256', previewTokenSecret()).update(serialized).digest('hex');
  return `${signature}.${Buffer.from(serialized).toString('base64url')}`;
}

function previewTokenSecret() {
  return getAppSecret();
}
