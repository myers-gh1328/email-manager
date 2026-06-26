import { repo } from '$lib/server/app';
import { required } from '$lib/server/form-utils';
import { loadCommunicationsData } from '$lib/server/page-data';
import { localReturnTo } from '$lib/server/return-to';

export const load = ({ url }) => ({
  ...loadCommunicationsData({
    contactId: url.searchParams.get('contactId') || undefined,
    sourceId: url.searchParams.get('sourceId') || undefined,
    replyStatus: url.searchParams.get('replyStatus') || undefined,
    search: url.searchParams.get('search') || undefined,
    page: Number(url.searchParams.get('page') || '1')
  }),
  returnTo: localReturnTo(url.searchParams.get('returnTo') ?? '')
});

export const actions = {
  markReplyHandled: async ({ request }) => {
    const form = await request.formData();
    repo.markCommunicationReplyReviewed(required(form, 'replyId'));
    return { message: 'Reply marked handled.' };
  }
};
