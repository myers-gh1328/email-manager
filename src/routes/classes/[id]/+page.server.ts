import { fail, redirect } from '@sveltejs/kit';
import { repo } from '$lib/server/app';
import { syncDefaultCampaignsForClass } from '$lib/server/class-default-campaigns';
import { errorText, required, text } from '$lib/server/form-utils';
import { loadContactOptions, loadTemplateOptions } from '$lib/server/page-data';
import {
  buildCampaignEmailPreviews,
  campaignEmailPreviewToken,
  hasMissingVariables,
  scheduledForFromClassOffset
} from '$lib/server/campaign-email';
import { extractRosterFromImage } from '$lib/server/llm';
import { importRosterRows, parseRosterCsv } from '$lib/server/roster-import';
import { getSettings } from '$lib/server/settings';

export const load = ({ params }) => ({
  ...repo.getClassSessionDetail(params.id),
  contactOptions: loadContactOptions(),
  courseTypes: repo.listCourseTypes(),
  locations: repo.listLocations(),
  templateOptions: loadTemplateOptions(),
  defaultTemplates: repo.listDefaultTemplatesForClassSession(params.id),
  scheduledCampaigns: repo.listCampaignsForClassSession(params.id),
  checklistState: repo.listEnrollmentChecklistState(params.id),
  settings: getSettings()
});

export const actions = {
	  updateClassSession: async ({ params, request }) => {
	    const form = await request.formData();
	    const startsOn = required(form, 'startsOn');
	    repo.updateClassSession(params.id, {
      courseTypeId: required(form, 'courseTypeId'),
      locationId: required(form, 'locationId'),
      startsOn,
      endsOn: text(form, 'endsOn') || startsOn,
      startTime: text(form, 'startTime'),
	      location: text(form, 'locationName'),
	      notes: text(form, 'notes')
	    });
	    const createdDefaults = syncDefaultCampaignsForClass(repo, params.id);
	    return {
	      message: classUpdatedMessage(createdDefaults.length)
	    };
	  },
  enrollContact: async ({ params, request }) => {
    const form = await request.formData();
    repo.enrollContact(params.id, required(form, 'contactId'));
    return { message: 'Student enrolled.' };
  },
  unenrollContact: async ({ params, request }) => {
    const form = await request.formData();
    repo.unenrollContact(params.id, required(form, 'contactId'));
    return { message: 'Student removed from roster.' };
  },
  toggleChecklistItem: async ({ params, request }) => {
    const form = await request.formData();
    repo.setEnrollmentChecklistCompletion({
      classSessionId: params.id,
      contactId: required(form, 'contactId'),
      itemScope: required(form, 'itemScope') === 'course_type' ? 'course_type' : 'global',
      itemId: required(form, 'itemId'),
      completed: text(form, 'completed') === 'true'
    });
    return { message: 'Prep item updated.' };
  },
  importCsv: async ({ params, request }) => {
    const form = await request.formData();
    const file = form.get('csvFile');
    if (!(file instanceof File) || file.size === 0) return { message: 'Choose a CSV file to import.' };
    const result = importRosterRows(repo, params.id, parseRosterCsv(await file.text()));
    return {
      message: `Imported roster: ${result.created} created, ${result.reused} reused, ${result.enrolled} enrolled, ${result.skipped} skipped.`
    };
  },
  importImage: async ({ params, request }) => {
    const settings = getSettings();
    if (!settings.aiEnabled || !settings.aiVisionEnabled || !settings.aiBaseUrl || !settings.aiModel) {
      return { message: 'Connect AI assistance and choose a vision-capable model before importing roster images.' };
    }
    const form = await request.formData();
    const file = form.get('imageFile');
    if (!(file instanceof File) || file.size === 0) return { message: 'Choose an image to import.' };
    const dataUrl = `data:${file.type || 'image/png'};base64,${Buffer.from(await file.arrayBuffer()).toString('base64')}`;
    try {
      const result = importRosterRows(repo, params.id, await extractRosterFromImage(dataUrl));
      return {
        panel: 'image',
        message: `Imported image roster: ${result.created} created, ${result.reused} reused, ${result.enrolled} enrolled, ${result.skipped} skipped.`
      };
    } catch (error) {
      return fail(400, { error: true, panel: 'image', message: errorText(error) });
    }
  },
  previewClassEmail: async ({ params, request }) => {
	    const form = await request.formData();
	    const choice = emailChoice(params.id, required(form, 'emailChoice'));
	    const previews = buildClassEmailPreviews(params.id, choice.templateId);
	    return {
      panel: 'email',
      previews,
      emailChoice: choice.value,
      templateId: choice.templateId,
      defaultPurpose: choice.defaultPurpose,
      defaultLabel: choice.defaultLabel,
      sendOffsetMinutes: choice.sendOffsetMinutes,
      suggestedScheduledFor: suggestedScheduledFor(params.id, choice.sendOffsetMinutes),
      previewToken: classEmailPreviewToken(params.id, choice.templateId)
    };
  },
  scheduleClassEmail: async ({ params, request }) => {
    const form = await request.formData();
    const templateId = required(form, 'templateId');
    if (text(form, 'previewToken') !== classEmailPreviewToken(params.id, templateId)) {
      return fail(400, { panel: 'email', message: 'Preview this class email before scheduling it.' });
    }
    const previews = buildClassEmailPreviews(params.id, templateId);
    if (hasMissingVariables(previews)) {
      return fail(400, { panel: 'email', previews, templateId, previewToken: classEmailPreviewToken(params.id, templateId), message: 'Resolve missing template variables before scheduling.' });
    }
    const template = repo.getTemplate(templateId);
    const defaultPurpose = text(form, 'defaultPurpose');
    const sendOffsetMinutes = text(form, 'sendOffsetMinutes');
    const campaign = repo.createCampaign({
      classSessionId: params.id,
      templateId,
      name: classEmailCampaignName(defaultPurpose, template.name),
      scheduledFor: required(form, 'scheduledFor'),
      approved: true,
      source: defaultPurpose ? 'course_default' : 'manual',
      defaultPurpose,
      defaultLabel: text(form, 'defaultLabel'),
      sendOffsetMinutes: sendOffsetMinutes ? Number(sendOffsetMinutes) : 0
    });
    repo.ensurePendingDeliveries(campaign.id);
    return { panel: 'email', message: 'Class email scheduled.' };
  },
  back: async () => {
    throw redirect(303, '/classes');
  }
};

