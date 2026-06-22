import nodemailer from 'nodemailer';
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
    text: finalText,
    html: finalHtml
  });

  const providerMessage = result.messageId || 'smtp-accepted';
  if (settings.emailTestModeEnabled) {
    repo.recordEmailTestAudit({
      originalRecipient,
      effectiveRecipient,
      subject: input.subject,
      body: finalText,
      providerMessage
    });
  }

  return {
    providerMessage,
    originalRecipient,
    effectiveRecipient,
    testMode: settings.emailTestModeEnabled,
    finalText,
    finalHtml
  };
}

export async function testSmtpSettings(to: string) {
  return sendEmail(to, 'Scuba email app test', 'Your SMTP settings are working.');
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
