import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  createClassSession,
  createContact,
  createCourseType,
  createLocation,
  deleteContact,
  enrollContact,
  findContactsByEmails,
  findDuplicateClassSession,
  findDuplicateContact,
  getClassSession,
  getClassSessionDetail,
  getContact,
  getContactHistory,
  getCourseType,
  getLocation,
  listClassSessions,
  listClassSessionsForCourseType,
  listClassSessionsPage,
  listContacts,
  listContactsPage,
  listCourseTypes,
  listCourseTypesPage,
  listEnrollments,
  listLocations,
  listLocationsPage,
  updateClassSession,
  updateContact,
  updateCourseType,
  updateLocation,
  unenrollContact
} from './contacts';
import {
  createCampaign,
  claimNextEligibleDelivery,
  countReadyScheduledEmailsDue,
  countFailedCampaignDeliveriesBetween,
  claimNextPendingDelivery,
  deleteCampaign,
  ensurePendingDeliveries,
  finalizeDeliveryAttemptAccepted,
  finalizeDeliveryAttemptFailed,
  getCampaign,
  getCampaignDetail,
  getNextReadyScheduledEmail,
  hasSentDeliveries,
  listCampaigns,
  listCampaignsPage,
  listCampaignsForClassSession,
  listReadyScheduledEmailsDue,
  listDeliveries,
  listPendingDeliveries,
  markAcceptedAttemptAuditIncomplete,
  markDeliveryFailed,
  markDeliverySent,
  recoverExpiredSendingDeliveries,
  retryCampaignDeliveries,
  retryFailedCampaignDeliveriesBetween,
  updateDeliveryAttemptSnapshot,
  updateDefaultCampaign,
  updateCampaign
} from './campaigns';
import { createTemplate, deleteTemplate, getTemplate, listTemplates, listTemplatesPage, updateTemplate } from './templates';
import {
  listCourseTypeDefaultTemplates,
  listDefaultTemplatesForClassSession,
  removeCourseTypeDefaultTemplate,
  setCourseTypeDefaultTemplate
} from './course-defaults';
import { beginSendOperation, finishSendOperation, getSendOperation, markSendOperationRecipient, reserveOutboundRateEvent, type SendOperationInput } from './outbound';
import {
  createChecklistItem,
  createCourseTypeChecklistItem,
  deleteChecklistItem,
  deleteCourseTypeChecklistItem,
  listChecklistForClassSession,
  listChecklistItems,
  listChecklistItemsPage,
  listCourseTypeChecklistItems,
  listEnrollmentChecklistState,
  setEnrollmentChecklistCompletion,
  updateChecklistItem,
  updateCourseTypeChecklistItem
} from './checklists';
import {
  getCommunication,
  listCommunicationMessageIds,
  listCommunications,
  listCommunicationsPage,
  listContactCommunications,
  listRecentCommunicationMessageIds,
  listRecentContactCommunications,
  listEmailTestAudits,
  listEmailTestAuditsPage,
  markCommunicationReplyReviewed,
  recordCommunication,
  recordCommunicationReply,
  recordEmailTestAudit
} from './communications';
import { getExternalEventIngestion, getExternalMapping, recordExternalEventIngestion, setExternalMapping } from './external-events';
import {
  createAgentApproval,
  expireAgentApprovals,
  getAgentApproval,
  listAgentAuditEvents,
  listPendingAgentApprovals,
  markAgentApprovalCommitting,
  markAgentApprovalCommitted,
  markAgentApprovalFailed,
  markAgentApprovalRejected,
  recordAgentAuditEvent,
  updateAgentApprovalConfirmationText
} from './agent';
import { deleteSetting, getSetting, listSettingKeysByPrefix, setSetting, stats } from './settings';
import { migrate } from './schema';
import type {
  AgentApprovalInput,
  AgentAuditEventInput,
  CampaignInput,
  CampaignPage,
  CampaignPageInput,
  CampaignRecord,
  ChecklistItemInput,
  ChecklistItemPageInput,
  ClassSessionInput,
  ClassSessionPageInput,
  ContactPageInput,
  CommunicationInput,
  CommunicationHistoryPageInput,
  CommunicationReplyInput,
  ContactInput,
  CourseTypeInput,
  CourseTypePageInput,
  CourseTypeChecklistItemInput,
  CourseTypeDefaultTemplateInput,
  DuplicateClassSessionMatch,
  DuplicateContactMatch,
  EmailTestAuditInput,
  EmailTestAuditPageInput,
  EnrollmentChecklistCompletionInput,
  ExternalEntityType,
  ExternalEventIngestion,
  ExternalEventIngestionInput,
  ExternalMappingInput,
  LocationInput,
  LocationPageInput,
  TemplatePageInput,
  TemplateInput
} from './types';

