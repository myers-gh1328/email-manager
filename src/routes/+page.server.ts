import { fail } from '@sveltejs/kit';
import { sendDueCampaigns } from '$lib/server/background';
import { getSettings } from '$lib/server/settings';
import { loadDashboardData } from '$lib/server/page-data';

export const load = () => loadDashboardData();

export const actions = {
  sendDueCampaigns: async () => {
    if (!getSettings().schedulerEnabled) {
      return fail(400, { message: 'Scheduled sending is disabled in settings.' });
    }
    return { sent: await sendDueCampaigns({ retryFailed: true }) };
  }
};
