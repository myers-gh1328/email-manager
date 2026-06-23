import { createHmac } from 'node:crypto';
import { findMissingVariables, renderTemplate } from '../shared/template';
import { getAppSecret } from './app-secret';
import { assertOutboundBatchAllowed, paceOutboundAttempt, reserveOutboundAttempt } from './outbound-gate';
import { classifyOutboundFailure } from './outbound-errors';
import type { AppSettings } from './settings';

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
  beginSendOperation?(input: {
    operationType: 'direct_email';
    sendOperationId: string;
    idempotencyKey: string;
    requestHash: string;
    recipients: Array<{ contactId: string; email: string }>;
  }): { id: string; status: string; resultSummary: string; failureSummary: string };
  getSendOperation?(sendOperationId: string): { id: string; status: string; resultSummary: string; failureSummary: string } | undefined;
  markSendOperationRecipient?(operationId: string, contactId: string, input: { status: 'accepted' | 'failed' | 'unknown'; providerMessage?: string; failureKind?: string; failureSummary?: string }): void;
  finishSendOperation?(operationId: string, input: { sent: number; failed: number }): void;
  reserveOutboundRateEvent?(input: { maxPerMinute: number; maxPerHour: number; nowIso?: string }): void;
}

export interface DirectEmailInput {
  contactIds: string[];
  subject: string;
  body: string;
  instructorName: string;
  previewToken?: string;
  settings?: Pick<
    AppSettings,
    'outboundKillSwitchEnabled' | 'outboundMaxPerMinute' | 'outboundMaxPerHour' | 'outboundPacingSeconds' | 'outboundDirectMaxRecipients'
  >;
  surface?: 'direct_email' | 'mcp_direct_email';
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
  if (input.settings) {
    assertOutboundBatchAllowed({ surface: input.surface ?? 'direct_email', settings: input.settings, recipientCount: previews.length });
  }
  if (previews.some((preview) => preview.missing.length > 0)) {
    throw new Error('Resolve missing template variables before sending.');
  }
  const blocked = previews.find((preview) => preview.contact.doNotEmail);
  if (blocked) {
    throw new Error(`${contactName(blocked.contact)} is marked do not email.`);
  }
  const operationId = directEmailOperationId(input);
  const existingOperation = repo.getSendOperation?.(operationId);
  if (existingOperation?.status === 'sending') {
    throw new Error('This send is already in progress.');
  }
  if (existingOperation?.status === 'needs_attention') {
    throw new Error(existingOperation.failureSummary || 'This send needs review before sending again.');
  }
  if (existingOperation?.resultSummary) {
    return { sent: acceptedCount(existingOperation.resultSummary), failed: failedCount(existingOperation.resultSummary), previews };
  }
  const operation = repo.beginSendOperation?.({
    operationType: 'direct_email',
    sendOperationId: operationId,
    idempotencyKey: operationId,
    requestHash: operationId,
    recipients: previews.map((preview) => ({ contactId: preview.contact.id, email: preview.contact.email }))
  });

  let sent = 0;
  let failed = 0;
  for (const preview of previews) {
    let result: Awaited<ReturnType<SendEmail>> | undefined = undefined;
    try {
      if (input.settings) {
        reserveRate(repo, input.settings);
        await paceOutboundAttempt({ surface: input.surface ?? 'direct_email', settings: input.settings });
      }
      result = await sendEmail(preview.contact.email, preview.subject, preview.body);
    } catch (error) {
      const classified = classifyOutboundFailure(error);
      repo.markSendOperationRecipient?.(operation?.id ?? '', preview.contact.id, {
        status: 'failed',
        failureKind: classified.kind,
        failureSummary: classified.summary
      });
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
        errorMessage: classified.summary
      });
      failed += 1;
    }

    if (result === undefined) continue;
    const normalized = typeof result === 'string' ? { providerMessage: result, finalText: preview.body, testMode: false } : result;
    repo.markSendOperationRecipient?.(operation?.id ?? '', preview.contact.id, { status: 'accepted', providerMessage: normalized.providerMessage });
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
  }
  if (operation) repo.finishSendOperation?.(operation.id, { sent, failed });

  return { sent, failed, previews };
}

function reserveRate(repo: DirectEmailRepository, settings: NonNullable<DirectEmailInput['settings']>) {
  if (repo.reserveOutboundRateEvent) {
    repo.reserveOutboundRateEvent({
      maxPerMinute: settings.outboundMaxPerMinute,
      maxPerHour: settings.outboundMaxPerHour
    });
    return;
  }
  reserveOutboundAttempt({ surface: 'direct_email', settings });
}

export function directEmailOperationId(input: Pick<DirectEmailInput, 'contactIds' | 'subject' | 'body' | 'previewToken'>) {
  return signedPreviewToken({
    previewToken: input.previewToken ?? '',
    contactIds: [...new Set(input.contactIds)].sort((left, right) => left.localeCompare(right)),
    subject: input.subject,
    body: input.body
  });
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

function acceptedCount(summary: string) {
  return Number(summary.match(/Accepted (\d+)/)?.[1] ?? 0);
}

function failedCount(summary: string) {
  return Number(summary.match(/failed (\d+)/i)?.[1] ?? 0);
}

function previewTokenSecret() {
  return getAppSecret();
}