export type {
  AgentApproval,
  AgentApprovalInput,
  AgentApprovalStatus,
  AgentAuditAction,
  AgentAuditEvent,
  AgentAuditEventInput,
  AgentRisk,
  CampaignInput,
  CampaignPage,
  CampaignPageInput,
  CampaignRecord,
  ChecklistItem,
  ChecklistItemPage,
  ChecklistItemPageInput,
  ChecklistItemInput,
  ChecklistItemScope,
  ClassSessionInput,
  ClassSessionPage,
  ClassSessionPageInput,
  ClassSessionRecord,
  ContactPage,
  ContactPageInput,
  ContactRecord,
  CommunicationHistoryItem,
  CommunicationHistoryPage,
  CommunicationHistoryPageInput,
  CommunicationInput,
  CommunicationReply,
  CommunicationReplyInput,
  RecordedCommunicationReply,
  ContactHistoryItem,
  ContactInput,
  CourseTypeChecklistItemInput,
  CourseTypeInput,
  CourseTypePage,
  CourseTypePageInput,
  CourseTypeRecord,
  CourseTypeDefaultTemplateInput,
  DuplicateClassSessionMatch,
  DuplicateContactMatch,
  EmailTestAuditInput,
  EmailTestAuditItem,
  EmailTestAuditPage,
  EmailTestAuditPageInput,
  EnrollmentChecklistCompletionInput,
  EnrollmentChecklistState,
  ExternalEntityType,
  ExternalEventIngestion,
  ExternalEventIngestionInput,
  ExternalMappingInput,
  LocationInput,
  LocationPage,
  LocationPageInput,
  LocationRecord,
  TemplatePage,
  TemplatePageInput,
  TemplateRecord,
  TemplateInput
} from './types';

export class AppRepository {
  private db: DatabaseSync;

  constructor(path: string) {
    mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA foreign_keys = ON');
    migrate(this.db);
  }

  createContact(input: ContactInput) {
    return createContact(this.db, input);
  }

  listContacts() {
    return listContacts(this.db);
  }

  listContactsPage(input?: ContactPageInput) {
    return listContactsPage(this.db, input);
  }

  findContactsByEmails(emails: string[]) {
    return findContactsByEmails(this.db, emails);
  }

  findDuplicateContact(input: Pick<ContactInput, 'email'>, excludeId?: string): DuplicateContactMatch | undefined {
    return findDuplicateContact(this.db, input, excludeId);
  }

  getContact(id: string) {
    return getContact(this.db, id);
  }

  updateContact(id: string, input: ContactInput) {
    return updateContact(this.db, id, input);
  }

  deleteContact(id: string) {
    return deleteContact(this.db, id);
  }

  createCourseType(input: CourseTypeInput) {
    return createCourseType(this.db, input);
  }

  listCourseTypes() {
    return listCourseTypes(this.db);
  }

  listCourseTypesPage(input?: CourseTypePageInput) {
    return listCourseTypesPage(this.db, input);
  }

  getCourseType(id: string) {
    return getCourseType(this.db, id);
  }

  updateCourseType(id: string, input: CourseTypeInput) {
    return updateCourseType(this.db, id, input);
  }

  setCourseTypeDefaultTemplate(input: CourseTypeDefaultTemplateInput) {
    return setCourseTypeDefaultTemplate(this.db, input);
  }

  removeCourseTypeDefaultTemplate(input: { courseTypeId: string; purpose: string; label?: string }) {
    return removeCourseTypeDefaultTemplate(this.db, input);
  }

  listCourseTypeDefaultTemplates(courseTypeId: string) {
    return listCourseTypeDefaultTemplates(this.db, courseTypeId);
  }

  listDefaultTemplatesForClassSession(classSessionId: string) {
    return listDefaultTemplatesForClassSession(this.db, classSessionId);
  }

  createChecklistItem(input: ChecklistItemInput) {
    return createChecklistItem(this.db, input);
  }

  updateChecklistItem(id: string, input: ChecklistItemInput) {
    return updateChecklistItem(this.db, id, input);
  }

