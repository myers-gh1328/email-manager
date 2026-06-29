import { describe, expect, test, vi } from 'vitest';
import { applyExternalEvent } from '../src/lib/server/external-events';
import { buildNatsConnectOptions, getExternalEventsConfig } from '../src/lib/server/external-events-nats';
import { createTestRepository } from './repository-helpers';

const occurredAt = '2026-06-21T15:00:00Z';

describe('external event ingestion', () => {
  test('parses local NATS subscriber configuration from environment settings', () => {
    expect(getExternalEventsConfig({})).toEqual({
      enabled: false,
      provider: 'none',
      url: 'nats://127.0.0.1:4222',
      subjects: [],
      consumer: 'email-manager',
      importMode: 'review'
    });
    expect(
      getExternalEventsConfig({
        EXTERNAL_EVENTS_ENABLED: 'true',
        EXTERNAL_EVENTS_PROVIDER: 'nats',
        EXTERNAL_EVENTS_URL: 'nats://127.0.0.1:4222',
        EXTERNAL_EVENTS_SUBJECTS: 'scuba.contacts, scuba.classes',
        EXTERNAL_EVENTS_CONSUMER: 'local-importer',
        EXTERNAL_EVENTS_IMPORT_MODE: 'apply'
      })
    ).toEqual({
      enabled: true,
      provider: 'nats',
      url: 'nats://127.0.0.1:4222',
      subjects: ['scuba.contacts', 'scuba.classes'],
      consumer: 'local-importer',
      importMode: 'apply'
    });
  });

  test('maps NATS URL userinfo into client auth options', () => {
    expect(
      buildNatsConnectOptions({
        enabled: true,
        provider: 'nats',
        url: 'nats://user%40example:p%40ss%3Aword@127.0.0.1:4222',
        subjects: ['scuba.contacts'],
        consumer: 'local-importer',
        importMode: 'review'
      })
    ).toEqual({
      servers: '127.0.0.1:4222',
      name: 'local-importer',
      user: 'user@example',
      pass: 'p@ss:word'
    });
  });

  test('stores valid events as pending for review without mutating local data', () => {
    const repo = createTestRepository();

    const result = applyExternalEvent(
      repo,
      {
        type: 'contact.upsert',
        id: 'evt_pending_contact',
        occurredAt,
        source: 'external',
        data: {
          externalId: 'student-123',
          email: 'student@example.com',
          firstName: 'Sam',
          lastName: 'Diver'
        }
      },
      { mode: 'review' }
    );

    expect(result).toMatchObject({
      status: 'pending',
      message: 'Event validated and stored for instructor review.'
    });
    expect(repo.listContacts()).toEqual([]);
    expect(repo.getExternalMapping('external', 'contact', 'student-123')).toBeUndefined();
    expect(repo.getExternalEventIngestion('external', 'evt_pending_contact')).toMatchObject({
      status: 'pending',
      eventType: 'contact.upsert'
    });
    expect(repo.getExternalEventIngestion('external', 'evt_pending_contact')?.rawEvent).toContain('"email":"student@example.com"');
  });

  test('rejects invalid review-mode events without creating pending imports', () => {
    const repo = createTestRepository();

    const result = applyExternalEvent(
      repo,
      {
        type: 'class_user.upsert',
        id: 'evt_pending_invalid',
        occurredAt,
        source: 'external',
        data: {
          externalId: 'enrollment-456',
          classExternalId: 'ow-2026-07-10',
          contactExternalId: 'student-123',
          status: 'waitlisted'
        }
      },
      { mode: 'review' }
    );

    expect(result).toMatchObject({ status: 'invalid', message: 'Unsupported enrollment status: waitlisted' });
    expect(repo.getExternalEventIngestion('external', 'evt_pending_invalid')).toMatchObject({
      status: 'invalid',
      message: 'Unsupported enrollment status: waitlisted'
    });
  });

  test('creates and updates contacts by source external id', () => {
    const repo = createTestRepository();

    const created = applyExternalEvent(repo, {
      type: 'contact.upsert',
      id: 'evt_001',
      occurredAt,
      source: 'external',
      data: {
        externalId: 'student-123',
        email: 'student@example.com',
        firstName: 'Sam',
        lastName: 'Diver',
        phone: '555-0100',
        doNotEmail: false,
        notes: 'Initial'
      }
    });
    const updated = applyExternalEvent(repo, {
      type: 'contact.upsert',
      id: 'evt_002',
      occurredAt,
      source: 'external',
      data: {
        externalId: 'student-123',
        email: 'sam.updated@example.com',
        firstName: 'Sam',
        lastName: 'Diver',
        doNotEmail: true,
        notes: 'Updated'
      }
    });

    expect(created.status).toBe('applied');
    expect(updated).toMatchObject({ status: 'applied', localId: created.localId });
    expect(repo.listContacts()).toMatchObject([
      {
        id: created.localId,
        email: 'sam.updated@example.com',
        doNotEmail: true,
        notes: 'Updated'
      }
    ]);
  });

  test('creates and updates classes without creating campaigns', () => {
    const repo = createTestRepository();

    const created = applyExternalEvent(repo, {
      type: 'class.upsert',
      id: 'evt_003',
      occurredAt,
      source: 'external',
      data: {
        externalId: 'ow-2026-07-10',
        courseName: 'Open Water Diver',
        startsOn: '2026-07-10',
        endsOn: '2026-07-12',
        location: 'Dive Shop',
        notes: 'Initial'
      }
    });
    applyExternalEvent(repo, {
      type: 'class.upsert',
      id: 'evt_004',
      occurredAt,
      source: 'external',
      data: {
        externalId: 'ow-2026-07-10',
        courseName: 'Open Water Diver',
        startsOn: '2026-07-11',
        location: 'Training Pool',
        notes: 'Updated'
      }
    });

    expect(repo.listClassSessions()).toMatchObject([
      {
        id: created.localId,
        courseName: 'Open Water Diver',
        startsOn: '2026-07-11',
        endsOn: '2026-07-11',
        location: 'Training Pool'
      }
    ]);
    expect(repo.listCampaigns()).toEqual([]);
  });

  test('matches class course type through a targeted lookup', () => {
    const repo = createTestRepository();
    const existing = repo.createCourseType({ name: 'Open Water Diver' });
    const listAll = repo.listCourseTypes.bind(repo);
    repo.listCourseTypes = () => {
      throw new Error('class event import should not list every course type');
    };

    const result = applyExternalEvent(repo, {
      type: 'class.upsert',
      id: 'evt_targeted_course_lookup',
      occurredAt,
      source: 'external',
      data: {
        externalId: 'ow-2026-07-10',
        courseName: 'Open Water Diver',
        startsOn: '2026-07-10',
        location: 'Dive Shop'
      }
    });

    repo.listCourseTypes = listAll;
    expect(result).toMatchObject({ status: 'applied' });
    expect(repo.getClassSession(result.localId!)).toMatchObject({ courseTypeId: existing.id });
  });

  test('links class users only through same-source external mappings', () => {
    const repo = createTestRepository();
    applyExternalEvent(repo, {
      type: 'contact.upsert',
      id: 'evt_005',
      occurredAt,
      source: 'external',
      data: { externalId: 'student-123', email: 'student@example.com', firstName: 'Sam', lastName: 'Diver' }
    });
    applyExternalEvent(repo, {
      type: 'class.upsert',
      id: 'evt_006',
      occurredAt,
      source: 'external',
      data: { externalId: 'ow-2026-07-10', courseName: 'Open Water Diver', startsOn: '2026-07-10' }
    });

    const result = applyExternalEvent(repo, {
      type: 'class_user.upsert',
      id: 'evt_007',
      occurredAt,
      source: 'external',
      data: {
        externalId: 'enrollment-456',
        classExternalId: 'ow-2026-07-10',
        contactExternalId: 'student-123',
        role: 'student',
        status: 'enrolled',
        notes: 'Ignored until the local model supports enrollment metadata.'
      }
    });
    applyExternalEvent(repo, {
      type: 'class_user.upsert',
      id: 'evt_008',
      occurredAt,
      source: 'external',
      data: {
        externalId: 'enrollment-456',
        classExternalId: 'ow-2026-07-10',
        contactExternalId: 'student-123'
      }
    });

    const session = repo.listClassSessions()[0];
    expect(result.status).toBe('applied');
    expect(repo.listEnrollments(session.id)).toMatchObject([{ email: 'student@example.com' }]);
    expect(repo.listEnrollments(session.id)).toHaveLength(1);
    expect(repo.listCampaigns()).toEqual([]);
  });

  test('rejects unresolved class users without partial enrollment', () => {
    const repo = createTestRepository();
    const contact = repo.createContact({ firstName: 'Local', lastName: 'Only', email: 'local@example.com' });
    const course = repo.createCourseType({ name: 'Open Water Diver' });
    const session = repo.createClassSession({ courseTypeId: course.id, startsOn: '2026-07-10', location: 'Dive Shop' });

    const result = applyExternalEvent(repo, {
      type: 'class_user.upsert',
      id: 'evt_009',
      occurredAt,
      source: 'external',
      data: {
        externalId: 'enrollment-456',
        classExternalId: 'ow-2026-07-10',
        contactExternalId: 'student-123'
      }
    });

    expect(result).toMatchObject({
      status: 'invalid',
      message: 'Class and contact external IDs must resolve for the same source.'
    });
    expect(repo.listEnrollments(session.id)).toEqual([]);
    expect(repo.getContact(contact.id)).toMatchObject({ email: 'local@example.com' });
  });

  test('records unsupported and invalid supported events without applying data', () => {
    const repo = createTestRepository();

    const unsupported = applyExternalEvent(repo, {
      type: 'campaign.approve',
      id: 'evt_010',
      occurredAt,
      source: 'external',
      data: { externalId: 'campaign-1' }
    });
    const invalid = applyExternalEvent(repo, {
      type: 'contact.upsert',
      id: 'evt_011',
      occurredAt,
      source: 'external',
      data: { externalId: 'student-123' }
    });

    expect(unsupported.status).toBe('unsupported');
    expect(invalid).toMatchObject({ status: 'invalid', message: 'Missing required field: email' });
    expect(repo.listContacts()).toEqual([]);
    expect(repo.listCampaigns()).toEqual([]);
  });

  test('skips exact duplicate source event ids without reapplying mutations', () => {
    const repo = createTestRepository();
    const event = {
      type: 'contact.upsert',
      id: 'evt_duplicate',
      occurredAt,
      source: 'external',
      data: {
        externalId: 'student-123',
        email: 'student@example.com',
        firstName: 'Sam',
        notes: 'Original'
      }
    };

    const first = applyExternalEvent(repo, event);
    const second = applyExternalEvent(repo, event);

    expect(first.status).toBe('applied');
    expect(second).toMatchObject({
      status: 'skipped',
      message: 'Duplicate event external/evt_duplicate already processed as applied.'
    });
    expect(repo.listContacts()).toMatchObject([{ id: first.localId, email: 'student@example.com', notes: 'Original' }]);
    expect(repo.listContacts()).toHaveLength(1);
  });

  test('rejects conflicting source event id replay without mutation', () => {
    const repo = createTestRepository();

    const first = applyExternalEvent(repo, {
      type: 'contact.upsert',
      id: 'evt_conflict',
      occurredAt,
      source: 'external',
      data: {
        externalId: 'student-123',
        email: 'student@example.com',
        firstName: 'Sam',
        notes: 'Original'
      }
    });
    const conflicting = applyExternalEvent(repo, {
      type: 'contact.upsert',
      id: 'evt_conflict',
      occurredAt,
      source: 'external',
      data: {
        externalId: 'student-123',
        email: 'sam.changed@example.com',
        firstName: 'Sam',
        notes: 'Changed'
      }
    });

    expect(first.status).toBe('applied');
    expect(conflicting).toMatchObject({
      status: 'invalid',
      message: 'Conflicting replay for event external/evt_conflict; existing event was not reapplied.'
    });
    expect(repo.listContacts()).toMatchObject([{ id: first.localId, email: 'student@example.com', notes: 'Original' }]);
    expect(repo.getExternalEventIngestion('external', 'evt_conflict')).toMatchObject({ status: 'applied' });
  });

  test('rolls back event mutations when ingestion recording fails', () => {
    const repo = createTestRepository();
    vi.spyOn(repo, 'recordExternalEventIngestion').mockImplementation(() => {
      throw new Error('simulated ingestion write failure');
    });

    expect(() =>
      applyExternalEvent(repo, {
        type: 'contact.upsert',
        id: 'evt_rollback',
        occurredAt,
        source: 'external',
        data: {
          externalId: 'student-123',
          email: 'student@example.com',
          firstName: 'Sam'
        }
      })
    ).toThrow('simulated ingestion write failure');

    expect(repo.listContacts()).toEqual([]);
    expect(repo.getExternalMapping('external', 'contact', 'student-123')).toBeUndefined();
    expect(repo.getExternalEventIngestion('external', 'evt_rollback')).toBeUndefined();
  });

  test('rolls back supported event side effects before recording invalid apply failures', () => {
    const repo = createTestRepository();
    vi.spyOn(repo, 'createClassSession').mockImplementation(() => {
      throw new Error('simulated class write failure');
    });

    const result = applyExternalEvent(repo, {
      type: 'class.upsert',
      id: 'evt_partial_rollback',
      occurredAt,
      source: 'external',
      data: {
        externalId: 'ow-2026-07-10',
        courseName: 'Open Water Diver',
        startsOn: '2026-07-10'
      }
    });

    expect(result).toMatchObject({ status: 'invalid', message: 'simulated class write failure' });
    expect(repo.listCourseTypes()).toEqual([]);
    expect(repo.listClassSessions()).toEqual([]);
    expect(repo.getExternalMapping('external', 'class_session', 'ow-2026-07-10')).toBeUndefined();
    expect(repo.getExternalEventIngestion('external', 'evt_partial_rollback')).toMatchObject({
      status: 'invalid',
      message: 'simulated class write failure'
    });
  });
});
