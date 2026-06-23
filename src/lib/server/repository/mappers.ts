import type { CampaignDelivery } from '../scheduler';
import type { Row } from './types';

export function mapContact(row: Row) {
  return {
    id: String(row.id),
    firstName: String(row.first_name),
    lastName: String(row.last_name),
    email: String(row.email),
    phone: String(row.phone ?? ''),
    notes: String(row.notes ?? ''),
    doNotEmail: Boolean(row.do_not_email)
  };
}

export function mapCourseType(row: Row) {
  return {
    id: String(row.id),
    name: String(row.name),
    description: String(row.description ?? '')
  };
}

export function mapLocation(row: Row) {
  return {
    id: String(row.id),
    name: String(row.name),
    address: String(row.address ?? ''),
    phone: String(row.phone ?? ''),
    website: String(row.website ?? ''),
    parkingNotes: String(row.parking_notes ?? ''),
    meetingInstructions: String(row.meeting_instructions ?? ''),
    notes: String(row.notes ?? '')
  };
}

export function mapClassSession(row: Row) {
  return {
    id: String(row.id),
    courseTypeId: String(row.course_type_id),
    locationId: row.location_id ? String(row.location_id) : '',
    courseName: String(row.course_name),
    startsOn: String(row.starts_on),
    endsOn: String(row.ends_on || row.starts_on),
    startTime: String(row.start_time ?? ''),
    location: String(row.location_name || row.location),
    locationAddress: String(row.location_address ?? ''),
    locationPhone: String(row.location_phone ?? ''),
    locationWebsite: String(row.location_website ?? ''),
    locationParkingNotes: String(row.location_parking_notes ?? ''),
    locationMeetingInstructions: String(row.location_meeting_instructions ?? ''),
    locationNotes: String(row.location_notes ?? ''),
    notes: String(row.notes ?? '')
  };
}

export function mapTemplate(row: Row) {
  return {
    id: String(row.id),
    name: String(row.name),
    subject: String(row.subject),
    body: String(row.body)
  };
}

export function mapCampaign(row: Row) {
  return {
    id: String(row.id),
    classSessionId: String(row.class_session_id),
    templateId: String(row.template_id),
    name: String(row.name),
    scheduledFor: String(row.scheduled_for),
    approved: Boolean(row.approved),
    source: String(row.source ?? 'manual'),
    defaultPurpose: String(row.default_purpose ?? ''),
    defaultLabel: String(row.default_label ?? ''),
    sendOffsetMinutes: Number(row.send_offset_minutes ?? 0),
    templateName: String(row.template_name),
    courseName: String(row.course_name),
    startsOn: String(row.starts_on),
    endsOn: String(row.ends_on || row.starts_on),
    startTime: String(row.start_time ?? '')
  };
}

export function mapDelivery(row: Row): CampaignDelivery {
  const status = String(row.status);
  const failureKind = String(row.failure_kind ?? '');
  if (!['pending', 'sending', 'sent', 'failed', 'retry_scheduled', 'needs_attention', 'skipped'].includes(status)) {
    throw new Error(`Unknown delivery status: ${status}`);
  }
  if (!['', 'transient', 'permanent', 'unknown'].includes(failureKind)) {
    throw new Error(`Unknown failure kind: ${failureKind}`);
  }
  return {
    id: String(row.id),
    campaignId: String(row.campaign_id),
    recipientId: String(row.recipient_id),
    status: status as CampaignDelivery['status'],
    createdAt: String(row.created_at),
    sentAt: row.sent_at ? String(row.sent_at) : undefined,
    providerMessage: row.provider_message ? String(row.provider_message) : undefined,
    errorMessage: row.error_message ? String(row.error_message) : undefined,
    attemptCount: Number(row.attempt_count ?? 0),
    lastAttemptAt: row.last_attempt_at ? String(row.last_attempt_at) : undefined,
    nextAttemptAt: row.next_attempt_at ? String(row.next_attempt_at) : undefined,
    claimExpiresAt: row.claim_expires_at ? String(row.claim_expires_at) : undefined,
    failureKind: failureKind as CampaignDelivery['failureKind'],
    failureSummary: row.failure_summary ? String(row.failure_summary) : undefined,
    needsAuditRepair: Boolean(row.needs_audit_repair),
    retryPolicyMaxAutoRetries: Number(row.retry_policy_max_auto_retries ?? 3),
    retryPolicyBackoff: String(row.retry_policy_backoff ?? '[300,1800,7200]'),
    attemptId: row.attempt_id ? String(row.attempt_id) : undefined,
    attemptNumber: row.attempt_number ? Number(row.attempt_number) : undefined
  };
}
