import { fail, redirect } from '@sveltejs/kit';
import { repo } from '$lib/server/app';
import { errorText, formText, required } from '$lib/server/form-utils';
import { buildCampaignEmailPreviews, hasMissingVariables, normalizeDateTimeLocal } from '$lib/server/campaign-email';
import { getSettings } from '$lib/server/settings';

export const load = ({ params, url }) => {
  const page = Math.max(Number(url.searchParams.get('page') ?? '1'), 1);
  const detail = repo.getCampaignDetail(params.id, {
    limit: 25,
    offset: (page - 1) * 25,
    search: url.searchParams.get('search') ?? ''
  });
  return { ...detail, scheduledForInput: normalizeDateTimeLocal(detail.campaign.scheduledFor) };
};

export const actions = {
  updateCampaign: async ({ params, request }) => {
    const form = await request.formData();
    const current = repo.getCampaign(params.id);
    const readyToSend = form.get('scheduleMode') === 'ready';
    if (readyToSend && !current.approved) {
      return fail(400, { error: true, message: 'Preview this scheduled email before marking it ready to send.' });
    }
    if (readyToSend) {
      const previews = buildCampaignEmailPreviews(repo, current.classSessionId, current.templateId, getSettings().instructorName);
      if (hasMissingVariables(previews)) {
        return fail(400, { error: true, message: 'Resolve missing template variables before marking this scheduled email ready to send.' });
      }
    }
    repo.updateCampaign(params.id, {
      name: required(form, 'name'),
      scheduledFor: required(form, 'scheduledFor'),
      approved: readyToSend
    });
    if (readyToSend) repo.ensurePendingDeliveries(params.id);
    return { message: 'Scheduled email updated.' };
  },
  deleteCampaign: async ({ params }) => {
    try {
      repo.deleteCampaign(params.id);
    } catch (error) {
      return fail(400, { message: errorText(error) });
    }
    throw redirect(303, '/campaigns');
  },
  retrySelected: async ({ params, request }) => {
    const form = await request.formData();
    const recipientIds = form.getAll('recipientIds').map(formText).filter(Boolean);
    if (!recipientIds.length) return fail(400, { message: 'Select at least one recipient to retry.' });
    const updated = repo.retryCampaignDeliveries(params.id, recipientIds);
    return { message: `${updated} recipient${updated === 1 ? '' : 's'} queued for retry. Sent recipients are always excluded.` };
  }
};
