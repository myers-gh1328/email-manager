export interface ContactInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  notes?: string;
  doNotEmail?: boolean;
}

export interface ContactPageInput {
  limit?: number;
  offset?: number;
  search?: string;
}

export interface ContactPage {
  items: ContactRecord[];
  total: number;
  limit: number;
  offset: number;
  search: string;
}

export interface ContactRecord {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  notes: string;
  doNotEmail: boolean;
}

export interface CourseTypeInput {
  name: string;
  description?: string;
}

export interface ClassSessionInput {
  courseTypeId: string;
  locationId?: string;
  startsOn: string;
  endsOn?: string;
  startTime?: string;
  location: string;
  notes?: string;
}

export interface ClassSessionRecord {
  id: string;
  courseTypeId: string;
  locationId: string;
  courseName: string;
  startsOn: string;
  endsOn: string;
  startTime: string;
  location: string;
  locationAddress: string;
  locationPhone: string;
  locationWebsite: string;
  locationParkingNotes: string;
  locationMeetingInstructions: string;
  locationNotes: string;
  notes: string;
}

export interface ClassSessionPageInput {
  limit?: number;
  offset?: number;
  search?: string;
}

export interface ClassSessionPage {
  items: ClassSessionRecord[];
  total: number;
  limit: number;
  offset: number;
  search: string;
}

export interface DuplicateContactMatch {
  id: string;
  email: string;
}

export interface DuplicateClassSessionMatch {
  id: string;
  courseTypeId: string;
  startsOn: string;
  startTime: string;
  locationId: string;
  location: string;
}

export interface LocationInput {
  name: string;
  address?: string;
  phone?: string;
  website?: string;
  parkingNotes?: string;
  meetingInstructions?: string;
  notes?: string;
}

export interface TemplateInput {
  name: string;
  subject: string;
  body: string;
}

export interface TemplateRecord {
  id: string;
  name: string;
  subject: string;
  body: string;
}

export interface TemplatePageInput {
  limit?: number;
  offset?: number;
  search?: string;
}

export interface TemplatePage {
  items: TemplateRecord[];
  total: number;
  limit: number;
  offset: number;
  search: string;
}

export interface CourseTypeDefaultTemplateInput {
  courseTypeId: string;
  purpose: string;
  label?: string;
  templateId: string;
  sortOrder?: number;
  sendOffsetMinutes?: number;
}

export type ChecklistItemScope = 'global' | 'course_type';

export interface ChecklistItemInput {
  label: string;
}

export interface CourseTypeChecklistItemInput {
  courseTypeId: string;
  label: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  scope: ChecklistItemScope;
  courseTypeId?: string;
  sortOrder: number;
  createdAt: string;
}

export interface EnrollmentChecklistCompletionInput {
  classSessionId: string;
  contactId: string;
  itemScope: ChecklistItemScope;
  itemId: string;
  completed: boolean;
}

export interface EnrollmentChecklistState {
  classSessionId: string;
  contactId: string;
  contactName: string;
  contactEmail: string;
  itemScope: ChecklistItemScope;
  itemId: string;
  label: string;
  sortOrder: number;
  completed: boolean;
}

export interface CampaignInput {
  classSessionId: string;
  templateId: string;
  name: string;
  scheduledFor: string;
  approved: boolean;
  source?: 'manual' | 'course_default';
  defaultPurpose?: string;
  defaultLabel?: string;
  sendOffsetMinutes?: number;
}

export interface CampaignRecord {
  id: string;
  classSessionId: string;
  templateId: string;
  name: string;
  scheduledFor: string;
  approved: boolean;
  source: string;
  defaultPurpose: string;
  defaultLabel: string;
  sendOffsetMinutes: number;
  templateName: string;
  courseName: string;
  startsOn: string;
  endsOn: string;
  startTime: string;
  recipientCount: number;
  pendingCount: number;
  sentCount: number;
  failedCount: number;
}

export interface CampaignPageInput {
  limit?: number;
  offset?: number;
  search?: string;
  status?: string;
  nowIso?: string;
}

export interface CampaignPage {
  items: CampaignRecord[];
  total: number;
  limit: number;
  offset: number;
  search: string;
  status: string;
}

export interface CommunicationInput {
  contactId: string;
  channel: 'email';
  source: 'direct' | 'campaign';
  sourceId?: string;
  deliveryAttemptId?: string;
  originalRecipient?: string;
  effectiveRecipient?: string;
  testMode?: boolean;
  subject: string;
  body: string;
  status: 'accepted' | 'sent' | 'failed';
  messageId?: string;
  providerMessage?: string;
  errorMessage?: string;
}

