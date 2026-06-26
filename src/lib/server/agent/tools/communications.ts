import type { AppRepository } from '../../repository';
import { directEmailPreviewToken, previewDirectEmail, sendDirectEmail, type DirectEmailInput } from '../../direct-email';
import { sendOutboundEmail } from '../../mailer';
import { getSettings, type AppSettings } from '../../settings';
import { commitPreparedApproval, prepareAgentApproval } from '../approvals';
import { agentError, agentOk } from '../envelope';

export interface CommitDirectEmailInput {
  approvalId: string;
  confirmationText: string;
}

type DirectEmailOperation = Pick<DirectEmailInput, 'contactIds' | 'subject' | 'body' | 'instructorName'>;
type DirectEmailReviewSnapshot = ReturnType<typeof directEmailReviewSnapshot>;
type StoredDirectEmailOperation = DirectEmailOperation & { reviewSnapshot: DirectEmailReviewSnapshot };

export function prepareDirectEmailTool(repo: AppRepository, input: DirectEmailInput, settingsOverride?: AppSettings) {
  const settings = settingsOverride ?? getSettings();
  const denied = requireAgentPermission(settings, 'prepareEmail');
  if (denied) return denied;

  try {
    const normalized = normalizeDirectEmailInput(input, settings);
    const previews = previewDirectEmail(repo, normalized);
    const skipped = previews.filter((preview) => preview.contact.doNotEmail);
    const missing = previews.filter((preview) => preview.missing.length > 0);

    if (skipped.length > 0) {
      return agentError(
        'validation_failed',
        'One or more recipients are marked do not email.',
        { skippedRecipients: skipped.map((preview) => recipientReview(preview)) },
        { labels: settings.vocabulary }
      );
    }
    if (missing.length > 0) {
      return agentError(
        'validation_failed',
        'Resolve missing template variables before preparing this email.',
        { missingVariables: missing.map((preview) => ({ contactId: preview.contact.id, missing: preview.missing })) },
        { labels: settings.vocabulary }
      );
    }

    const operation: DirectEmailOperation = {
      contactIds: [...new Set(normalized.contactIds)],
      subject: normalized.subject,
      body: normalized.body,
      instructorName: normalized.instructorName
    };
    const reviewSnapshot = directEmailReviewSnapshot(previews);
    const prepared = prepareAgentApproval(repo, {
      toolName: 'commit_direct_email',
      risk: 'sends_email',
      summary: `Send direct email to ${previews.length} recipient${previews.length === 1 ? '' : 's'}.`,
      operation: { ...operation, reviewSnapshot },
      review: {
        recipients: reviewSnapshot.recipients,
        subjectPreview: previews[0]?.subject ?? '',
        bodyPreview: previews[0]?.body ?? '',
        skippedRecipients: [],
        missingVariables: []
      },
      expiresAt: expiresAt()
    });

    return agentOk(prepared, { labels: settings.vocabulary, nextActions: ['commit_direct_email'] });
  } catch (error) {
    return directEmailValidationError(error, settings);
  }
}

export async function commitDirectEmailTool(repo: AppRepository, input: CommitDirectEmailInput, settingsOverride?: AppSettings) {
  const settings = settingsOverride ?? getSettings();
  const denied = requireAgentPermission(settings, 'sendEmail');
  if (denied) return denied;

  const approval = repo.getAgentApproval(input.approvalId);
  if (!approval) return agentError('not_found', 'Approval was not found.', { approvalId: input.approvalId }, { labels: settings.vocabulary });
  if (approval.toolName !== 'commit_direct_email') {
    return agentError('approval_changed', 'Approval does not match this tool.', { approvalId: input.approvalId }, { labels: settings.vocabulary });
  }
  if (approval.confirmationText !== input.confirmationText) {
    return agentError('approval_required', 'Exact confirmation text is required.', { approvalId: input.approvalId }, { labels: settings.vocabulary });
  }
  const operation = JSON.parse(approval.operationJson) as StoredDirectEmailOperation;
  const currentSnapshot = directEmailReviewSnapshot(previewDirectEmail(repo, operation));
  if (!sameJson(operation.reviewSnapshot, currentSnapshot)) {
    return agentError(
      'approval_changed',
      'Direct email recipients or rendered content changed after approval was prepared.',
      { approvalId: input.approvalId },
      { labels: settings.vocabulary }
    );
  }

  return commitPreparedApproval(repo, input.approvalId, input.confirmationText, async () => {
    const sendInput = {
      ...operation,
      previewToken: directEmailPreviewToken(operation),
      settings,
      surface: 'mcp_direct_email' as const
    };
    return await sendDirectEmail(
      repo,
      (to, subject, text) => sendOutboundEmail({ to, subject, text }),
      sendInput
    );
  });
}

function normalizeDirectEmailInput(input: DirectEmailInput, settings: AppSettings): DirectEmailInput {
  return {
    contactIds: [...new Set(input.contactIds)].filter(Boolean),
    subject: input.subject,
    body: input.body,
    instructorName: input.instructorName || settings.instructorName,
    previewToken: input.previewToken
  };
}

function recipientReview(preview: ReturnType<typeof previewDirectEmail>[number]) {
  return {
    contactId: preview.contact.id,
    email: preview.contact.email,
    name: `${preview.contact.firstName} ${preview.contact.lastName}`.trim(),
    doNotEmail: Boolean(preview.contact.doNotEmail),
    subject: preview.subject,
    missing: preview.missing
  };
}

function directEmailReviewSnapshot(previews: ReturnType<typeof previewDirectEmail>) {
  return {
    recipients: previews.map((preview) => ({
      ...recipientReview(preview),
      body: preview.body
    }))
  };
}

function sameJson(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function requireAgentPermission(settings: AppSettings, permission: 'prepareEmail' | 'sendEmail') {
  if (!settings.agentEnabled) {
    return agentError('agent_permission_denied', 'Agent access is disabled.', { permission: 'agentEnabled' }, { labels: settings.vocabulary });
  }
  if (!settings.agentPermissions[permission]) {
    return agentError(
      'agent_permission_denied',
      permission === 'prepareEmail'
        ? 'Agents are not allowed to prepare emails for confirmation.'
        : 'Agents are not allowed to send emails after confirmation.',
      { permission },
      { labels: settings.vocabulary }
    );
  }
  return null;
}

function directEmailValidationError(error: unknown, settings: AppSettings) {
  const message = error instanceof Error ? error.message : 'Unknown direct email error.';
  if (/not found/i.test(message)) return agentError('not_found', message, undefined, { labels: settings.vocabulary });
  return agentError('validation_failed', message, undefined, { labels: settings.vocabulary });
}

function expiresAt() {
  return new Date(Date.now() + 15 * 60_000).toISOString();
}