  deleteChecklistItem(id: string) {
    return deleteChecklistItem(this.db, id);
  }

  listChecklistItems() {
    return listChecklistItems(this.db);
  }

  listChecklistItemsPage(input?: ChecklistItemPageInput) {
    return listChecklistItemsPage(this.db, input);
  }

  createCourseTypeChecklistItem(input: CourseTypeChecklistItemInput) {
    return createCourseTypeChecklistItem(this.db, input);
  }

  updateCourseTypeChecklistItem(id: string, input: ChecklistItemInput) {
    return updateCourseTypeChecklistItem(this.db, id, input);
  }

  deleteCourseTypeChecklistItem(id: string) {
    return deleteCourseTypeChecklistItem(this.db, id);
  }

  listCourseTypeChecklistItems(courseTypeId: string) {
    return listCourseTypeChecklistItems(this.db, courseTypeId);
  }

  listChecklistForClassSession(classSessionId: string) {
    return listChecklistForClassSession(this.db, classSessionId);
  }

  listEnrollmentChecklistState(classSessionId: string, contactIds?: string[]) {
    return listEnrollmentChecklistState(this.db, classSessionId, contactIds);
  }

  setEnrollmentChecklistCompletion(input: EnrollmentChecklistCompletionInput) {
    return setEnrollmentChecklistCompletion(this.db, input);
  }

  createLocation(input: LocationInput) {
    return createLocation(this.db, input);
  }

  listLocations() {
    return listLocations(this.db);
  }

  listLocationsPage(input?: LocationPageInput) {
    return listLocationsPage(this.db, input);
  }

  getLocation(id: string) {
    return getLocation(this.db, id);
  }

  updateLocation(id: string, input: LocationInput) {
    return updateLocation(this.db, id, input);
  }

  createClassSession(input: ClassSessionInput) {
    return createClassSession(this.db, input);
  }

  updateClassSession(id: string, input: ClassSessionInput) {
    return updateClassSession(this.db, id, input);
  }

  findDuplicateClassSession(input: ClassSessionInput, excludeId?: string): DuplicateClassSessionMatch | undefined {
    return findDuplicateClassSession(this.db, input, excludeId);
  }

  listClassSessions() {
    return listClassSessions(this.db);
  }

  listClassSessionsForCourseType(courseTypeId: string) {
    return listClassSessionsForCourseType(this.db, courseTypeId);
  }

  listClassSessionsPage(input?: ClassSessionPageInput) {
    return listClassSessionsPage(this.db, input);
  }

  getClassSession(id: string) {
    return getClassSession(this.db, id);
  }

  getClassSessionDetail(classSessionId: string, rosterPageInput?: { limit?: number; offset?: number; search?: string }) {
    return getClassSessionDetail(this.db, classSessionId, rosterPageInput);
  }

  enrollContact(classSessionId: string, contactId: string) {
    return enrollContact(this.db, classSessionId, contactId);
  }

  unenrollContact(classSessionId: string, contactId: string) {
    return unenrollContact(this.db, classSessionId, contactId);
  }

  listEnrollments(classSessionId: string) {
    return listEnrollments(this.db, classSessionId);
  }

  getContactHistory(contactId: string) {
    return getContactHistory(this.db, contactId);
  }

  getContactDetail(contactId: string) {
    return {
      contact: this.getContact(contactId),
      classHistory: this.getContactHistory(contactId),
      communications: this.listRecentContactCommunications(contactId)
    };
  }

  createTemplate(input: TemplateInput) {
    return createTemplate(this.db, input);
  }

  listTemplates() {
    return listTemplates(this.db);
  }

  listTemplatesPage(input?: TemplatePageInput) {
    return listTemplatesPage(this.db, input);
  }

  getTemplate(id: string) {
    return getTemplate(this.db, id);
  }

  updateTemplate(id: string, input: TemplateInput) {
    return updateTemplate(this.db, id, input);
  }

  deleteTemplate(id: string) {
    return deleteTemplate(this.db, id);
  }

  createCampaign(input: CampaignInput) {
    return createCampaign(this.db, input);
  }

  listCampaigns() {
    return listCampaigns(this.db);
  }

  listCampaignsPage(input?: CampaignPageInput) {
    return listCampaignsPage(this.db, input);
  }

  countReadyScheduledEmailsDue(nowIso: string) {
    return countReadyScheduledEmailsDue(this.db, nowIso);
  }

