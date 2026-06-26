import type { CampaignDelivery } from '../scheduler';
import type { Row } from './types';

export function rowString(value: unknown) {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? String(value) : '';
}

export function mapContact(row: Row) {
  return {
    id: rowString(row.id),
    firstName: rowString(row.first_name),
    lastName: rowString(row.last_name),
    email: rowString(row.email),
    phone: rowString(row.phone),
    notes: rowString(row.notes),
    doNotEmail: Boolean(row.do_not_email)
  };
}

export function mapCourseType(row: Row) {
  return {
    id: rowString(row.id),
    name: rowString(row.name),
    description: rowString(row.description)
  };
}

export function mapLocation(row: Row) {
  return {
    id: rowString(row.id),
    name: rowString(row.name),
    address: rowString(row.address),
    phone: rowString(row.phone),
    website: rowString(row.website),
    parkingNotes: rowString(row.parking_notes),
    meetingInstructions: rowString(row.meeting_instructions),
    notes: rowString(row.notes)
  };
}

export function mapClassSession(row: Row) {
  return {
    id: rowString(row.id),
    courseTypeId: rowString(row.course_type_id),
    locationId: rowString(row.location_id),
    courseName: rowString(row.course_name),
    startsOn: rowString(row.starts_on),
    endsOn: rowString(row.ends_on || row.starts_on),
    startTime: rowString(row.start_time),
    location: rowString(row.location_name || row.location),
    locationAddress: rowString(row.location_address),
    locationPhone: rowString(row.location_phone),
    locationWebsite: rowString(row.location_website),
    locationParkingNotes: rowString(row.location_parking_notes),
    locationMeetingInstructions: rowString(row.location_meeting_instructions),
    locationNotes: rowString(row.location_notes),
    notes: rowString(row.notes)
  };
}

export function mapTemplate(row: Row) {
  return {
    id: rowString(row.id),
    name: rowString(row.name),
    subject: rowString(row.subject),
    body: rowString(row.body)
  };
}

export function mapCampaign(row: Row) {
  return {
    id: rowString(row.id),
    classSessionId: rowString(row.class_session_id),
    templateId: rowString(row.template_id),
    name: rowString(row.name),
    scheduledFor: rowString(row.scheduled_for),
    approved: Boolean(row.approved),
    source: rowString(row.source) || 'manual',
    defaultPurpose: rowString(row.default_purpose),
    defaultLabel: rowString(row.default_label),
    sendOffsetMinutes: Number(row.send_offset_minutes ?? 0),
    templateName: rowString(row.template_name),
    courseName: rowString(row.course_name),
    startsOn: rowString(row.starts_on),
    endsOn: rowString(row.ends_on || row.starts_on),
    startTime: rowString(row.start_time),
    recipientCount: Number(row.recipient_count ?? 0),
    pendingCount: Number(row.pending_count ?? 0),
    sentCount: Number(row.sent_count ?? 0),
    failedCount: Number(row.failed_count ?? 0)
  };
}

export function mapDelivery(row: Row): CampaignDelivery {
  const status = rowString(row.status);
  const failureKind = rowString(row.failure_kind);
  if (!['pending', 'sending', 'sent', 'failed', 'retry_scheduled', 'needs_attention', 'skipped'].includes(status)) {
    throw new Error(`Unknown delivery status: ${status}`);
  }
  if (!['', 'transient', 'permanent', 'unknown'].includes(failureKind)) {
    throw new Error(`Unknown failure kind: ${failureKind}`);
  }
  return {
    id: rowString(row.id),
    campaignId: rowString(row.campaign_id),
    recipientId: rowString(row.recipient_id),
    status: status as CampaignDelivery['status'],
    createdAt: rowString(row.created_at),
    sentAt: row.sent_at ? rowString(row.sent_at) : undefined,
    providerMessage: row.provider_message ? rowString(row.provider_message) : undefined,
    errorMessage: row.error_message ? rowString(row.error_message) : undefined,
    attemptCount: Number(row.attempt_count ?? 0),
    lastAttemptAt: row.last_attempt_at ? rowString(row.last_attempt_at) : undefined,
    nextAttemptAt: row.next_attempt_at ? rowString(row.next_attempt_at) : undefined,
    claimExpiresAt: row.claim_expires_at ? rowString(row.claim_expires_at) : undefined,
    failureKind: failureKind ? (failureKind as CampaignDelivery['failureKind']) : undefined,
    failureSummary: row.failure_summary ? rowString(row.failure_summary) : undefined,
    needsAuditRepair: Boolean(row.needs_audit_repair),
    retryPolicyMaxAutoRetries: Number(row.retry_policy_max_auto_retries ?? 3),
    retryPolicyBackoff: rowString(row.retry_policy_backoff) || '[300,1800,7200]',
    attemptId: row.attempt_id ? rowString(row.attempt_id) : undefined,
    attemptNumber: row.attempt_number ? Number(row.attempt_number) : undefined
  };
}
