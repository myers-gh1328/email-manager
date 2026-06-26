import { loadCommunicationsData } from '$lib/server/page-data';
import { localReturnTo } from '$lib/server/return-to';

export const load = ({ url }) => ({
  ...loadCommunicationsData({
    contactId: url.searchParams.get('contactId') || undefined,
    sourceId: url.searchParams.get('sourceId') || undefined,
    replyStatus: url.searchParams.get('replyStatus') || undefined,
    status: url.searchParams.get('status') || undefined,
    type: url.searchParams.get('type') || undefined,
    search: url.searchParams.get('search') || undefined,
    page: Number(url.searchParams.get('page') || '1')
  }),
  returnTo: localReturnTo(url.searchParams.get('returnTo') ?? '')
});