  listReadyScheduledEmailsDue(nowIso: string, input?: { limit?: number }) {
    return listReadyScheduledEmailsDue(this.db, nowIso, input);
  }

  getNextReadyScheduledEmail(nowIso: string) {
    return getNextReadyScheduledEmail(this.db, nowIso);
  }

  listCampaignsForClassSession(classSessionId: string): CampaignRecord[];
  listCampaignsForClassSession(classSessionId: string, input: Omit<CampaignPageInput, 'status' | 'nowIso'>): CampaignPage;
  listCampaignsForClassSession(classSessionId: string, input?: Omit<CampaignPageInput, 'status' | 'nowIso'>) {
    return input ? listCampaignsForClassSession(this.db, classSessionId, input) : listCampaignsForClassSession(this.db, classSessionId);
  }

  getCampaign(id: string) {
    return getCampaign(this.db, id);
  }

  getCampaignDetail(id: string, recipientPageInput?: { limit?: number; offset?: number; search?: string }) {
    return getCampaignDetail(this.db, id, recipientPageInput);
  }

  updateCampaign(id: string, input: { name: string; scheduledFor: string; approved: boolean }) {
    return updateCampaign(this.db, id, input);
  }

  updateDefaultCampaign(
    id: string,
    input: {
      templateId: string;
      name: string;
      scheduledFor: string;
      defaultPurpose: string;
      defaultLabel: string;
      sendOffsetMinutes: number;
    }
  ) {
    return updateDefaultCampaign(this.db, id, input);
  }

  hasSentDeliveries(campaignId: string) {
    return hasSentDeliveries(this.db, campaignId);
  }

  deleteCampaign(id: string) {
    return deleteCampaign(this.db, id);
  }

  ensurePendingDeliveries(campaignId: string) {
    return ensurePendingDeliveries(this.db, campaignId);
  }

  claimNextPendingDelivery(campaignId: string) {
    return claimNextPendingDelivery(this.db, campaignId);
  }

  claimNextEligibleDelivery(
    campaignId: string,
    input: Parameters<typeof claimNextEligibleDelivery>[2]
  ) {
    return claimNextEligibleDelivery(this.db, campaignId, input);
  }

  listDeliveries(campaignId: string) {
    return listDeliveries(this.db, campaignId);
  }

  listPendingDeliveries(campaignId: string) {
    return listPendingDeliveries(this.db, campaignId);
  }

  markDeliverySent(deliveryId: string, providerMessage: string) {
    return markDeliverySent(this.db, deliveryId, providerMessage);
  }

  markDeliveryFailed(deliveryId: string, errorMessage: string) {
    return markDeliveryFailed(this.db, deliveryId, errorMessage);
  }

  finalizeDeliveryAttemptAccepted(input: Parameters<typeof finalizeDeliveryAttemptAccepted>[1]) {
    return finalizeDeliveryAttemptAccepted(this.db, input);
  }

  updateDeliveryAttemptSnapshot(input: Parameters<typeof updateDeliveryAttemptSnapshot>[1]) {
    return updateDeliveryAttemptSnapshot(this.db, input);
  }

  finalizeDeliveryAttemptFailed(input: Parameters<typeof finalizeDeliveryAttemptFailed>[1]) {
    return finalizeDeliveryAttemptFailed(this.db, input);
  }

  markAcceptedAttemptAuditIncomplete(input: Parameters<typeof markAcceptedAttemptAuditIncomplete>[1]) {
    return markAcceptedAttemptAuditIncomplete(this.db, input);
  }

  recoverExpiredSendingDeliveries(nowIso?: string, limit?: number) {
    return recoverExpiredSendingDeliveries(this.db, nowIso, limit);
  }

  retryCampaignDeliveries(campaignId: string, recipientIds: string[]) {
    return retryCampaignDeliveries(this.db, campaignId, recipientIds);
  }

  countFailedCampaignDeliveriesBetween(startIso: string, endIso: string) {
    return countFailedCampaignDeliveriesBetween(this.db, startIso, endIso);
  }

  retryFailedCampaignDeliveriesBetween(startIso: string, endIso: string) {
    return retryFailedCampaignDeliveriesBetween(this.db, startIso, endIso);
  }

  recordCommunication(input: CommunicationInput) {
    return recordCommunication(this.db, input);
  }

  getCommunication(id: string) {
    return getCommunication(this.db, id);
  }

  recordCommunicationReply(input: CommunicationReplyInput) {
    return recordCommunicationReply(this.db, input);
  }

