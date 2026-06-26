import { createHash } from 'node:crypto';
import type { AppRepository, ContactInput } from './repository';
import { formatPhoneNumber } from '$lib/shared/phone';

export type ExternalEventType = 'contact.upsert' | 'class.upsert' | 'class_user.upsert';
export type ExternalEventStatus = 'applied' | 'invalid' | 'unsupported' | 'skipped' | 'pending';
export type ExternalEventMode = 'apply' | 'review';

export interface ExternalEventEnvelope {
  type: string;
  id: string;
  occurredAt: string;
  source: string;
  data: Record<string, unknown>;
}

export interface ExternalEventResult {
  status: ExternalEventStatus;
  message: string;
  localId?: string;
}

export interface ExternalEventOptions {
  mode?: ExternalEventMode;
}

const supportedEventTypes = new Set(['contact.upsert', 'class.upsert', 'class_user.upsert']);

export function parseExternalEvent(input: unknown): ExternalEventEnvelope {
  const value = typeof input === 'string' ? JSON.parse(input) : input;
  if (!isRecord(value)) throw new Error('Event payload must be an object.');
  const data = value.data;
  return {
    type: requiredString(value, 'type'),
    id: requiredString(value, 'id'),
    occurredAt: requiredString(value, 'occurredAt'),
    source: requiredString(value, 'source'),
    data: isRecord(data) ? data : {}
  };
}

export function applyExternalEvent(repo: AppRepository, rawEvent: unknown, options: ExternalEventOptions = {}): ExternalEventResult {
  let event: ExternalEventEnvelope;
  try {
    event = parseExternalEvent(rawEvent);
  } catch (error) {
    return { status: 'invalid', message: errorMessage(error) };
  }

  if (!supportedEventTypes.has(event.type)) {
    const fingerprint = eventFingerprint(event);
    return applyEventTransaction(repo, event, fingerprint, stableJson(event), () => ({
      status: 'unsupported',
      message: 'Unsupported event type.'
    }));
  }

  const fingerprint = eventFingerprint(event);
  const rawEventSnapshot = stableJson(event);
  return applyEventTransaction(repo, event, fingerprint, rawEventSnapshot, () => {
    if (options.mode === 'review') {
      validateSupportedEvent(event);
      return { status: 'pending', message: 'Event validated and stored for instructor review.' };
    }
    return applySupportedEvent(repo, event);
  });
}

function applyEventTransaction(
  repo: AppRepository,
  event: ExternalEventEnvelope,
  fingerprint: string,
  rawEvent: string,
  apply: () => ExternalEventResult
): ExternalEventResult {
  try {
    return repo.withTransaction(() => {
      const existing = repo.getExternalEventIngestion(event.source, event.id);
      if (existing) {
        if (existing.eventFingerprint && existing.eventFingerprint !== fingerprint) {
          return {
            status: 'invalid',
            message: `Conflicting replay for event ${event.source}/${event.id}; existing event was not reapplied.`
          };
        }
        return {
          status: 'skipped',
          message: `Duplicate event ${event.source}/${event.id} already processed as ${existing.status}.`
        };
      }

      const result = apply();
      repo.recordExternalEventIngestion({
        source: event.source,
        eventId: event.id,
        eventType: event.type,
        status: result.status,
        message: result.message,
        occurredAt: event.occurredAt,
        eventFingerprint: fingerprint,
        rawEvent
      });
      return result;
    });
  } catch (error) {
    const result: ExternalEventResult = { status: 'invalid', message: errorMessage(error) };
    repo.recordExternalEventIngestion({
      source: event.source,
      eventId: event.id,
      eventType: event.type,
      status: result.status,
      message: result.message,
      occurredAt: event.occurredAt,
      eventFingerprint: fingerprint,
      rawEvent
    });
    return result;
  }
}

function applySupportedEvent(repo: AppRepository, event: ExternalEventEnvelope): ExternalEventResult {
  if (event.type === 'contact.upsert') return applyContactUpsert(repo, event);
  if (event.type === 'class.upsert') return applyClassUpsert(repo, event);
  if (event.type === 'class_user.upsert') return applyClassUserUpsert(repo, event);
  return { status: 'unsupported', message: 'Unsupported event type.' };
}

function validateSupportedEvent(event: ExternalEventEnvelope) {
  if (event.type === 'contact.upsert') {
    requiredString(event.data, 'externalId');
    requiredString(event.data, 'email');
    optionalBoolean(event.data, 'doNotEmail');
    return;
  }
  if (event.type === 'class.upsert') {
    requiredString(event.data, 'externalId');
    requiredString(event.data, 'courseName');
    requiredString(event.data, 'startsOn');
    return;
  }
  if (event.type === 'class_user.upsert') {
    requiredString(event.data, 'externalId');
    requiredString(event.data, 'classExternalId');
    requiredString(event.data, 'contactExternalId');
    validateEnrollmentStatus(event);
  }
}

