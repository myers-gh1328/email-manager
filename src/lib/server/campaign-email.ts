import { createHmac } from 'node:crypto';
import type { AppRepository } from './repository';
import { getAppSecret } from './app-secret';
import { variablesFor } from './form-utils';
import { findMissingVariables, renderTemplate } from '../shared/template';

export interface CampaignEmailPreview {
  contact: ReturnType<AppRepository['getContact']>;
  subject: string;
  body: string;
  missing: string[];
  skipped: boolean;
  reason: string;
}

export function buildCampaignEmailPreviews(
  repo: AppRepository,
  classSessionId: string,
  templateId: string,
  instructorName: string
): CampaignEmailPreview[] {
  const classSession = repo.getClassSession(classSessionId);
  const template = repo.getTemplate(templateId);
  return repo.listEnrollments(classSessionId).map((contact) => {
    const vars = variablesFor(contact, classSession, instructorName);
    return {
      contact,
      subject: renderTemplate(template.subject, vars),
      body: renderTemplate(template.body, vars),
      missing: [...findMissingVariables(template.subject, vars), ...findMissingVariables(template.body, vars)],
      skipped: contact.doNotEmail,
      reason: contact.doNotEmail ? 'Do not email' : ''
    };
  });
}

export function campaignEmailPreviewToken({
  classSessionId,
  template,
  previews
}: {
  classSessionId: string;
  template: { id: string; subject: string; body: string };
  previews: CampaignEmailPreview[];
}) {
  const payload = {
    classSessionId,
    templateId: template.id,
    subject: template.subject,
    body: template.body,
    recipients: previews.map((preview) => ({
      id: preview.contact.id,
      email: preview.contact.email,
      doNotEmail: preview.contact.doNotEmail,
      subject: preview.subject,
      body: preview.body,
      missing: preview.missing
    }))
  };
  return signedPreviewToken(payload);
}

export function scheduledForFromClassOffset(classSession: { startsOn: string; startTime?: string }, offsetMinutes: number) {
  const start = new Date(`${classSession.startsOn}T${classSession.startTime || '12:00'}:00`);
  start.setMinutes(start.getMinutes() + offsetMinutes);
  return toDateTimeLocalValue(start);
}

export function toDateTimeLocalValue(date: Date) {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function normalizeDateTimeLocal(value: string) {
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return toDateTimeLocalValue(date);
}

export function hasMissingVariables(previews: CampaignEmailPreview[]) {
  return previews.some((preview) => preview.missing.length > 0);
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function signedPreviewToken(payload: unknown) {
  const serialized = JSON.stringify(payload);
  const signature = createHmac('sha256', previewTokenSecret()).update(serialized).digest('hex');
  return `${signature}.${Buffer.from(serialized).toString('base64url')}`;
}

function previewTokenSecret() {
  return getAppSecret();
}
