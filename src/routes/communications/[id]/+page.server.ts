import { repo } from '$lib/server/app';
import { required } from '$lib/server/form-utils';
import { localReturnTo } from '$lib/server/return-to';

export const load = ({ params, url }) => ({
  communication: repo.getCommunication(params.id),
  returnTo: localReturnTo(url.searchParams.get('returnTo') ?? '')
});

export const actions = {
  markReplyHandled: async ({ request }) => {
    const form = await request.formData();
    repo.markCommunicationReplyReviewed(required(form, 'replyId'));
    return { message: 'Reply marked handled.' };
  }
};
