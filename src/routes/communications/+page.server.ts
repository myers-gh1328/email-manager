import { repo } from '$lib/server/app';
import { required } from '$lib/server/form-utils';
import { loadCommunicationsData } from '$lib/server/page-data';

export const load = ({ url }) =>
  loadCommunicationsData({
    contactId: url.searchParams.get('contactId') || undefined,
    sourceId: url.searchParams.get('sourceId') || undefined,
    search: url.searchParams.get('search') || undefined,
    page: Number(url.searchParams.get('page') || '1')
  });

export const actions = {
  markReplyReviewed: async ({ request }) => {
    const form = await request.formData();
    repo.markCommunicationReplyReviewed(required(form, 'replyId'));
    return { message: 'Reply marked handled.' };
  }
};
