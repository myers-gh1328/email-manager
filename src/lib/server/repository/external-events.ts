import type { DatabaseSync } from 'node:sqlite';
import { now } from './ids';
import type { ExternalEntityType, ExternalEventIngestionInput, ExternalMappingInput, Row } from './types';

export function getExternalMapping(db: DatabaseSync, source: string, entityType: ExternalEntityType, externalId: string) {
  const row = db
    .prepare('select * from external_mappings where source = ? and entity_type = ? and external_id = ?')
    .get(source, entityType, externalId) as Row | undefined;

  if (!row) return undefined;

  return {
    source: String(row.source),
    entityType: String(row.entity_type) as ExternalEntityType,
    externalId: String(row.external_id),
    localId: String(row.local_id)
  };
}

export function setExternalMapping(db: DatabaseSync, input: ExternalMappingInput) {
  const timestamp = now();
  db.prepare(
    `insert into external_mappings (source, entity_type, external_id, local_id, created_at, updated_at)
     values (?, ?, ?, ?, ?, ?)
     on conflict(source, entity_type, external_id) do update set
       local_id = excluded.local_id,
       updated_at = excluded.updated_at`
  ).run(input.source, input.entityType, input.externalId, input.localId, timestamp, timestamp);

  return getExternalMapping(db, input.source, input.entityType, input.externalId);
}

export function getExternalEventIngestion(db: DatabaseSync, source: string, eventId: string) {
  const row = db
    .prepare('select * from external_event_ingestions where event_source = ? and event_id = ?')
    .get(source, eventId) as Row | undefined;

  if (!row) return undefined;

  return {
    source: String(row.event_source),
    eventId: String(row.event_id),
    eventType: String(row.event_type),
    status: String(row.status) as ExternalEventIngestionInput['status'],
    message: String(row.message ?? ''),
    occurredAt: String(row.occurred_at),
    processedAt: String(row.processed_at),
    eventFingerprint: String(row.event_fingerprint ?? ''),
    rawEvent: String(row.raw_event ?? '')
  };
}

export function recordExternalEventIngestion(db: DatabaseSync, input: ExternalEventIngestionInput) {
  db.prepare(
    `insert into external_event_ingestions (
      event_source, event_id, event_type, status, message, occurred_at, processed_at, event_fingerprint, raw_event
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    input.source,
    input.eventId,
    input.eventType,
    input.status,
    input.message ?? '',
    input.occurredAt,
    now(),
    input.eventFingerprint,
    input.rawEvent ?? ''
  );
}
