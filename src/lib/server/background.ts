import { isAgentDev, repo } from './app';
import { syncRepliesNow } from './reply-sync';
import { sendDueCampaignsWithDependencies } from './send-due-campaigns';
import { getSettings } from './settings';

let started = false;
let sendingDue = false;
let syncingReplies = false;

export function startBackgroundScheduler() {
  if (started || isAgentDev || process.env.SCUBA_EMAIL_DISABLE_BACKGROUND === 'true') return;
  started = true;
  setInterval(() => {
    void sendDueCampaigns({ retryFailed: false }).catch((error) => {
      console.error('Scheduled send failed', error);
    });
  }, 60_000);
  setInterval(() => {
    void syncReplies().catch(() => {
      console.error('Reply sync failed');
    });
  }, 300_000);
}

export async function sendDueCampaigns(options: { retryFailed?: boolean } = {}) {
  if (sendingDue) return 0;
  sendingDue = true;
  try {
    return await sendDueCampaignsWithDependencies(repo, getSettings(), undefined, options);
  } finally {
    sendingDue = false;
  }
}

export async function syncReplies() {
  const settings = getSettings();
  if (!settings.replySyncPollingEnabled) return { status: 'disabled' as const, checked: 0, imported: 0, matched: 0, skipped: 0 };
  if (syncingReplies) return { status: 'disabled' as const, checked: 0, imported: 0, matched: 0, skipped: 0 };
  syncingReplies = true;
  try {
    return await syncRepliesNow();
  } finally {
    syncingReplies = false;
  }
}
