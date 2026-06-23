import { fail } from '@sveltejs/kit';
import { sendDueCampaigns } from '$lib/server/background';
import { OutboundGateError } from '$lib/server/outbound-errors';
import { getSettings } from '$lib/server/settings';
import { loadDashboardData } from '$lib/server/page-data';

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
  }
};
