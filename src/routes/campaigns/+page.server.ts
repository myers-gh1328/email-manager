import { fail, redirect } from '@sveltejs/kit';
import { repo } from '$lib/server/app';
import { formText, text, required } from '$lib/server/form-utils';
import { buildCampaignEmailPreviews, campaignEmailPreviewToken, hasMissingVariables } from '$lib/server/campaign-email';
import { loadCampaignsData } from '$lib/server/page-data';
import { localReturnTo } from '$lib/server/return-to';
import { getSettings } from '$lib/server/settings';

export const load = ({ url }) => ({
  ...loadCampaignsData({
    search: url.searchParams.get('search') ?? '',
    status: url.searchParams.get('status') ?? '',
    page: Number(url.searchParams.get('page') ?? '1')
  }),
  action: url.searchParams.get('action') ?? '',
  returnTo: localReturnTo(url.searchParams.get('returnTo') ?? ''),
  actionMessage: url.searchParams.get('message') ?? ''
});

export const actions = {
  createCampaign: async ({ request }) => {
    const form = await request.formData();
    const classSessionId = required(form, 'classSessionId');
    const templateId = required(form, 'templateId');
    const scheduleMode = text(form, 'scheduleMode') === 'ready' ? 'ready' : 'draft';
    if (scheduleMode === 'ready' && textToken(form, 'previewToken') !== campaignPreviewToken(classSessionId, templateId)) {
      return fail(400, { error: true, message: 'Preview this class and template before creating a ready schedule.' });
    }
    if (scheduleMode === 'ready') {
      const preview = buildCampaignPreviews(classSessionId, templateId);
      if (hasMissingVariables(preview)) {
        return fail(400, { error: true, message: 'Resolve missing template variables before creating a ready schedule.' });
      }
    }
    const campaign = repo.createCampaign({
      classSessionId,
      templateId,
      name: required(form, 'name'),
      scheduledFor: required(form, 'scheduledFor'),
      approved: scheduleMode === 'ready'
    });
    repo.ensurePendingDeliveries(campaign.id);
    throw redirect(303, campaignActionReturn(form, 'Scheduled email created.'));
  },
  previewCampaign: async ({ request }) => {
    const form = await request.formData();
    const classSessionId = required(form, 'classSessionId');
    const templateId = required(form, 'templateId');
    const classSession = repo.getClassSession(classSessionId);
    const template = repo.getTemplate(templateId);
    const previews = buildCampaignPreviews(classSessionId, templateId);
    return {
      previews,
      classSessionId: classSession.id,
      templateId: template.id,
      previewToken: campaignPreviewToken(classSession.id, template.id)
    };
  }
};

function buildCampaignPreviews(classSessionId: string, templateId: string) {
  return buildCampaignEmailPreviews(repo, classSessionId, templateId, getSettings().instructorName);
}

function campaignPreviewToken(classSessionId: string, templateId: string) {
  const template = repo.getTemplate(templateId);
  return campaignEmailPreviewToken({ classSessionId, template, previews: buildCampaignPreviews(classSessionId, templateId) });
}

function textToken(form: FormData, key: string) {
  return text(form, key);
}

function campaignActionReturn(form: FormData, message: string) {
  const params = new URLSearchParams();
  const search = formText(form.get('search'));
  const status = formText(form.get('status'));
  const page = Math.max(Number(formText(form.get('page')) || '1'), 1);
  const returnTo = localReturnTo(formText(form.get('returnTo')));
  if (search) params.set('search', search);
  if (status) params.set('status', status);
  if (page > 1) params.set('page', String(page));
  if (returnTo) params.set('returnTo', returnTo);
  params.set('message', message);
  return `/campaigns?${params.toString()}`;
}
