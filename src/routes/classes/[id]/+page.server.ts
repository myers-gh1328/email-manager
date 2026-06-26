import { fail, redirect } from '@sveltejs/kit';
import { repo } from '$lib/server/app';
import { syncDefaultCampaignsForClass } from '$lib/server/class-default-campaigns';
import { errorText, required, text } from '$lib/server/form-utils';
import {
  loadContactOptions,
  loadCourseTypeOptions,
  loadLocationOptions,
  loadTemplateOptions,
  withReadyToSend,
  withVisibleScheduledEmailsPage
} from '$lib/server/page-data';
import {
  buildCampaignEmailPreviews,
  campaignEmailPreviewToken,
  hasMissingVariables,
  scheduledForFromClassOffset
} from '$lib/server/campaign-email';
import { extractRosterFromImage } from '$lib/server/llm';
import { importRosterRows, parseRosterCsv } from '$lib/server/roster-import';
import { localReturnTo } from '$lib/server/return-to';
import { getSettings } from '$lib/server/settings';

export const load = ({ params, url }) => {
  const page = Math.max(Number(url.searchParams.get('page') ?? '1'), 1);
  const emailPage = Math.max(Number(url.searchParams.get('emailPage') ?? '1'), 1);
  const detail = repo.getClassSessionDetail(params.id, {
    limit: 25,
    offset: (page - 1) * 25,
    search: url.searchParams.get('search') ?? ''
  });
  const scheduledCampaignsPage = repo.listCampaignsForClassSession(params.id, {
    limit: 10,
    offset: (emailPage - 1) * 10,
    search: url.searchParams.get('emailSearch') ?? ''
  });
  return {
    ...detail,
    contactOptions: loadContactOptions(),
    courseTypes: loadCourseTypeOptions([detail.session.courseTypeId]),
    locations: loadLocationOptions([detail.session.locationId]),
    templateOptions: loadTemplateOptions(),
    defaultTemplates: repo.listDefaultTemplatesForClassSession(params.id),
    scheduledCampaigns: scheduledCampaignsPage.items.map(withReadyToSend),
    scheduledCampaignsPage: withVisibleScheduledEmailsPage(scheduledCampaignsPage),
    checklistState: repo.listEnrollmentChecklistState(params.id, detail.roster.map((contact) => contact.id)),
    returnTo: localReturnTo(url.searchParams.get('returnTo') ?? ''),
    actionMessage: url.searchParams.get('message') ?? '',
    settings: getSettings()
  };
};

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
	    throw redirect(303, classDetailActionReturn(params.id, form, classUpdatedMessage(createdDefaults.length)));
	  },
  enrollContact: async ({ params, request }) => {
    const form = await request.formData();
    repo.enrollContact(params.id, required(form, 'contactId'));
    throw redirect(303, classDetailActionReturn(params.id, form, 'Student enrolled.'));
  },
  unenrollContact: async ({ params, request }) => {
    const form = await request.formData();
    repo.unenrollContact(params.id, required(form, 'contactId'));
    throw redirect(303, classDetailActionReturn(params.id, form, 'Student removed from roster.'));
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
    throw redirect(303, classDetailActionReturn(params.id, form, 'Prep item updated.'));
  },
  importCsv: async ({ params, request }) => {
    const form = await request.formData();
    const file = form.get('csvFile');
    if (!(file instanceof File) || file.size === 0) throw redirect(303, classDetailActionReturn(params.id, form, 'Choose a CSV file to import.'));
    const result = importRosterRows(repo, params.id, parseRosterCsv(await file.text()));
    throw redirect(303, classDetailActionReturn(params.id, form, `Imported roster: ${result.created} created, ${result.reused} reused, ${result.enrolled} enrolled, ${result.skipped} skipped.`));
  },
  importImage: async ({ params, request }) => {
    const form = await request.formData();
    const settings = getSettings();
    if (!settings.aiEnabled || !settings.aiVisionEnabled || !settings.aiBaseUrl || !settings.aiModel) {
      throw redirect(303, classDetailActionReturn(params.id, form, 'Connect AI assistance and choose a vision-capable model before importing roster images.'));
    }
    const file = form.get('imageFile');
    if (!(file instanceof File) || file.size === 0) throw redirect(303, classDetailActionReturn(params.id, form, 'Choose an image to import.'));
    const dataUrl = `data:${file.type || 'image/png'};base64,${Buffer.from(await file.arrayBuffer()).toString('base64')}`;
    try {
      const result = importRosterRows(repo, params.id, await extractRosterFromImage(dataUrl));
      throw redirect(303, classDetailActionReturn(params.id, form, `Imported image roster: ${result.created} created, ${result.reused} reused, ${result.enrolled} enrolled, ${result.skipped} skipped.`));
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
      previewToken: classEmailPreviewToken(params.id, choice.templateId),
      returnTo: text(form, 'returnTo'),
      search: text(form, 'search'),
      page: text(form, 'page'),
      emailSearch: text(form, 'emailSearch'),
      emailPage: text(form, 'emailPage')
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
      readyToSend: true,
      source: defaultPurpose ? 'course_default' : 'manual',
      defaultPurpose,
      defaultLabel: text(form, 'defaultLabel'),
      sendOffsetMinutes: sendOffsetMinutes ? Number(sendOffsetMinutes) : 0
    });
    repo.ensurePendingDeliveries(campaign.id);
    throw redirect(303, classDetailActionReturn(params.id, form, 'Class email scheduled.'));
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
  return `Class updated. Created ${defaultCampaignCount} scheduled email${plural}.`;
}

function classDetailActionReturn(classSessionId: string, form: FormData, message: string) {
  const params = new URLSearchParams();
  const returnTo = localReturnTo(text(form, 'returnTo'));
  const search = text(form, 'search');
  const page = Math.max(Number(text(form, 'page') || '1'), 1);
  const emailSearch = text(form, 'emailSearch');
  const emailPage = Math.max(Number(text(form, 'emailPage') || '1'), 1);
  if (returnTo) params.set('returnTo', returnTo);
  if (search) params.set('search', search);
  if (page > 1) params.set('page', String(page));
  if (emailSearch) params.set('emailSearch', emailSearch);
  if (emailPage > 1) params.set('emailPage', String(emailPage));
  params.set('message', message);
  return `/classes/${classSessionId}?${params.toString()}`;
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
