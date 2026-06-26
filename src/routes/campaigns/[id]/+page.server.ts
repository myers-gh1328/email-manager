import { fail, redirect } from '@sveltejs/kit';
import { repo } from '$lib/server/app';
import { errorText, formText, required } from '$lib/server/form-utils';
import { buildCampaignEmailPreviews, hasMissingVariables, normalizeDateTimeLocal } from '$lib/server/campaign-email';
import { withReadyToSend } from '$lib/server/page-data';
import { localReturnTo } from '$lib/server/return-to';
import { getSettings } from '$lib/server/settings';

export const load = ({ params, url }) => {
  const page = Math.max(Number(url.searchParams.get('page') ?? '1'), 1);
  const detail = repo.getCampaignDetail(params.id, {
    limit: 25,
    offset: (page - 1) * 25,
    search: url.searchParams.get('search') ?? ''
  });
  return {
    ...detail,
    campaign: withReadyToSend(detail.campaign),
    scheduledForInput: normalizeDateTimeLocal(detail.campaign.scheduledFor),
    returnTo: localReturnTo(url.searchParams.get('returnTo') ?? ''),
    actionMessage: url.searchParams.get('message') ?? ''
  };
};

export const actions = {
  updateCampaign: async ({ params, request }) => {
    const form = await request.formData();
    const current = repo.getCampaign(params.id);
    const readyToSend = form.get('scheduleMode') === 'ready';
    if (readyToSend && !withReadyToSend(current).readyToSend) {
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
      readyToSend
    });
    if (readyToSend) repo.ensurePendingDeliveries(params.id);
    throw redirect(303, detailActionReturn(params.id, form, 'Scheduled email updated.'));
  },
  deleteCampaign: async ({ params, request }) => {
    const form = await request.formData();
    try {
      repo.deleteCampaign(params.id);
    } catch (error) {
      return fail(400, { message: errorText(error) });
    }
    throw redirect(303, localReturnTo(formText(form.get('returnTo'))) || '/campaigns');
  },
  retrySelected: async ({ params, request }) => {
    const form = await request.formData();
    const recipientIds = form.getAll('recipientIds').map(formText).filter(Boolean);
    if (!recipientIds.length) return fail(400, { message: 'Select at least one recipient to retry.' });
    const updated = repo.retryCampaignDeliveries(params.id, recipientIds);
    throw redirect(303, detailActionReturn(params.id, form, `${updated} recipient${updated === 1 ? '' : 's'} queued for retry. Sent recipients are always excluded.`));
  }
};

function detailActionReturn(campaignId: string, form: FormData, message: string) {
  const params = new URLSearchParams();
  const search = formText(form.get('search'));
  const page = Math.max(Number(formText(form.get('page')) || '1'), 1);
  const returnTo = localReturnTo(formText(form.get('returnTo')));
  if (search) params.set('search', search);
  if (page > 1) params.set('page', String(page));
  if (returnTo) params.set('returnTo', returnTo);
  params.set('message', message);
  const query = params.toString();
  return query ? `/campaigns/${campaignId}?${query}` : `/campaigns/${campaignId}`;
}