  markCommunicationReplyReviewed(id: string) {
    return markCommunicationReplyReviewed(this.db, id);
  }

  listCommunicationMessageIds() {
    return listCommunicationMessageIds(this.db);
  }

  listRecentCommunicationMessageIds(limit?: number) {
    return listRecentCommunicationMessageIds(this.db, limit);
  }

  recordEmailTestAudit(input: EmailTestAuditInput) {
    return recordEmailTestAudit(this.db, input);
  }

  beginSendOperation(input: SendOperationInput) {
    return beginSendOperation(this.db, input);
  }

  getSendOperation(sendOperationId: string) {
    return getSendOperation(this.db, sendOperationId);
  }

  markSendOperationRecipient(operationId: string, contactId: string, input: Parameters<typeof markSendOperationRecipient>[3]) {
    return markSendOperationRecipient(this.db, operationId, contactId, input);
  }

  finishSendOperation(operationId: string, input: Parameters<typeof finishSendOperation>[2]) {
    return finishSendOperation(this.db, operationId, input);
  }

  reserveOutboundRateEvent(input: Parameters<typeof reserveOutboundRateEvent>[1]) {
    return reserveOutboundRateEvent(this.db, input);
  }

  listEmailTestAudits() {
    return listEmailTestAudits(this.db);
  }

  listEmailTestAuditsPage(input?: EmailTestAuditPageInput) {
    return listEmailTestAuditsPage(this.db, input);
  }

  listCommunications() {
    return listCommunications(this.db);
  }

  listCommunicationsPage(input?: CommunicationHistoryPageInput) {
    return listCommunicationsPage(this.db, input);
  }

  listContactCommunications(contactId: string) {
    return listContactCommunications(this.db, contactId);
  }

  listRecentContactCommunications(contactId: string, limit?: number) {
    return listRecentContactCommunications(this.db, contactId, limit);
  }

  getExternalMapping(source: string, entityType: ExternalEntityType, externalId: string) {
    return getExternalMapping(this.db, source, entityType, externalId);
  }

  setExternalMapping(input: ExternalMappingInput) {
    return setExternalMapping(this.db, input);
  }

  getExternalEventIngestion(source: string, eventId: string) {
    return getExternalEventIngestion(this.db, source, eventId);
  }

  recordExternalEventIngestion(input: ExternalEventIngestionInput) {
    return recordExternalEventIngestion(this.db, input);
  }

  createAgentApproval(input: AgentApprovalInput) {
    return createAgentApproval(this.db, input);
  }

  getAgentApproval(id: string) {
    return getAgentApproval(this.db, id);
  }

  listPendingAgentApprovals() {
    return listPendingAgentApprovals(this.db);
  }

  updateAgentApprovalConfirmationText(id: string, confirmationText: string) {
    return updateAgentApprovalConfirmationText(this.db, id, confirmationText);
  }

  markAgentApprovalCommitted(id: string, resultJson: string) {
    return markAgentApprovalCommitted(this.db, id, resultJson);
  }

  markAgentApprovalCommitting(id: string) {
    return markAgentApprovalCommitting(this.db, id);
  }

  markAgentApprovalFailed(id: string, resultJson: string) {
    return markAgentApprovalFailed(this.db, id, resultJson);
  }

  markAgentApprovalRejected(id: string) {
    return markAgentApprovalRejected(this.db, id);
  }

  expireAgentApprovals(nowIso: string) {
    return expireAgentApprovals(this.db, nowIso);
  }

  recordAgentAuditEvent(input: AgentAuditEventInput) {
    return recordAgentAuditEvent(this.db, input);
  }

  listAgentAuditEvents(input?: { limit?: number; cursor?: string }) {
    return listAgentAuditEvents(this.db, input);
  }

  withTransaction<T>(callback: () => T): T {
    this.db.exec('begin immediate');
    try {
      const result = callback();
      this.db.exec('commit');
      return result;
    } catch (error) {
      this.db.exec('rollback');
      throw error;
    }
  }

  getSetting(key: string) {
    return getSetting(this.db, key);
  }

	  setSetting(key: string, value: string) {
	    return setSetting(this.db, key, value);
	  }

	  deleteSetting(key: string) {
	    return deleteSetting(this.db, key);
	  }

	  listSettingKeysByPrefix(prefix: string) {
	    return listSettingKeysByPrefix(this.db, prefix);
	  }

	  stats() {
    return stats(this.db);
  }
}
