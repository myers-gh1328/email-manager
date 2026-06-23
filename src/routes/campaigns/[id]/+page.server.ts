import { fail, redirect } from '@sveltejs/kit';
import { sendDueCampaigns } from '$lib/server/background';
import { repo } from '$lib/server/app';
import { required } from '$lib/server/form-utils';
import { buildCampaignEmailPreviews, hasMissingVariables, normalizeDateTimeLocal } from '$lib/server/campaign-email';
import { getSettings } from '$lib/server/settings';

export const load = ({ params }) => {
  const detail = repo.getCampaignDetail(params.id);
  return { ...detail, scheduledForInput: normalizeDateTimeLocal(detail.campaign.scheduledFor) };
};

export const actions = {
  updateCampaign: async ({ params, request }) => {
    const form = await request.formData();
    const current = repo.getCampaign(params.id);
    const approved = form.get('approved') === 'on';
    if (approved && !current.approved) {
      return fail(400, { error: true, message: 'Preview this campaign before approving it.' });
    }
    if (approved) {
      const previews = buildCampaignEmailPreviews(repo, current.classSessionId, current.templateId, getSettings().instructorName);
      if (hasMissingVariables(previews)) {
        return fail(400, { error: true, message: 'Resolve missing template variables before approving this campaign.' });
      }
    }
    repo.updateCampaign(params.id, {
      name: required(form, 'name'),
      scheduledFor: required(form, 'scheduledFor'),
      approved
    });
    if (approved) repo.ensurePendingDeliveries(params.id);
    return { message: 'Campaign updated.' };
  },
  deleteCampaign: async ({ params }) => {
    try {
      repo.deleteCampaign(params.id);
    } catch (error) {
      return fail(400, { message: error instanceof Error ? error.message : String(error) });
    }
    throw redirect(303, '/campaigns');
  },
  sendDueNow: async () => {
    const sent = await sendDueCampaigns({ retryFailed: true });
    return { message: `Mail server accepted ${sent} due email${sent === 1 ? '' : 's'}.` };
  }
};
