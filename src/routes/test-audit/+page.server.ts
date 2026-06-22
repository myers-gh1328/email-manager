import { repo } from '$lib/server/app';
import { getSettings } from '$lib/server/settings';

export const load = () => {
  const settings = getSettings();
  return {
    settings,
    audits: repo.listEmailTestAudits()
  };
};
