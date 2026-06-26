import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, test } from 'vitest';
import { AppRepository } from '../src/lib/server/repository';
import { createTestRepository } from './repository-helpers';

describe('repository contacts and classes', () => {
  test('lists class sessions with pagination and search', () => {
    const repo = createTestRepository();
    const openWater = repo.createCourseType({ name: 'Open Water' });
    const rescue = repo.createCourseType({ name: 'Rescue Diver' });
    repo.createClassSession({ courseTypeId: openWater.id, startsOn: '2026-08-02', location: 'Pool' });
    repo.createClassSession({ courseTypeId: rescue.id, startsOn: '2026-09-10', location: 'Dock' });

    const page = repo.listClassSessionsPage({ limit: 1, offset: 0, search: 'rescue' });

    expect(page.total).toBe(1);
    expect(page.limit).toBe(1);
    expect(page.offset).toBe(0);
    expect(page.items).toMatchObject([{ courseName: 'Rescue Diver', location: 'Dock' }]);
  });

  test('lists contacts with pagination and search', () => {
    const repo = createTestRepository();
    repo.createContact({ firstName: 'Maya', lastName: 'Patel', email: 'maya@example.com' });
    repo.createContact({ firstName: 'Jo', lastName: 'Rivera', email: 'jo@example.com' });
    repo.createContact({ firstName: 'Maya', lastName: 'Chen', email: 'maya.chen@example.com' });

    const page = repo.listContactsPage({ limit: 1, offset: 0, search: 'maya' });

    expect(page.total).toBe(2);
    expect(page.limit).toBe(1);
    expect(page.offset).toBe(0);
    expect(page.items).toMatchObject([
      {
        firstName: 'Maya',
        lastName: 'Chen',
        email: 'maya.chen@example.com'
      }
    ]);
  });

  test('reports legacy duplicate contact emails before creating unique indexes', () => {
    const dbPath = join(mkdtempSync(join(tmpdir(), 'scuba-email-')), 'app.sqlite');
    const db = new DatabaseSync(dbPath);
    db.exec(`
      create table contacts (
        id text primary key,
        first_name text not null,
        last_name text not null,
        email text not null,
        phone text not null default '',
        notes text not null default '',
        do_not_email integer not null default 0,
        created_at text not null
      );
      insert into contacts (id, first_name, last_name, email, created_at)
      values ('c1', 'Maya', 'Patel', 'Maya@example.com', '2026-01-01T00:00:00.000Z'),
             ('c2', 'Maya', 'Patel', ' maya@example.com ', '2026-01-01T00:00:00.000Z');
    `);
    db.close();

    expect(() => new AppRepository(dbPath)).toThrow('Duplicate contact emails must be merged before migration: maya@example.com');
  });

  test('reports legacy duplicate class sessions before creating unique indexes', () => {
    const dbPath = join(mkdtempSync(join(tmpdir(), 'scuba-email-')), 'app.sqlite');
    const db = new DatabaseSync(dbPath);
    db.exec(`
      create table course_types (
        id text primary key,
        name text not null,
        description text not null default '',
        created_at text not null
      );
      create table class_sessions (
        id text primary key,
        course_type_id text not null,
        location_id text,
        starts_on text not null,
        ends_on text not null default '',
        start_time text not null default '',
        location text not null,
        notes text not null default '',
        created_at text not null
      );
      insert into course_types (id, name, created_at) values ('course-1', 'Open Water', '2026-01-01T00:00:00.000Z');
      insert into class_sessions (id, course_type_id, starts_on, ends_on, start_time, location, created_at)
      values ('s1', 'course-1', '2026-07-12', '2026-07-12', '09:00', 'Blue Quarry', '2026-01-01T00:00:00.000Z'),
             ('s2', 'course-1', '2026-07-12', '2026-07-12', '09:00', ' blue quarry ', '2026-01-01T00:00:00.000Z');
    `);
    db.close();

    expect(() => new AppRepository(dbPath)).toThrow('Duplicate class sessions must be merged before migration: course-1/2026-07-12/09:00/blue quarry');
  });

  test('keeps contacts reusable across class sessions and tracks history', () => {
    const repo = createTestRepository();

    const contact = repo.createContact({
      firstName: 'Maya',
      lastName: 'Patel',
      email: 'maya@example.com',
      phone: '555-0100',
      notes: 'Needs pool gear sizing.'
    });
    const course = repo.createCourseType({ name: 'Open Water', description: 'Entry-level certification' });
    const session = repo.createClassSession({
      courseTypeId: course.id,
      startsOn: '2026-07-12',
      location: 'Blue Quarry',
      notes: 'Bring logbooks.'
    });

    repo.enrollContact(session.id, contact.id);

    expect(repo.listContacts()[0].email).toBe('maya@example.com');
    expect(repo.getContactHistory(contact.id)).toEqual([
      {
        classSessionId: session.id,
        courseName: 'Open Water',
        startsOn: '2026-07-12',
        endsOn: '2026-07-12',
        startTime: '',
        location: 'Blue Quarry',
        locationAddress: '',
        locationPhone: '',
        locationWebsite: '',
        locationParkingNotes: '',
        locationMeetingInstructions: '',
        locationNotes: ''
      }
    ]);
  });

  test('loads contact detail with class and communication history', () => {
    const repo = createTestRepository();
    const contact = repo.createContact({ firstName: 'Maya', lastName: 'Patel', email: 'maya@example.com' });
    const course = repo.createCourseType({ name: 'Open Water' });
    const session = repo.createClassSession({ courseTypeId: course.id, startsOn: '2026-07-12', location: 'Blue Quarry' });
    repo.enrollContact(session.id, contact.id);
    repo.recordCommunication({
      contactId: contact.id,
      channel: 'email',
      source: 'direct',
      subject: 'Welcome',
      body: 'Hi Maya',
      status: 'accepted',
      providerMessage: 'accepted'
    });

    const detail = repo.getContactDetail(contact.id);

    expect(detail.contact).toMatchObject({ id: contact.id, email: 'maya@example.com' });
    expect(detail.classHistory).toHaveLength(1);
    expect(detail.communications).toMatchObject([{ contactId: contact.id, subject: 'Welcome', status: 'accepted' }]);
  });

  test('limits contact detail email activity to the three most recent messages', () => {
    const repo = createTestRepository();
    const contact = repo.createContact({ firstName: 'Maya', lastName: 'Patel', email: 'maya@example.com' });

    for (const subject of ['First', 'Second', 'Third', 'Fourth']) {
      repo.recordCommunication({
        contactId: contact.id,
        channel: 'email',
        source: 'direct',
        subject,
        body: `${subject} body`,
        status: 'accepted'
      });
    }

    expect(repo.getContactDetail(contact.id).communications.map((item) => item.subject)).toEqual(['Fourth', 'Third', 'Second']);
  });

  test('updates a contact in place so history remains attached', () => {
    const repo = createTestRepository();
    const contact = repo.createContact({ firstName: 'Maya', lastName: 'Patel', email: 'maya@example.com' });
    repo.recordCommunication({
      contactId: contact.id,
      channel: 'email',
      source: 'direct',
      subject: 'Welcome',
      body: 'Hi Maya',
      status: 'accepted'
    });

    const updated = repo.updateContact(contact.id, {
      firstName: 'Maya',
      lastName: 'Singh',
      email: 'maya.singh@example.com',
      phone: '555-0199',
      notes: 'Updated notes',
      doNotEmail: true
    });

    expect(updated).toMatchObject({
      id: contact.id,
      lastName: 'Singh',
      email: 'maya.singh@example.com',
      phone: '555-0199',
      notes: 'Updated notes',
      doNotEmail: true
    });
    expect(repo.listContactCommunications(contact.id)[0]).toMatchObject({
      contactId: contact.id,
      contactName: 'Maya Singh',
      contactEmail: 'maya.singh@example.com'
    });
  });

  test('detects and rejects duplicate contact emails during normal create and update', () => {
    const repo = createTestRepository();
    const first = repo.createContact({ firstName: 'Maya', lastName: 'Patel', email: 'Maya@Example.com' });
    const second = repo.createContact({ firstName: 'Jo', lastName: 'Kim', email: 'jo@example.com' });

    expect(repo.findDuplicateContact({ email: ' maya@example.COM ' })).toMatchObject({
      id: first.id,
      email: 'maya@example.com'
    });
    expect(repo.findDuplicateContact({ email: 'MAYA@example.com' }, first.id)).toBeUndefined();
    expect(() => repo.createContact({ firstName: 'Duplicate', lastName: 'User', email: ' MAYA@example.com ' })).toThrow(
      'Duplicate contact email: maya@example.com'
    );
    expect(() =>
      repo.updateContact(second.id, { firstName: 'Jo', lastName: 'Kim', email: 'maya@example.com' })
    ).toThrow('Duplicate contact email: maya@example.com');

    expect(repo.listContacts().map((contact) => contact.email).sort()).toEqual(['jo@example.com', 'maya@example.com']);
  });

  test('deletes a contact', () => {
    const repo = createTestRepository();
    const contact = repo.createContact({ firstName: 'Maya', lastName: 'Patel', email: 'maya@example.com' });

    repo.deleteContact(contact.id);

    expect(repo.listContacts()).toEqual([]);
  });

  test('updates a course type in place', () => {
    const repo = createTestRepository();
    const course = repo.createCourseType({ name: 'Open Water', description: 'Entry-level' });

    const updated = repo.updateCourseType(course.id, { name: 'Open Water Diver', description: 'Entry-level certification' });

    expect(updated).toMatchObject({
      id: course.id,
      name: 'Open Water Diver',
      description: 'Entry-level certification'
    });
    expect(repo.listCourseTypes()).toMatchObject([{ id: course.id, name: 'Open Water Diver' }]);
  });

  test('stores managed locations for classes', () => {
    const repo = createTestRepository();
    const course = repo.createCourseType({ name: 'Open Water' });
    const location = repo.createLocation({
      name: 'Blue Quarry',
      address: '123 Quarry Road',
      phone: '555-0101',
      website: 'https://example.com',
      parkingNotes: 'Park by the shop.',
      meetingInstructions: 'Meet at the front counter.',
      notes: 'Bring waiver.'
    });

    const session = repo.createClassSession({
      courseTypeId: course.id,
      locationId: location.id,
      startsOn: '2026-07-12',
      location: '',
      notes: ''
    });

    expect(repo.getClassSession(session.id)).toMatchObject({
      locationId: location.id,
      location: 'Blue Quarry',
      locationAddress: '123 Quarry Road',
      locationPhone: '555-0101',
      locationWebsite: 'https://example.com',
      locationParkingNotes: 'Park by the shop.',
      locationMeetingInstructions: 'Meet at the front counter.',
      locationNotes: 'Bring waiver.'
    });
  });

  test('loads and manages a class session roster', () => {
    const repo = createTestRepository();
    const contact = repo.createContact({ firstName: 'Maya', lastName: 'Patel', email: 'maya@example.com' });
    const course = repo.createCourseType({ name: 'Open Water' });
    const session = repo.createClassSession({
      courseTypeId: course.id,
      startsOn: '2026-07-12',
      endsOn: '2026-07-14',
      startTime: '09:30',
      location: 'Blue Quarry'
    });
    repo.enrollContact(session.id, contact.id);

    expect(repo.getClassSessionDetail(session.id)).toMatchObject({
      session: { id: session.id, courseName: 'Open Water', endsOn: '2026-07-14', startTime: '09:30' },
      roster: [{ id: contact.id, email: 'maya@example.com' }]
    });

    repo.updateClassSession(session.id, {
      courseTypeId: course.id,
      startsOn: '2026-07-13',
      endsOn: '2026-07-15',
      startTime: '18:00',
      location: 'Training Pool',
      notes: 'Updated'
    });
    repo.unenrollContact(session.id, contact.id);

    expect(repo.getClassSession(session.id)).toMatchObject({
      startsOn: '2026-07-13',
      endsOn: '2026-07-15',
      startTime: '18:00',
      location: 'Training Pool'
    });
    expect(repo.getClassSessionDetail(session.id).roster).toEqual([]);
  });

  test('detects and rejects duplicate class sessions during normal create and update', () => {
    const repo = createTestRepository();
    const course = repo.createCourseType({ name: 'Open Water' });
    const otherCourse = repo.createCourseType({ name: 'Advanced Open Water' });
    const first = repo.createClassSession({
      courseTypeId: course.id,
      startsOn: '2026-07-12',
      startTime: '09:00',
      location: 'Blue Quarry'
    });
    const second = repo.createClassSession({
      courseTypeId: otherCourse.id,
      startsOn: '2026-07-12',
      startTime: '09:00',
      location: 'Blue Quarry'
    });

    expect(
      repo.findDuplicateClassSession({
        courseTypeId: course.id,
        startsOn: '2026-07-12',
        startTime: '09:00',
        location: ' blue quarry '
      })
    ).toMatchObject({ id: first.id, location: 'Blue Quarry' });
    expect(
      repo.findDuplicateClassSession(
        {
          courseTypeId: course.id,
          startsOn: '2026-07-12',
          startTime: '09:00',
          location: 'Blue Quarry'
        },
        first.id
      )
    ).toBeUndefined();
    expect(() =>
      repo.createClassSession({
        courseTypeId: course.id,
        startsOn: '2026-07-12',
        startTime: '09:00',
        location: 'BLUE QUARRY'
      })
    ).toThrow(`Duplicate class session: ${first.id}`);
    expect(() =>
      repo.updateClassSession(second.id, {
        courseTypeId: course.id,
        startsOn: '2026-07-12',
        startTime: '09:00',
        location: 'Blue Quarry'
      })
    ).toThrow(`Duplicate class session: ${first.id}`);
  });

  test('detects managed-location class duplicates by location id', () => {
    const repo = createTestRepository();
    const course = repo.createCourseType({ name: 'Open Water' });
    const location = repo.createLocation({ name: 'Blue Quarry' });
    const first = repo.createClassSession({
      courseTypeId: course.id,
      locationId: location.id,
      startsOn: '2026-07-12',
      startTime: '09:00',
      location: ''
    });

    expect(
      repo.findDuplicateClassSession({
        courseTypeId: course.id,
        locationId: location.id,
        startsOn: '2026-07-12',
        startTime: '09:00',
        location: 'Renamed display value'
      })
    ).toMatchObject({ id: first.id, locationId: location.id });
    expect(() =>
      repo.createClassSession({
        courseTypeId: course.id,
        locationId: location.id,
        startsOn: '2026-07-12',
        startTime: '09:00',
        location: 'Blue Quarry'
      })
    ).toThrow(`Duplicate class session: ${first.id}`);
  });

  test('defaults class end date to start date', () => {
    const repo = createTestRepository();
    const course = repo.createCourseType({ name: 'Open Water' });

    const session = repo.createClassSession({ courseTypeId: course.id, startsOn: '2026-07-12', location: 'Blue Quarry' });

    expect(session).toMatchObject({ startsOn: '2026-07-12', endsOn: '2026-07-12', startTime: '' });
  });

  test('stores default class email send timing with the template', () => {
    const repo = createTestRepository();
    const course = repo.createCourseType({ name: 'Open Water' });
    const template = repo.createTemplate({ name: 'Reminder', subject: 'Class reminder', body: 'See you soon.' });

    repo.setCourseTypeDefaultTemplate({
      courseTypeId: course.id,
      purpose: 'reminder',
      templateId: template.id,
      sortOrder: 1,
      sendOffsetMinutes: -24 * 60
    });

    expect(repo.listCourseTypeDefaultTemplates(course.id)).toMatchObject([
      {
        purpose: 'reminder',
        templateId: template.id,
        templateName: 'Reminder',
        sendOffsetMinutes: -24 * 60
      }
    ]);
  });

  test('manages global checklist items in order', () => {
    const repo = createTestRepository();

    const first = repo.createChecklistItem({ label: 'Medical form complete' });
    const second = repo.createChecklistItem({ label: 'Academics complete' });
    const updated = repo.updateChecklistItem(second.id, { label: 'Academic review complete' });

    expect(updated).toMatchObject({ id: second.id, label: 'Academic review complete', sortOrder: 1 });
    expect(repo.listChecklistItems()).toMatchObject([
      { id: first.id, label: 'Medical form complete', scope: 'global', sortOrder: 0 },
      { id: second.id, label: 'Academic review complete', scope: 'global', sortOrder: 1 }
    ]);
  });

  test('combines global and course-type checklist items for a class', () => {
    const repo = createTestRepository();
    const course = repo.createCourseType({ name: 'Open Water' });
    const otherCourse = repo.createCourseType({ name: 'Rescue Diver' });
    const session = repo.createClassSession({ courseTypeId: course.id, startsOn: '2026-07-12', location: 'Blue Quarry' });
    const globalItem = repo.createChecklistItem({ label: 'Global item' });
    const courseItem = repo.createCourseTypeChecklistItem({ courseTypeId: course.id, label: 'Course item' });
    repo.createCourseTypeChecklistItem({ courseTypeId: otherCourse.id, label: 'Other course item' });

    expect(repo.listChecklistForClassSession(session.id)).toMatchObject([
      { id: globalItem.id, label: 'Global item', scope: 'global', sortOrder: 0 },
      { id: courseItem.id, label: 'Course item', scope: 'course_type', courseTypeId: course.id, sortOrder: 0 }
    ]);
  });

  test('tracks checklist completion per student and class', () => {
    const repo = createTestRepository();
    const course = repo.createCourseType({ name: 'Open Water' });
    const firstClass = repo.createClassSession({ courseTypeId: course.id, startsOn: '2026-07-12', location: 'Blue Quarry' });
    const secondClass = repo.createClassSession({ courseTypeId: course.id, startsOn: '2026-08-12', location: 'Blue Quarry' });
    const maya = repo.createContact({ firstName: 'Maya', lastName: 'Patel', email: 'maya@example.com' });
    const jordan = repo.createContact({ firstName: 'Jordan', lastName: 'Lee', email: 'jordan@example.com' });
    repo.enrollContact(firstClass.id, maya.id);
    repo.enrollContact(firstClass.id, jordan.id);
    repo.enrollContact(secondClass.id, maya.id);
    const item = repo.createChecklistItem({ label: 'Medical form complete' });

    repo.setEnrollmentChecklistCompletion({
      classSessionId: firstClass.id,
      contactId: maya.id,
      itemScope: 'global',
      itemId: item.id,
      completed: true
    });

    expect(repo.listEnrollmentChecklistState(firstClass.id)).toMatchObject([
      { contactId: jordan.id, itemId: item.id, itemScope: 'global', completed: false },
      { contactId: maya.id, itemId: item.id, itemScope: 'global', completed: true }
    ]);
    expect(repo.listEnrollmentChecklistState(secondClass.id)).toMatchObject([
      { contactId: maya.id, itemId: item.id, itemScope: 'global', completed: false }
    ]);
  });

  test('ignores course-type checklist completion for another course type', () => {
    const repo = createTestRepository();
    const openWater = repo.createCourseType({ name: 'Open Water' });
    const rescue = repo.createCourseType({ name: 'Rescue Diver' });
    const session = repo.createClassSession({ courseTypeId: openWater.id, startsOn: '2026-07-12', location: 'Blue Quarry' });
    const contact = repo.createContact({ firstName: 'Maya', lastName: 'Patel', email: 'maya@example.com' });
    repo.enrollContact(session.id, contact.id);
    const rescueOnlyItem = repo.createCourseTypeChecklistItem({ courseTypeId: rescue.id, label: 'Rescue academics complete' });

    repo.setEnrollmentChecklistCompletion({
      classSessionId: session.id,
      contactId: contact.id,
      itemScope: 'course_type',
      itemId: rescueOnlyItem.id,
      completed: true
    });

    expect(repo.listEnrollmentChecklistState(session.id)).toEqual([]);

    repo.updateClassSession(session.id, {
      courseTypeId: rescue.id,
      startsOn: '2026-07-12',
      location: 'Blue Quarry'
    });

    expect(repo.listEnrollmentChecklistState(session.id)).toMatchObject([
      { contactId: contact.id, itemId: rescueOnlyItem.id, itemScope: 'course_type', completed: false }
    ]);
  });

  test('deleting checklist definitions removes completion state', () => {
    const repo = createTestRepository();
    const course = repo.createCourseType({ name: 'Open Water' });
    const session = repo.createClassSession({ courseTypeId: course.id, startsOn: '2026-07-12', location: 'Blue Quarry' });
    const contact = repo.createContact({ firstName: 'Maya', lastName: 'Patel', email: 'maya@example.com' });
    repo.enrollContact(session.id, contact.id);
    const globalItem = repo.createChecklistItem({ label: 'Medical form complete' });
    const courseItem = repo.createCourseTypeChecklistItem({ courseTypeId: course.id, label: 'Academics complete' });
    repo.setEnrollmentChecklistCompletion({
      classSessionId: session.id,
      contactId: contact.id,
      itemScope: 'global',
      itemId: globalItem.id,
      completed: true
    });
    repo.setEnrollmentChecklistCompletion({
      classSessionId: session.id,
      contactId: contact.id,
      itemScope: 'course_type',
      itemId: courseItem.id,
      completed: true
    });

    repo.deleteChecklistItem(globalItem.id);
    repo.deleteCourseTypeChecklistItem(courseItem.id);

    expect(repo.listChecklistForClassSession(session.id)).toEqual([]);
    expect(repo.listEnrollmentChecklistState(session.id)).toEqual([]);
  });
});
