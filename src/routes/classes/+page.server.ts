import { fail, redirect } from '@sveltejs/kit';
import { repo } from '$lib/server/app';
import { syncDefaultCampaignsForClass } from '$lib/server/class-default-campaigns';
import { errorText, formText, required, text } from '$lib/server/form-utils';
import { loadClassesData } from '$lib/server/page-data';
import { localReturnTo } from '$lib/server/return-to';

export const load = ({ url }) => {
  return {
    ...loadClassesData({
      search: url.searchParams.get('search') ?? '',
      page: Number(url.searchParams.get('page') ?? '1')
    }),
    action: url.searchParams.get('action') ?? '',
    returnTo: localReturnTo(url.searchParams.get('returnTo') ?? ''),
    actionMessage: url.searchParams.get('message') ?? ''
  };
};

export const actions = {
  createClassSession: async ({ request }) => {
    const form = await request.formData();
    const startsOn = required(form, 'startsOn');
    let session;
    try {
      session = repo.createClassSession({
        courseTypeId: required(form, 'courseTypeId'),
        locationId: required(form, 'locationId'),
        startsOn,
        endsOn: text(form, 'endsOn') || startsOn,
        startTime: text(form, 'startTime'),
        location: text(form, 'locationName'),
        notes: text(form, 'notes')
      });
    } catch (error) {
      return fail(400, { error: true, message: classActionError(error) });
    }
    const createdDefaults = syncDefaultCampaignsForClass(repo, session.id);
    throw redirect(303, classActionReturn(form, classCreatedMessage(createdDefaults.length)));
  }
};

function classCreatedMessage(defaultCampaignCount: number) {
  if (defaultCampaignCount === 0) return 'Class added.';
  const plural = defaultCampaignCount === 1 ? '' : 's';
  return `Class added. Scheduled ${defaultCampaignCount} course email${plural}.`;
}

function classActionError(error: unknown) {
  const message = errorText(error);
  return message.startsWith('Duplicate class session:')
    ? 'A class with that course, date, time, and location already exists.'
    : message;
}

function classActionReturn(form: FormData, message: string) {
  const params = new URLSearchParams();
  const search = formText(form.get('search'));
  const page = Math.max(Number(formText(form.get('page')) || '1'), 1);
  const returnTo = localReturnTo(formText(form.get('returnTo')));
  if (search) params.set('search', search);
  if (page > 1) params.set('page', String(page));
  if (returnTo) params.set('returnTo', returnTo);
  params.set('message', message);
  return `/classes?${params.toString()}`;
}
