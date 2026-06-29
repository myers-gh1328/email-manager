import { repo } from '$lib/server/app';
import { getSettings } from '$lib/server/settings';

export const load = ({ url }) => {
  const settings = getSettings();
  const limit = 25;
  const page = Math.max(Number(url.searchParams.get('page') ?? '1') || 1, 1);
  const search = url.searchParams.get('search') ?? '';
  const auditPage = repo.listEmailTestAuditsPage({
    search,
    limit,
    offset: (page - 1) * limit
  });
  return {
    settings,
    audits: auditPage.items,
    auditPage
  };
};