function applyContactUpsert(repo: AppRepository, event: ExternalEventEnvelope): ExternalEventResult {
  const externalId = requiredString(event.data, 'externalId');
  const email = requiredString(event.data, 'email').trim().toLowerCase();
  const mapped = repo.getExternalMapping(event.source, 'contact', externalId);
  const input: ContactInput = {
    firstName: optionalString(event.data, 'firstName') ?? '',
    lastName: optionalString(event.data, 'lastName') ?? '',
    email,
    phone: formatPhoneNumber(optionalString(event.data, 'phone') ?? ''),
    notes: optionalString(event.data, 'notes') ?? '',
    doNotEmail: optionalBoolean(event.data, 'doNotEmail') ?? false
  };

  if (mapped) {
    const existing = repo.getContact(mapped.localId);
    const updated = repo.updateContact(mapped.localId, mergeContact(existing, input));
    return { status: 'applied', message: 'Contact updated.', localId: updated.id };
  }

  const duplicate = repo.findDuplicateContact({ email });
  const contact = duplicate
    ? repo.updateContact(duplicate.id, mergeContact(repo.getContact(duplicate.id), input))
    : repo.createContact(input);
  repo.setExternalMapping({ source: event.source, entityType: 'contact', externalId, localId: contact.id });
  return { status: 'applied', message: duplicate ? 'Contact matched by email and updated.' : 'Contact created.', localId: contact.id };
}

function applyClassUpsert(repo: AppRepository, event: ExternalEventEnvelope): ExternalEventResult {
  const externalId = requiredString(event.data, 'externalId');
  const courseName = requiredString(event.data, 'courseName');
  const startsOn = requiredString(event.data, 'startsOn');
  const course = repo.findCourseTypeByName(courseName) ?? repo.createCourseType({ name: courseName });
  const input = {
    courseTypeId: course.id,
    startsOn,
    endsOn: optionalString(event.data, 'endsOn') || startsOn,
    startTime: optionalString(event.data, 'startTime') ?? '',
    location: optionalString(event.data, 'location') ?? '',
    notes: optionalString(event.data, 'notes') ?? ''
  };
  const mapped = repo.getExternalMapping(event.source, 'class_session', externalId);

  if (mapped) {
    const updated = repo.updateClassSession(mapped.localId, input);
    return { status: 'applied', message: 'Class session updated.', localId: updated.id };
  }

  const duplicate = repo.findDuplicateClassSession(input);
  const session = duplicate ? repo.updateClassSession(duplicate.id, input) : repo.createClassSession(input);
  repo.setExternalMapping({ source: event.source, entityType: 'class_session', externalId, localId: session.id });
  return {
    status: 'applied',
    message: duplicate ? 'Class session matched by duplicate rule and updated.' : 'Class session created.',
    localId: session.id
  };
}

function applyClassUserUpsert(repo: AppRepository, event: ExternalEventEnvelope): ExternalEventResult {
  const externalId = requiredString(event.data, 'externalId');
  const classExternalId = requiredString(event.data, 'classExternalId');
  const contactExternalId = requiredString(event.data, 'contactExternalId');
  const classMapping = repo.getExternalMapping(event.source, 'class_session', classExternalId);
  const contactMapping = repo.getExternalMapping(event.source, 'contact', contactExternalId);
  if (!classMapping || !contactMapping) {
    return { status: 'invalid', message: 'Class and contact external IDs must resolve for the same source.' };
  }

  const status = (optionalString(event.data, 'status') ?? 'enrolled').trim().toLowerCase();
  if (['unenrolled', 'cancelled', 'canceled', 'removed'].includes(status)) {
    repo.unenrollContact(classMapping.localId, contactMapping.localId);
    repo.setExternalMapping({
      source: event.source,
      entityType: 'enrollment',
      externalId,
      localId: `${classMapping.localId}:${contactMapping.localId}`
    });
    return { status: 'applied', message: 'Enrollment removed.', localId: `${classMapping.localId}:${contactMapping.localId}` };
  }
  if (!['enrolled', 'active'].includes(status)) {
    return { status: 'invalid', message: `Unsupported enrollment status: ${status}` };
  }

  repo.enrollContact(classMapping.localId, contactMapping.localId);
  repo.setExternalMapping({
    source: event.source,
    entityType: 'enrollment',
    externalId,
    localId: `${classMapping.localId}:${contactMapping.localId}`
  });
  return { status: 'applied', message: 'Enrollment applied.', localId: `${classMapping.localId}:${contactMapping.localId}` };
}

function validateEnrollmentStatus(event: ExternalEventEnvelope) {
  const status = (optionalString(event.data, 'status') ?? 'enrolled').trim().toLowerCase();
  if (['enrolled', 'active', 'unenrolled', 'cancelled', 'canceled', 'removed'].includes(status)) return;
  throw new Error(`Unsupported enrollment status: ${status}`);
}

function mergeContact(existing: ContactInput, incoming: ContactInput): ContactInput {
  return {
    firstName: incoming.firstName || existing.firstName,
    lastName: incoming.lastName || existing.lastName,
    email: incoming.email,
    phone: incoming.phone || existing.phone,
    notes: incoming.notes || existing.notes,
    doNotEmail: incoming.doNotEmail ?? existing.doNotEmail
  };
}

function requiredString(data: Record<string, unknown>, key: string) {
  const value = data[key];
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Missing required field: ${key}`);
  return value.trim();
}

function optionalString(data: Record<string, unknown>, key: string) {
  const value = data[key];
  return typeof value === 'string' ? value.trim() : undefined;
}

function optionalBoolean(data: Record<string, unknown>, key: string) {
  const value = data[key];
  return typeof value === 'boolean' ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error.';
}

function eventFingerprint(event: ExternalEventEnvelope) {
  return createHash('sha256').update(stableJson(event)).digest('hex');
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort((left, right) => left.localeCompare(right))
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}