function buildClassEmailPreviews(classSessionId: string, templateId: string) {
  return buildCampaignEmailPreviews(repo, classSessionId, templateId, getSettings().instructorName);
}

function suggestedScheduledFor(classSessionId: string, sendOffsetMinutes: number | undefined) {
  if (sendOffsetMinutes === undefined) return '';
  return scheduledForFromClassOffset(repo.getClassSession(classSessionId), sendOffsetMinutes);
}

function classUpdatedMessage(defaultCampaignCount: number) {
  if (defaultCampaignCount === 0) return 'Class updated.';
  const plural = defaultCampaignCount === 1 ? '' : 's';
  return `Class updated. Scheduled ${defaultCampaignCount} default email${plural}.`;
}

function classEmailPreviewToken(classSessionId: string, templateId: string) {
  const template = repo.getTemplate(templateId);
  const previews = buildClassEmailPreviews(classSessionId, templateId);
  return campaignEmailPreviewToken({ classSessionId, template, previews });
}

function emailChoice(classSessionId: string, value: string) {
  if (!value.startsWith('default:')) return { value, templateId: value, defaultPurpose: '', defaultLabel: '', sendOffsetMinutes: undefined };
  const [, purpose, templateId] = value.split(':');
  const match = repo
    .listDefaultTemplatesForClassSession(classSessionId)
    .find((item) => item.purpose === purpose && item.templateId === templateId);
  if (match) {
    return {
      value,
      templateId,
      defaultPurpose: match.purpose,
      defaultLabel: match.label,
      sendOffsetMinutes: match.sendOffsetMinutes
    };
  }
  return { value: templateId, templateId, defaultPurpose: '', defaultLabel: '', sendOffsetMinutes: undefined };
}

function classEmailCampaignName(defaultPurpose: string, templateName: string) {
  if (!defaultPurpose) return `${templateName} class email`;
  return `${purposeLabel(defaultPurpose)} · ${templateName}`;
}

function purposeLabel(purpose: string) {
  return purpose
    .split('_')
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ');
}
