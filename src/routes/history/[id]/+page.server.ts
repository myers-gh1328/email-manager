import { redirect } from '@sveltejs/kit';
import { repo } from '$lib/server/app';
import { formText, required } from '$lib/server/form-utils';
import { localReturnTo } from '$lib/server/return-to';

export const load = ({ params, url }) => ({
  communication: repo.getCommunication(params.id),
  returnTo: localReturnTo(url.searchParams.get('returnTo') ?? ''),
  actionMessage: url.searchParams.get('message') ?? ''
});

export const actions = {
  markReplyHandled: async ({ params, request }) => {
    const form = await request.formData();
    repo.markCommunicationReplyHandled(required(form, 'replyId'));
    throw redirect(303, detailActionReturn(params.id, form, 'Reply marked handled.'));
  }
};

function detailActionReturn(communicationId: string, form: FormData, message: string) {
  const params = new URLSearchParams();
  const returnTo = localReturnTo(formText(form.get('returnTo')));
  if (returnTo) params.set('returnTo', returnTo);
  params.set('message', message);
  return `/history/${communicationId}?${params.toString()}`;
}
