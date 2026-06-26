import { fail } from '@sveltejs/kit';
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
    return { message: 'Template updated.' };
  },
  deleteTemplate: async ({ request }) => {
    const form = await request.formData();
    try {
      repo.deleteTemplate(required(form, 'templateId'));
      return { message: 'Template deleted.' };
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
