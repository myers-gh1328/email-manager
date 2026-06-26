import { fail } from '@sveltejs/kit';
import { repo } from '$lib/server/app';
import { directEmailPreviewToken, previewDirectEmail, sendDirectEmail } from '$lib/server/direct-email';
import { errorText, formText, required, text } from '$lib/server/form-utils';
import { suggestTemplate } from '$lib/server/llm';
import { sendOutboundEmail } from '$lib/server/mailer';
import { loadCommunicationsData } from '$lib/server/page-data';
import { getSettings } from '$lib/server/settings';

export const load = ({ url }) =>
  loadCommunicationsData({
    contactId: url.searchParams.get('contactId') || undefined,
    search: url.searchParams.get('search') || undefined,
    page: Number(url.searchParams.get('page') || '1')
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
    try {
      const result = await sendDirectEmail(repo, (to, subject, text) => sendOutboundEmail({ to, subject, text }), {
        contactIds,
        subject: content.subject,
        body: content.body,
        instructorName: settings.instructorName,
        previewToken: text(form, 'previewToken'),
        settings,
        surface: 'direct_email'
      });
      return {
        message: directEmailResultMessage(result),
        previews: result.previews,
        previewToken: directEmailPreviewToken({ contactIds, subject: content.subject, body: content.body }),
        selectedContactIds: contactIds,
        selectedTemplateId: content.templateId,
        subject: content.subject,
        body: content.body
      };
    } catch (error) {
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
  },
  markReplyReviewed: async ({ request }) => {
    const form = await request.formData();
    repo.markCommunicationReplyReviewed(required(form, 'replyId'));
    return { message: 'Reply marked reviewed.' };
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

function directEmailResultMessage(result: { sent: number; failed: number }) {
  const plural = result.sent === 1 ? '' : 's';
  const failed = result.failed ? `; ${result.failed} failed` : '';
  return `Accepted ${result.sent} email${plural} by the mail server${failed}.`;
}
