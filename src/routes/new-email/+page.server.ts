import { fail, redirect } from '@sveltejs/kit';
import { repo } from '$lib/server/app';
import { directEmailOperationId, directEmailPreviewToken, previewDirectEmail, sendDirectEmail } from '$lib/server/direct-email';
import { errorText, formText, required, text } from '$lib/server/form-utils';
import { suggestTemplate } from '$lib/server/llm';
import { sendOutboundEmail } from '$lib/server/mailer';
import { loadNewEmailData } from '$lib/server/page-data';
import { getSettings } from '$lib/server/settings';

export const load = ({ url }) =>
  loadNewEmailData({
    contactId: url.searchParams.get('contactId') || undefined,
    subject: url.searchParams.get('subject') || undefined,
    body: url.searchParams.get('body') || undefined
  });

export const actions = {
  previewDirectEmail: async ({ request }) => {
    const form = await request.formData();
    const contactIds = selectedContactIds(form);
    if (!contactIds.length) return fail(400, { error: true, message: 'Choose at least one recipient.' });

    const content = directEmailContent(form);
    return {
      previews: previewDirectEmail(repo, {
        contactIds,
        subject: content.subject,
        body: content.body,
        instructorName: getSettings().instructorName
      }),
      previewToken: directEmailPreviewToken({ contactIds, subject: content.subject, body: content.body }),
      selectedContactIds: contactIds,
      selectedTemplateId: content.templateId,
      subject: content.subject,
      body: content.body
    };
  },
  sendDirectEmail: async ({ request }) => {
    const form = await request.formData();
    const contactIds = selectedContactIds(form);
    if (!contactIds.length) return fail(400, { error: true, message: 'Choose at least one recipient.' });

    const content = directEmailContent(form);
    const settings = getSettings();
    const previewToken = text(form, 'previewToken');
    const sourceId = directEmailOperationId({ contactIds, subject: content.subject, body: content.body, previewToken });
    try {
      await sendDirectEmail(repo, (to, subject, text) => sendOutboundEmail({ to, subject, text }), {
        contactIds,
        subject: content.subject,
        body: content.body,
        instructorName: settings.instructorName,
        previewToken,
        settings,
        surface: 'direct_email'
      });
      throw redirect(303, `/communications?sourceId=${encodeURIComponent(sourceId)}`);
    } catch (error) {
      if (isRedirect(error)) throw error;
      return fail(400, {
        error: true,
        message: errorText(error),
        selectedContactIds: contactIds,
        selectedTemplateId: content.templateId,
        subject: content.subject,
        body: content.body
      });
    }
  },
  loadTemplate: async ({ request }) => {
    const form = await request.formData();
    const template = repo.getTemplate(required(form, 'templateId'));
    return {
      selectedContactIds: selectedContactIds(form),
      selectedTemplateId: template.id,
      subject: template.subject,
      body: template.body
    };
  },
  aiDraftDirectEmail: async ({ request }) => {
    const form = await request.formData();
    try {
      const draft = await suggestTemplate(required(form, 'prompt'), {
        subject: text(form, 'subject'),
        body: text(form, 'body')
      });
      return {
        message: 'AI draft ready. Preview before sending.',
        selectedContactIds: selectedContactIds(form),
        selectedTemplateId: text(form, 'templateId'),
        subject: draft.subject,
        body: draft.body,
        previewToken: ''
      };
    } catch (error) {
      return fail(400, {
        error: true,
        message: errorText(error),
        selectedContactIds: selectedContactIds(form),
        selectedTemplateId: text(form, 'templateId'),
        subject: text(form, 'subject'),
        body: text(form, 'body')
      });
    }
  }
};

function selectedContactIds(form: FormData) {
  return form.getAll('contactIds').map(formText).filter(Boolean);
}

function directEmailContent(form: FormData) {
  const templateId = text(form, 'templateId');
  const template = templateId ? repo.getTemplate(templateId) : undefined;
  return {
    templateId,
    subject: text(form, 'subject') || template?.subject || required(form, 'subject'),
    body: text(form, 'body') || template?.body || required(form, 'body')
  };
}

function isRedirect(error: unknown) {
  return typeof error === 'object' && error !== null && 'status' in error && 'location' in error;
}
