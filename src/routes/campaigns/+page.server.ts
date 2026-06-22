import { fail } from '@sveltejs/kit';
import { repo } from '$lib/server/app';
import { required } from '$lib/server/form-utils';
import { buildCampaignEmailPreviews, campaignEmailPreviewToken, hasMissingVariables } from '$lib/server/campaign-email';
import { loadCampaignsData } from '$lib/server/page-data';
import { getSettings } from '$lib/server/settings';

export const load = ({ url }) => ({
  ...loadCampaignsData(),
  action: url.searchParams.get('action') ?? ''
});

export const actions = {
  createCampaign: async ({ request }) => {
    const form = await request.formData();
    const classSessionId = required(form, 'classSessionId');
    const templateId = required(form, 'templateId');
    if (form.get('approved') === 'on' && textToken(form, 'previewToken') !== campaignPreviewToken(classSessionId, templateId)) {
      return fail(400, { error: true, message: 'Preview this class and template before approving the schedule.' });
    }
    if (form.get('approved') === 'on') {
      const preview = buildCampaignPreviews(classSessionId, templateId);
      if (hasMissingVariables(preview)) {
        return fail(400, { error: true, message: 'Resolve missing template variables before approving the schedule.' });
      }
    }
    const campaign = repo.createCampaign({
      classSessionId,
      templateId,
      name: required(form, 'name'),
      scheduledFor: required(form, 'scheduledFor'),
      approved: form.get('approved') === 'on'
    });
    repo.ensurePendingDeliveries(campaign.id);
    return { message: 'Campaign schedule created.' };
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
  return String(form.get(key) ?? '');
}
