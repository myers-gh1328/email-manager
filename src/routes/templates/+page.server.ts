import { fail, redirect } from '@sveltejs/kit';
import { repo } from '$lib/server/app';
import { errorText, formText, required } from '$lib/server/form-utils';
import { suggestTemplate } from '$lib/server/llm';
import { loadTemplatesData } from '$lib/server/page-data';
import { localReturnTo, returnAfterCreate } from '$lib/server/return-to';

export const load = ({ url }) => {
  const data = loadTemplatesData({
    search: url.searchParams.get('search') ?? '',
    page: Number(url.searchParams.get('page') ?? '1')
  });
  const selectedTemplateId = url.searchParams.get('templateId') ?? '';
  const action = url.searchParams.get('action') ?? '';
  return {
    ...data,
    action,
    returnTo: localReturnTo(url.searchParams.get('returnTo') ?? ''),
    actionMessage: url.searchParams.get('message') ?? '',
    selectedTemplateId,
    selectedTemplate: selectedTemplateId ? repo.getTemplate(selectedTemplateId) : undefined
  };
};

export const actions = {
  createTemplate: async ({ request }) => {
    const form = await request.formData();
    repo.createTemplate({
      name: required(form, 'name'),
      subject: required(form, 'subject'),
      body: required(form, 'body')
    });
    return returnAfterCreate(form, 'Template saved.');
  },
  updateTemplate: async ({ request }) => {
    const form = await request.formData();
    repo.updateTemplate(required(form, 'templateId'), {
      name: required(form, 'name'),
      subject: required(form, 'subject'),
      body: required(form, 'body')
    });
    throw redirect(303, templateActionReturn(form, 'Template updated.', required(form, 'templateId')));
  },
  deleteTemplate: async ({ request }) => {
    const form = await request.formData();
    try {
      repo.deleteTemplate(required(form, 'templateId'));
      throw redirect(303, templateActionReturn(form, 'Template deleted.'));
    } catch (error) {
      return { message: errorText(error) };
    }
  },
  aiDraft: async ({ request }) => {
    const form = await request.formData();
    try {
      const templateId = formText(form.get('templateId'));
      const currentName = formText(form.get('name')).trim();
      const currentSubject = formText(form.get('subject')).trim();
      const currentBody = formText(form.get('body')).trim();
      const draft = await suggestTemplate(required(form, 'prompt'), {
        subject: currentSubject,
        body: currentBody
      });
      return {
        draft: {
          templateId,
          name: currentName || draft.subject.replace(/[{}]/g, '').slice(0, 80),
          subject: draft.subject,
          body: draft.body
        }
      };
    } catch (error) {
      return fail(400, { message: errorText(error) });
    }
  }
};

function templateActionReturn(form: FormData, message: string, templateId = '') {
  const params = new URLSearchParams();
  const returnTo = localReturnTo(formText(form.get('returnTo')));
  const search = formText(form.get('search'));
  const page = Math.max(Number(formText(form.get('page')) || '1'), 1);
  if (templateId) params.set('templateId', templateId);
  if (returnTo) params.set('returnTo', returnTo);
  if (search) params.set('search', search);
  if (page > 1) params.set('page', String(page));
  params.set('message', message);
  return `/templates?${params.toString()}`;
}
