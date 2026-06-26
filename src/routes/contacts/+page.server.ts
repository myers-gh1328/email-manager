import { fail, redirect } from '@sveltejs/kit';
import { repo } from '$lib/server/app';
import { errorText, required, text } from '$lib/server/form-utils';
import { extractRosterFromImage } from '$lib/server/llm';
import { loadContactsData } from '$lib/server/page-data';
import { localReturnTo, returnAfterCreate } from '$lib/server/return-to';
import { importContactRows, parseRosterCsv } from '$lib/server/roster-import';
import { getSettings } from '$lib/server/settings';
import { formatPhoneNumber } from '$lib/shared/phone';

export const load = ({ url }) => ({
  ...loadContactsData({
    contactId: url.searchParams.get('contactId') || undefined,
    search: url.searchParams.get('search') ?? '',
    page: Number(url.searchParams.get('page') ?? '1')
  }),
  action: url.searchParams.get('action') ?? '',
  returnTo: localReturnTo(url.searchParams.get('returnTo') ?? ''),
  actionMessage: url.searchParams.get('message') ?? ''
});

export const actions = {
  createContact: async ({ request }) => {
    const form = await request.formData();
    try {
      repo.createContact({
        firstName: required(form, 'firstName'),
        lastName: required(form, 'lastName'),
        email: required(form, 'email'),
        phone: formatPhoneNumber(text(form, 'phone')),
        notes: text(form, 'notes'),
        doNotEmail: form.get('doNotEmail') === 'on'
      });
    } catch (error) {
      return fail(400, { error: true, message: contactActionError(error) });
    }
    return returnAfterCreate(form, 'Contact added.');
  },
  importCsv: async ({ request }) => {
    const form = await request.formData();
    const file = form.get('csvFile');
    if (!(file instanceof File) || file.size === 0) return { message: 'Choose a CSV file to import.' };
    const result = importContactRows(repo, parseRosterCsv(await file.text()));
    return {
      message: `Imported contacts: ${result.created} created, ${result.reused} reused, ${result.skipped} skipped.`
    };
  },
  importImage: async ({ request }) => {
    const settings = getSettings();
    if (!settings.aiEnabled || !settings.aiVisionEnabled) {
      return { message: 'Enable AI assistance and mark it as a vision model before importing screenshots.' };
    }
    const form = await request.formData();
    const file = form.get('imageFile');
    if (!(file instanceof File) || file.size === 0) return { message: 'Choose an image to import.' };
    const dataUrl = `data:${file.type || 'image/png'};base64,${Buffer.from(await file.arrayBuffer()).toString('base64')}`;
    try {
      const result = importContactRows(repo, await extractRosterFromImage(dataUrl));
      return {
        message: `Imported screenshot contacts: ${result.created} created, ${result.reused} reused, ${result.skipped} skipped.`
      };
    } catch (error) {
      return fail(400, { error: true, message: errorText(error) });
    }
  },
  updateContact: async ({ request }) => {
    const form = await request.formData();
    try {
      repo.updateContact(required(form, 'contactId'), {
        firstName: required(form, 'firstName'),
        lastName: required(form, 'lastName'),
        email: required(form, 'email'),
        phone: formatPhoneNumber(text(form, 'phone')),
        notes: text(form, 'notes'),
        doNotEmail: form.get('doNotEmail') === 'on'
      });
    } catch (error) {
      return fail(400, { error: true, message: contactActionError(error) });
    }
    throw redirect(303, contactActionReturn(form, 'Contact updated.', required(form, 'contactId')));
  },
  deleteContact: async ({ request }) => {
    const form = await request.formData();
    repo.deleteContact(required(form, 'contactId'));
    throw redirect(303, contactActionReturn(form, 'Contact deleted.'));
  }
};

function contactActionReturn(form: FormData, message: string, contactId = '') {
  const params = new URLSearchParams();
  const returnTo = localReturnTo(text(form, 'returnTo'));
  const search = text(form, 'search');
  const page = Math.max(Number(text(form, 'page') || '1'), 1);
  if (contactId) params.set('contactId', contactId);
  if (returnTo) params.set('returnTo', returnTo);
  if (search) params.set('search', search);
  if (page > 1) params.set('page', String(page));
  params.set('message', message);
  return `/contacts?${params.toString()}`;
}

function contactActionError(error: unknown) {
  const message = errorText(error);
  return message.startsWith('Duplicate contact email:')
    ? 'A contact with that email address already exists.'
    : message;
}
