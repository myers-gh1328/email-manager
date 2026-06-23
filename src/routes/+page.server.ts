import { fail } from '@sveltejs/kit';
import { sendDueCampaigns } from '$lib/server/background';
import { OutboundGateError } from '$lib/server/outbound-errors';
import { getSettings } from '$lib/server/settings';
import { loadDashboardData, localTodayWindow } from '$lib/server/page-data';
import { repo } from '$lib/server/app';

export const load = () => loadDashboardData();

export const actions = {
  resendFailedToday: async () => {
    if (!getSettings().schedulerEnabled) {
      return fail(400, { message: 'Scheduled sending is disabled in settings.' });
    }
    const retryWindow = localTodayWindow();
    const retryable = repo.retryFailedCampaignDeliveriesBetween(retryWindow.startIso, retryWindow.endIso);
    if (!retryable) return { resent: 0, message: 'No failed emails from today need a resend.' };
    try {
      return { resent: await sendDueCampaigns({ surface: 'manual_send_due' }), retryable };
    } catch (error) {
      if (error instanceof OutboundGateError) return fail(error.retryAfterSeconds ? 429 : 400, { message: error.message, retryAfter: error.retryAfterSeconds });
      throw error;
    }
  }
};
