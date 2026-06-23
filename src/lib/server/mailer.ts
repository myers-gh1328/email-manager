import nodemailer from 'nodemailer';
import { randomUUID } from 'node:crypto';
import { repo } from './app';
import { getMicrosoftSmtpAccessToken } from './microsoft-oauth';
import { getSettings, getSmtpPassword } from './settings';

export async function sendEmail(to: string, subject: string, text: string) {
  const result = await sendOutboundEmail({ to, subject, text });
  return result.providerMessage;
}

export interface OutboundEmailInput {
  to: string;
  subject: string;
  text: string;
}

export interface OutboundEmailResult {
  providerMessage: string;
  originalRecipient: string;
  effectiveRecipient: string;
  testMode: boolean;
  finalText: string;
  finalHtml: string;
  messageId: string;
}

export async function sendOutboundEmail(input: OutboundEmailInput): Promise<OutboundEmailResult> {
  const settings = getSettings();
  if (!settings.smtpHost || !settings.smtpFrom) {
    throw new Error('SMTP host and sender address must be configured before sending.');
  }
  const originalRecipient = input.to;
  const effectiveRecipient = settings.emailTestModeEnabled ? settings.smtpFrom : originalRecipient;
  const finalText = applySignature(input.text, settings.emailSignature);
  const finalHtml = textToEmailHtml(finalText);
  const messageId = createOutboundMessageId(settings.publicBaseUrl);

  const transporter = nodemailer.createTransport({
    host: settings.smtpHost,
    port: Number(settings.smtpPort || 587),
    secure: Number(settings.smtpPort) === 465,
    auth: await smtpAuth()
  });

  const result = await transporter.sendMail({
    from: settings.smtpFrom,
    to: effectiveRecipient,
    subject: input.subject,
    messageId,
    text: finalText,
    html: finalHtml
  });
  assertRecipientAccepted(result, effectiveRecipient);

  const providerMessage = result.messageId || 'smtp-accepted';
  if (settings.emailTestModeEnabled) {
    try {
      repo.recordEmailTestAudit({
        originalRecipient,
        effectiveRecipient,
        subject: input.subject,
        body: finalText,
        providerMessage
      });
    } catch {
      console.error('Email test audit recording failed after SMTP acceptance.');
    }
  }

  return {
    providerMessage,
    originalRecipient,
    effectiveRecipient,
    testMode: settings.emailTestModeEnabled,
    finalText,
    finalHtml,
    messageId
  };
}

function assertRecipientAccepted(result: unknown, effectiveRecipient: string) {
  if (!result || typeof result !== 'object') return;
  const expected = normalizeAddress(effectiveRecipient);
  const accepted = Array.isArray((result as { accepted?: unknown }).accepted) ? (result as { accepted: unknown[] }).accepted.map((value) => normalizeAddress(String(value))) : undefined;
  const rejected = Array.isArray((result as { rejected?: unknown }).rejected) ? (result as { rejected: unknown[] }).rejected.map((value) => normalizeAddress(String(value))) : undefined;
  if (rejected?.includes(expected) || accepted?.length === 0 || (accepted && accepted.length > 0 && !accepted.includes(expected))) {
    throw new Error('SMTP provider did not accept the recipient.');
  }
}

function normalizeAddress(value: string) {
  const bracketed = value.match(/<([^>]+)>/)?.[1] ?? value;
  return bracketed.trim().toLowerCase();
}

export async function testSmtpSettings(to: string) {
  return sendEmail(to, 'Training Communications Studio email test', 'Your SMTP settings are working.');
}

export function applySignature(text: string, signature: string) {
  const trimmedSignature = signature.trim();
  if (!trimmedSignature) return text;
  return `${text.trimEnd()}\n\n${trimmedSignature}`;
}

export function textToEmailHtml(text: string) {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('\n');
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function createOutboundMessageId(publicBaseUrl: string) {
  let host = 'training-communications.local';
  try {
    if (publicBaseUrl) host = new URL(publicBaseUrl).hostname || host;
  } catch {
    host = 'training-communications.local';
  }
  return `<tcs-${randomUUID()}@${host}>`;
}

export function canSend() {
  const settings = getSettings();
  if (!settings.smtpHost || !settings.smtpFrom) return false;
  if (settings.smtpAuthMethod === 'microsoft-oauth2') {
    return Boolean(settings.smtpUser && repo.getSetting('microsoft.refreshToken'));
  }
  return Boolean(settings.smtpUser ? repo.getSetting('smtp.password') : true);
}

async function smtpAuth() {
  const settings = getSettings();
  if (!settings.smtpUser) return undefined;
  if (settings.smtpAuthMethod === 'microsoft-oauth2') {
    return {
      type: 'OAuth2' as const,
      user: settings.smtpUser,
      accessToken: await getMicrosoftSmtpAccessToken()
    };
  }
  return {
    user: settings.smtpUser,
    pass: getSmtpPassword()
  };
}
