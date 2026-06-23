import { fail } from '@sveltejs/kit';
import { sendDueCampaigns } from '$lib/server/background';
import { OutboundGateError } from '$lib/server/outbound-errors';
import { getSettings } from '$lib/server/settings';
import { loadDashboardData, localTodayWindow } from '$lib/server/page-data';
import { repo } from '$lib/server/app';

export const load = () => loadDashboardData();

export const actions = {
  sendDueCampaigns: async () => {
    if (!getSettings().schedulerEnabled) {
      return fail(400, { message: 'Scheduled sending is disabled in settings.' });
    }
    try {
      return { sent: await sendDueCampaigns({ surface: 'manual_send_due' }) };
    } catch (error) {
      if (error instanceof OutboundGateError) return fail(error.retryAfterSeconds ? 429 : 400, { message: error.message, retryAfter: error.retryAfterSeconds });
      throw error;
    }
  },
  retryFailedToday: async () => {
    const retryWindow = localTodayWindow();
    const queued = repo.retryFailedCampaignDeliveriesBetween(retryWindow.startIso, retryWindow.endIso);
    return { message: `${queued} failed email${queued === 1 ? '' : 's'} queued for manual resend. Use Send due now when ready.` };
  }
};
