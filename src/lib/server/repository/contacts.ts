import type { DatabaseSync } from 'node:sqlite';
import { newId, now } from './ids';
import { mapClassSession, mapContact, mapCourseType, mapLocation, rowString } from './mappers';
import type {
  ClassSessionInput,
  ClassSessionPage,
  ClassSessionPageInput,
  ContactHistoryItem,
  ContactInput,
  ContactPage,
  ContactPageInput,
  CourseTypeInput,
  CourseTypePage,
  CourseTypePageInput,
  DuplicateClassSessionMatch,
  DuplicateContactMatch,
  LocationInput,
  LocationPage,
  LocationPageInput,
  Row
} from './types';

export function createContact(db: DatabaseSync, input: ContactInput) {
  assertNoDuplicateContact(db, input);
  const id = newId();
  const email = normalizeEmail(input.email);
  db.prepare(
    `insert into contacts (id, first_name, last_name, email, phone, notes, do_not_email, created_at)
     values (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.firstName.trim(),
    input.lastName.trim(),
    email,
    input.phone?.trim() ?? '',
    input.notes?.trim() ?? '',
    input.doNotEmail ? 1 : 0,
    now()
  );
  return getContact(db, id);
}

export function listContacts(db: DatabaseSync) {
  return db
    .prepare('select * from contacts order by last_name, first_name')
    .all()
    .map(mapContact);
}

export function listContactsPage(db: DatabaseSync, input: ContactPageInput = {}): ContactPage {
  const limit = Math.min(Math.max(input.limit ?? 25, 1), 100);
  const offset = Math.max(input.offset ?? 0, 0);
  const search = input.search?.trim() ?? '';
  const where: string[] = [];
  const params: Array<string | number> = [];

  if (search) {
    const pattern = `%${search.toLowerCase()}%`;
    where.push(
      `(lower(first_name || ' ' || last_name) like ?
        or lower(email) like ?
        or lower(phone) like ?)`
    );
    params.push(pattern, pattern, pattern);
  }

  const whereSql = where.length ? `where ${where.join(' and ')}` : '';
  const totalRow = db.prepare(`select count(*) as value from contacts ${whereSql}`).get(...params) as Row;
  const items = db
    .prepare(
      `select * from contacts
       ${whereSql}
       order by last_name, first_name
       limit ? offset ?`
    )
    .all(...params, limit, offset)
    .map((row) => mapContact(row as Row));

  return {
    items,
    total: Number(totalRow.value ?? 0),
    limit,
    offset,
    search
  };
}

export function findDuplicateContact(db: DatabaseSync, input: Pick<ContactInput, 'email'>, excludeId?: string): DuplicateContactMatch | undefined {
  const email = normalizeEmail(input.email);
  if (!email) return undefined;
  const row = db
    .prepare(
      `select id, email
       from contacts
       where lower(trim(email)) = ?
         and (? is null or id != ?)
       order by created_at
       limit 1`
    )
    .get(email, excludeId ?? null, excludeId ?? null) as Row | undefined;
  return row ? { id: rowString(row.id), email: rowString(row.email) } : undefined;
}

export function getContact(db: DatabaseSync, id: string) {
  const row = db.prepare('select * from contacts where id = ?').get(id) as Row | undefined;
  if (!row) throw new Error(`Contact not found: ${id}`);
  return mapContact(row);
}

export function updateContact(db: DatabaseSync, id: string, input: ContactInput) {
  assertNoDuplicateContact(db, input, id);
  const email = normalizeEmail(input.email);
  db.prepare(
    `update contacts
     set first_name = ?, last_name = ?, email = ?, phone = ?, notes = ?, do_not_email = ?
     where id = ?`
  ).run(
    input.firstName.trim(),
    input.lastName.trim(),
    email,
    input.phone?.trim() ?? '',
    input.notes?.trim() ?? '',
    input.doNotEmail ? 1 : 0,
    id
  );
  return getContact(db, id);
}

export function deleteContact(db: DatabaseSync, id: string) {
  db.prepare('delete from contacts where id = ?').run(id);
}

export function createCourseType(db: DatabaseSync, input: CourseTypeInput) {
  const id = newId();
  db.prepare('insert into course_types (id, name, description, created_at) values (?, ?, ?, ?)')
    .run(id, input.name.trim(), input.description?.trim() ?? '', now());
  return getCourseType(db, id);
}

export function listCourseTypes(db: DatabaseSync) {
  return db
    .prepare('select * from course_types order by name')
    .all()
    .map(mapCourseType);
}

export function listCourseTypesPage(db: DatabaseSync, input: CourseTypePageInput = {}): CourseTypePage {
  const limit = Math.min(Math.max(input.limit ?? 25, 1), 100);
  const offset = Math.max(input.offset ?? 0, 0);
  const search = input.search?.trim() ?? '';
  const where: string[] = [];
  const params: Array<string | number> = [];

  if (search) {
    const pattern = `%${search.toLowerCase()}%`;
    where.push('(lower(name) like ? or lower(description) like ?)');
    params.push(pattern, pattern);
  }

  const whereSql = where.length ? `where ${where.join(' and ')}` : '';
  const totalRow = db.prepare(`select count(*) as value from course_types ${whereSql}`).get(...params) as Row;
  const items = db
    .prepare(
      `select * from course_types
       ${whereSql}
       order by name
       limit ? offset ?`
    )
    .all(...params, limit, offset)
    .map((row) => mapCourseType(row as Row));

  return {
    items,
    total: Number(totalRow.value ?? 0),
    limit,
    offset,
    search
  };
}

export function getCourseType(db: DatabaseSync, id: string) {
  const row = db.prepare('select * from course_types where id = ?').get(id) as Row | undefined;
  if (!row) throw new Error(`Course type not found: ${id}`);
  return mapCourseType(row);
}

export function updateCourseType(db: DatabaseSync, id: string, input: CourseTypeInput) {
  db.prepare('update course_types set name = ?, description = ? where id = ?')
    .run(input.name.trim(), input.description?.trim() ?? '', id);
  return getCourseType(db, id);
}

export function createLocation(db: DatabaseSync, input: LocationInput) {
  const id = newId();
  db.prepare(
    `insert into locations (
      id, name, address, phone, website, parking_notes, meeting_instructions, notes, created_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.name.trim(),
    input.address?.trim() ?? '',
    input.phone?.trim() ?? '',
    input.website?.trim() ?? '',
    input.parkingNotes?.trim() ?? '',
    input.meetingInstructions?.trim() ?? '',
    input.notes?.trim() ?? '',
    now()
  );
  return getLocation(db, id);
}

export function updateLocation(db: DatabaseSync, id: string, input: LocationInput) {
  db.prepare(
    `update locations
     set name = ?, address = ?, phone = ?, website = ?, parking_notes = ?, meeting_instructions = ?, notes = ?
     where id = ?`
  ).run(
    input.name.trim(),
    input.address?.trim() ?? '',
    input.phone?.trim() ?? '',
    input.website?.trim() ?? '',
    input.parkingNotes?.trim() ?? '',
    input.meetingInstructions?.trim() ?? '',
    input.notes?.trim() ?? '',
    id
  );
  return getLocation(db, id);
}

export function listLocations(db: DatabaseSync) {
  return db.prepare('select * from locations order by name').all().map(mapLocation);
}

export function listLocationsPage(db: DatabaseSync, input: LocationPageInput = {}): LocationPage {
  const limit = Math.min(Math.max(input.limit ?? 25, 1), 100);
  const offset = Math.max(input.offset ?? 0, 0);
  const search = input.search?.trim() ?? '';
  const where: string[] = [];
  const params: Array<string | number> = [];

  if (search) {
    const pattern = `%${search.toLowerCase()}%`;
    where.push(
      `(lower(name) like ?
        or lower(address) like ?
        or lower(phone) like ?
        or lower(website) like ?)`
    );
    params.push(pattern, pattern, pattern, pattern);
  }

  const whereSql = where.length ? `where ${where.join(' and ')}` : '';
  const totalRow = db.prepare(`select count(*) as value from locations ${whereSql}`).get(...params) as Row;
  const items = db
    .prepare(
      `select * from locations
       ${whereSql}
       order by name
       limit ? offset ?`
    )
    .all(...params, limit, offset)
    .map((row) => mapLocation(row as Row));

  return {
    items,
    total: Number(totalRow.value ?? 0),
    limit,
    offset,
    search
  };
}

export function getLocation(db: DatabaseSync, id: string) {
  const row = db.prepare('select * from locations where id = ?').get(id) as Row | undefined;
  if (!row) throw new Error(`Location not found: ${id}`);
  return mapLocation(row);
}

export function createClassSession(db: DatabaseSync, input: ClassSessionInput) {
  assertNoDuplicateClassSession(db, input);
  const id = newId();
  const startsOn = input.startsOn.trim();
  const endsOn = input.endsOn?.trim() || startsOn;
  const startTime = input.startTime?.trim() ?? '';
  const location = input.location.trim();
  db.prepare(
    `insert into class_sessions (id, course_type_id, starts_on, ends_on, start_time, location, notes, created_at)
     values (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, input.courseTypeId, startsOn, endsOn, startTime, location, input.notes?.trim() ?? '', now());
  if (input.locationId) db.prepare('update class_sessions set location_id = ? where id = ?').run(input.locationId, id);
  return getClassSession(db, id);
}

export function updateClassSession(db: DatabaseSync, id: string, input: ClassSessionInput) {
  assertNoDuplicateClassSession(db, input, id);
  const startsOn = input.startsOn.trim();
  const endsOn = input.endsOn?.trim() || startsOn;
  db.prepare(
    `update class_sessions
     set course_type_id = ?, location_id = ?, starts_on = ?, ends_on = ?, start_time = ?, location = ?, notes = ?
     where id = ?`
  ).run(input.courseTypeId, input.locationId || null, startsOn, endsOn, input.startTime?.trim() ?? '', input.location.trim(), input.notes?.trim() ?? '', id);
  return getClassSession(db, id);
}

export function findDuplicateClassSession(
  db: DatabaseSync,
  input: ClassSessionInput,
  excludeId?: string
): DuplicateClassSessionMatch | undefined {
  const startsOn = input.startsOn.trim();
  const startTime = input.startTime?.trim() ?? '';
  const locationId = input.locationId?.trim() ?? '';
  const location = input.location.trim();
  const row = locationId
    ? db
        .prepare(
          `select id, course_type_id, starts_on, start_time, location_id, location
           from class_sessions
           where course_type_id = ?
             and starts_on = ?
             and start_time = ?
             and location_id = ?
             and (? is null or id != ?)
           order by created_at
           limit 1`
        )
        .get(input.courseTypeId, startsOn, startTime, locationId, excludeId ?? null, excludeId ?? null)
    : db
        .prepare(
          `select id, course_type_id, starts_on, start_time, location_id, location
           from class_sessions
           where course_type_id = ?
             and starts_on = ?
             and start_time = ?
             and coalesce(location_id, '') = ''
             and lower(trim(location)) = ?
             and (? is null or id != ?)
           order by created_at
           limit 1`
        )
        .get(input.courseTypeId, startsOn, startTime, normalizeLocation(location), excludeId ?? null, excludeId ?? null);
  return row
    ? {
        id: rowString((row as Row).id),
        courseTypeId: rowString((row as Row).course_type_id),
        startsOn: rowString((row as Row).starts_on),
        startTime: rowString((row as Row).start_time),
        locationId: rowString((row as Row).location_id),
        location: rowString((row as Row).location)
      }
    : undefined;
}

export function listClassSessions(db: DatabaseSync) {
  return db
    .prepare(
      `select cs.*, ct.name as course_name,
        l.name as location_name,
        l.address as location_address,
        l.phone as location_phone,
        l.website as location_website,
        l.parking_notes as location_parking_notes,
        l.meeting_instructions as location_meeting_instructions,
        l.notes as location_notes
       from class_sessions cs
       join course_types ct on ct.id = cs.course_type_id
       left join locations l on l.id = cs.location_id
       order by cs.starts_on desc`
    )
    .all()
    .map(mapClassSession);
}

export function listClassSessionsForCourseType(db: DatabaseSync, courseTypeId: string) {
  return db
    .prepare(
      `select cs.*, ct.name as course_name,
        l.name as location_name,
        l.address as location_address,
        l.phone as location_phone,
        l.website as location_website,
        l.parking_notes as location_parking_notes,
        l.meeting_instructions as location_meeting_instructions,
        l.notes as location_notes
       from class_sessions cs
       join course_types ct on ct.id = cs.course_type_id
       left join locations l on l.id = cs.location_id
       where cs.course_type_id = ?
       order by cs.starts_on desc`
    )
    .all(courseTypeId)
    .map((row) => mapClassSession(row as Row));
}

export function listClassSessionsPage(db: DatabaseSync, input: ClassSessionPageInput = {}): ClassSessionPage {
  const limit = Math.min(Math.max(input.limit ?? 25, 1), 100);
  const offset = Math.max(input.offset ?? 0, 0);
  const search = input.search?.trim() ?? '';
  const where: string[] = [];
  const params: Array<string | number> = [];

  if (search) {
    const pattern = `%${search.toLowerCase()}%`;
    where.push(
      `(lower(ct.name) like ?
        or lower(coalesce(l.name, cs.location)) like ?
        or lower(cs.starts_on) like ?
        or lower(cs.ends_on) like ?)`
    );
    params.push(pattern, pattern, pattern, pattern);
  }

  const fromSql = `
    from class_sessions cs
    join course_types ct on ct.id = cs.course_type_id
    left join locations l on l.id = cs.location_id
  `;
  const whereSql = where.length ? `where ${where.join(' and ')}` : '';
  const totalRow = db.prepare(`select count(*) as value ${fromSql} ${whereSql}`).get(...params) as Row;
  const items = db
    .prepare(
      `select cs.*, ct.name as course_name,
        l.name as location_name,
        l.address as location_address,
        l.phone as location_phone,
        l.website as location_website,
        l.parking_notes as location_parking_notes,
        l.meeting_instructions as location_meeting_instructions,
        l.notes as location_notes
       ${fromSql}
       ${whereSql}
       order by cs.starts_on desc
       limit ? offset ?`
    )
    .all(...params, limit, offset)
    .map((row) => mapClassSession(row as Row));

  return {
    items,
    total: Number(totalRow.value ?? 0),
    limit,
    offset,
    search
  };
}

export function getClassSession(db: DatabaseSync, id: string) {
  const row = db
    .prepare(
      `select cs.*, ct.name as course_name,
        l.name as location_name,
        l.address as location_address,
        l.phone as location_phone,
        l.website as location_website,
        l.parking_notes as location_parking_notes,
        l.meeting_instructions as location_meeting_instructions,
        l.notes as location_notes
       from class_sessions cs
       join course_types ct on ct.id = cs.course_type_id
       left join locations l on l.id = cs.location_id
       where cs.id = ?`
    )
    .get(id) as Row | undefined;
  if (!row) throw new Error(`Class session not found: ${id}`);
  return mapClassSession(row);
}

export function enrollContact(db: DatabaseSync, classSessionId: string, contactId: string) {
  db.prepare('insert or ignore into enrollments (class_session_id, contact_id, created_at) values (?, ?, ?)')
    .run(classSessionId, contactId, now());
}

export function unenrollContact(db: DatabaseSync, classSessionId: string, contactId: string) {
  db.prepare('delete from enrollments where class_session_id = ? and contact_id = ?').run(classSessionId, contactId);
}

export function listEnrollments(db: DatabaseSync, classSessionId: string) {
  return db
    .prepare(
      `select c.*
       from contacts c
       join enrollments e on e.contact_id = c.id
       where e.class_session_id = ?
       order by c.last_name, c.first_name`
    )
    .all(classSessionId)
    .map(mapContact);
}

export function getClassSessionDetail(db: DatabaseSync, classSessionId: string, rosterPageInput: { limit?: number; offset?: number; search?: string } = {}) {
  const rosterPage = listEnrollmentsPage(db, classSessionId, rosterPageInput);
  return {
    session: getClassSession(db, classSessionId),
    roster: rosterPage.items,
    rosterPage
  };
}

function listEnrollmentsPage(db: DatabaseSync, classSessionId: string, input: { limit?: number; offset?: number; search?: string } = {}) {
  const limit = Math.min(Math.max(input.limit ?? 25, 1), 100);
  const offset = Math.max(input.offset ?? 0, 0);
  const search = input.search?.trim() ?? '';
  const where: string[] = ['e.class_session_id = ?'];
  const params: Array<string | number> = [classSessionId];

  if (search) {
    const pattern = `%${search.toLowerCase()}%`;
    where.push('(lower(c.first_name || \' \' || c.last_name) like ? or lower(c.email) like ? or lower(c.phone) like ?)');
    params.push(pattern, pattern, pattern);
  }

  const whereSql = `where ${where.join(' and ')}`;
  const fromSql = `
    from contacts c
    join enrollments e on e.contact_id = c.id
  `;
  const totalRow = db.prepare(`select count(*) as value ${fromSql} ${whereSql}`).get(...params) as Row;
  const items = db
    .prepare(
      `select c.*
       ${fromSql}
       ${whereSql}
       order by c.last_name, c.first_name
       limit ? offset ?`
    )
    .all(...params, limit, offset)
    .map((row) => mapContact(row as Row));

  return {
    items,
    total: Number(totalRow.value ?? 0),
    limit,
    offset,
    search
  };
}

export function getContactHistory(db: DatabaseSync, contactId: string): ContactHistoryItem[] {
  return db
    .prepare(
      `select cs.id as class_session_id, ct.name as course_name, cs.starts_on, cs.ends_on, cs.start_time,
        coalesce(l.name, cs.location) as location, l.address as location_address, l.phone as location_phone,
        l.website as location_website, l.parking_notes as location_parking_notes,
        l.meeting_instructions as location_meeting_instructions, l.notes as location_notes
       from enrollments e
       join class_sessions cs on cs.id = e.class_session_id
       join course_types ct on ct.id = cs.course_type_id
       left join locations l on l.id = cs.location_id
       where e.contact_id = ?
       order by cs.starts_on desc`
    )
    .all(contactId)
    .map((row) => ({
      classSessionId: rowString((row as Row).class_session_id),
      courseName: rowString((row as Row).course_name),
      startsOn: rowString((row as Row).starts_on),
      endsOn: rowString((row as Row).ends_on || (row as Row).starts_on),
      startTime: rowString((row as Row).start_time),
      location: rowString((row as Row).location),
      locationAddress: rowString((row as Row).location_address),
      locationPhone: rowString((row as Row).location_phone),
      locationWebsite: rowString((row as Row).location_website),
      locationParkingNotes: rowString((row as Row).location_parking_notes),
      locationMeetingInstructions: rowString((row as Row).location_meeting_instructions),
      locationNotes: rowString((row as Row).location_notes)
    }));
}

function assertNoDuplicateContact(db: DatabaseSync, input: ContactInput, excludeId?: string) {
  const duplicate = findDuplicateContact(db, input, excludeId);
  if (duplicate) throw new Error(`Duplicate contact email: ${duplicate.email}`);
}

function assertNoDuplicateClassSession(db: DatabaseSync, input: ClassSessionInput, excludeId?: string) {
  const duplicate = findDuplicateClassSession(db, input, excludeId);
  if (duplicate) throw new Error(`Duplicate class session: ${duplicate.id}`);
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeLocation(location: string) {
  return location.trim().toLowerCase();
}
