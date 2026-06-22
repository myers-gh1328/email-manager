import { getSettings } from '$lib/server/settings';

export const load = ({ locals }) => {
  return {
    isAuthenticated: locals.isAuthenticated,
    settings: locals.isAuthenticated ? getSettings() : undefined
  };
};