export interface CommunicationReplyInput {
  communicationId: string;
  providerKey: string;
  providerMessageId?: string;
  fromName?: string;
  fromEmail?: string;
  subject?: string;
  textBody?: string;
  htmlBody?: string;
  snippet?: string;
  receivedAt: string;
}

export interface CommunicationReply {
  id: string;
  communicationId: string;
  providerKey: string;
  providerMessageId: string;
  fromName: string;
  fromEmail: string;
  subject: string;
  textBody: string;
  htmlBody: string;
  snippet: string;
  receivedAt: string;
  reviewedAt: string;
  createdAt: string;
}

export type RecordedCommunicationReply = CommunicationReply & {
  created: boolean;
};

export interface CommunicationHistoryItem {
  id: string;
  contactId: string;
  contactName: string;
  contactEmail: string;
  channel: 'email';
  source: 'direct' | 'campaign';
  sourceId?: string;
  originalRecipient: string;
  effectiveRecipient: string;
  testMode: boolean;
  subject: string;
  body: string;
  status: 'accepted' | 'sent' | 'failed';
  sentAt?: string;
  messageId?: string;
  providerMessage?: string;
  errorMessage?: string;
  createdAt: string;
  replies: CommunicationReply[];
  replyCount: number;
  unreviewedReplyCount: number;
  acknowledgedAt?: string;
}

export interface CommunicationHistoryPageInput {
  limit?: number;
  offset?: number;
  search?: string;
  contactId?: string;
}

export interface CommunicationHistoryPage {
  items: CommunicationHistoryItem[];
  total: number;
  limit: number;
  offset: number;
  search: string;
  contactId: string;
}

export interface EmailTestAuditInput {
  originalRecipient: string;
  effectiveRecipient: string;
  subject: string;
  body: string;
  providerMessage?: string;
}

export interface EmailTestAuditItem {
  id: string;
  originalRecipient: string;
  effectiveRecipient: string;
  subject: string;
  body: string;
  providerMessage?: string;
  createdAt: string;
}

export interface EmailTestAuditPageInput {
  limit?: number;
  offset?: number;
  search?: string;
}

export interface EmailTestAuditPage {
  items: EmailTestAuditItem[];
  total: number;
  limit: number;
  offset: number;
  search: string;
}

export type ExternalEntityType = 'contact' | 'class_session' | 'enrollment';

export interface ExternalMappingInput {
  source: string;
  entityType: ExternalEntityType;
  externalId: string;
  localId: string;
}

export interface ExternalEventIngestionInput {
  source: string;
  eventId: string;
  eventType: string;
  status: 'applied' | 'invalid' | 'unsupported' | 'skipped' | 'pending';
  message?: string;
  occurredAt: string;
  eventFingerprint: string;
  rawEvent?: string;
}

export interface ExternalEventIngestion {
  source: string;
  eventId: string;
  eventType: string;
  status: 'applied' | 'invalid' | 'unsupported' | 'skipped' | 'pending';
  message: string;
  occurredAt: string;
  processedAt: string;
  eventFingerprint: string;
  rawEvent: string;
}

export type AgentRisk =
  | 'read'
  | 'draft_or_edit'
  | 'imports_data'
  | 'changes_operational_settings'
  | 'schedules_email'
  | 'sends_email'
  | 'changes_secrets_or_auth';

export type AgentApprovalStatus = 'pending' | 'committing' | 'committed' | 'expired' | 'rejected' | 'failed';

export type AgentAuditAction = 'prepare' | 'commit' | 'reject' | 'expire' | 'read' | 'mutate' | 'permission_denied';

export interface AgentApprovalInput {
  toolName: string;
  risk: AgentRisk;
  summary: string;
  operationJson: string;
  reviewJson: string;
  confirmationText: string;
  expiresAt: string;
}

export interface AgentApproval extends AgentApprovalInput {
  id: string;
  status: AgentApprovalStatus;
  createdAt: string;
  committedAt: string;
  resultJson: string;
}

export interface AgentAuditEventInput {
  toolName: string;
  risk: AgentRisk;
  action: AgentAuditAction;
  summary: string;
  entityType?: string;
  entityId?: string;
  status: string;
}

export interface AgentAuditEvent extends AgentAuditEventInput {
  id: string;
  createdAt: string;
}

export interface ContactHistoryItem {
  classSessionId: string;
  courseName: string;
  startsOn: string;
  endsOn: string;
  startTime: string;
  location: string;
  locationAddress: string;
  locationPhone: string;
  locationWebsite: string;
  locationParkingNotes: string;
  locationMeetingInstructions: string;
  locationNotes: string;
}

export type Row = Record<string, unknown>;
