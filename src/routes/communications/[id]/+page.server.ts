import { repo } from '$lib/server/app';
import { required } from '$lib/server/form-utils';

export const load = ({ params }) => ({
  communication: repo.getCommunication(params.id)
});

export const actions = {
  markReplyReviewed: async ({ request }) => {
    const form = await request.formData();
    repo.markCommunicationReplyReviewed(required(form, 'replyId'));
    return { message: 'Reply marked reviewed.' };
  }
};
