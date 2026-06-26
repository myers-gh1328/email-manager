import type { DatabaseSync } from 'node:sqlite';
import { newId, now } from './ids';
import { rowString } from './mappers';
import type {
  ChecklistItem,
  ChecklistItemInput,
  ChecklistItemPage,
  ChecklistItemPageInput,
  ChecklistItemScope,
  CourseTypeChecklistItemInput,
  EnrollmentChecklistCompletionInput,
  EnrollmentChecklistState,
  Row
} from './types';

export function createChecklistItem(db: DatabaseSync, input: ChecklistItemInput) {
  const id = newId();
  db.prepare('insert into checklist_items (id, label, sort_order, created_at) values (?, ?, ?, ?)')
    .run(id, input.label.trim(), nextGlobalSortOrder(db), now());
  return getChecklistItem(db, id);
}

export function updateChecklistItem(db: DatabaseSync, id: string, input: ChecklistItemInput) {
  db.prepare('update checklist_items set label = ? where id = ?').run(input.label.trim(), id);
  return getChecklistItem(db, id);
}

export function deleteChecklistItem(db: DatabaseSync, id: string) {
  db.prepare("delete from enrollment_checklist_completions where item_scope = 'global' and item_id = ?").run(id);
  db.prepare('delete from checklist_items where id = ?').run(id);
}

export function listChecklistItems(db: DatabaseSync): ChecklistItem[] {
  return db.prepare('select * from checklist_items order by sort_order, created_at, label').all().map(mapGlobalChecklistItem);
}

export function listChecklistItemsPage(db: DatabaseSync, input: ChecklistItemPageInput = {}): ChecklistItemPage {
  const limit = Math.min(Math.max(input.limit ?? 25, 1), 100);
  const offset = Math.max(input.offset ?? 0, 0);
  const search = input.search?.trim() ?? '';
  const where: string[] = [];
  const params: Array<string | number> = [];

  if (search) {
    const pattern = `%${search.toLowerCase()}%`;
    where.push('lower(label) like ?');
    params.push(pattern);
  }

  const whereSql = where.length ? `where ${where.join(' and ')}` : '';
  const totalRow = db.prepare(`select count(*) as value from checklist_items ${whereSql}`).get(...params) as Row;
  const items = db
    .prepare(
      `select * from checklist_items
       ${whereSql}
       order by sort_order, created_at, label
       limit ? offset ?`
    )
    .all(...params, limit, offset)
    .map((row) => mapGlobalChecklistItem(row as Row));

  return {
    items,
    total: Number(totalRow.value ?? 0),
    limit,
    offset,
    search
  };
}

export function createCourseTypeChecklistItem(db: DatabaseSync, input: CourseTypeChecklistItemInput) {
  const id = newId();
  db.prepare('insert into course_type_checklist_items (id, course_type_id, label, sort_order, created_at) values (?, ?, ?, ?, ?)')
    .run(id, input.courseTypeId, input.label.trim(), nextCourseTypeSortOrder(db, input.courseTypeId), now());
  return getCourseTypeChecklistItem(db, id);
}

export function updateCourseTypeChecklistItem(db: DatabaseSync, id: string, input: ChecklistItemInput) {
  db.prepare('update course_type_checklist_items set label = ? where id = ?').run(input.label.trim(), id);
  return getCourseTypeChecklistItem(db, id);
}

export function deleteCourseTypeChecklistItem(db: DatabaseSync, id: string) {
  db.prepare("delete from enrollment_checklist_completions where item_scope = 'course_type' and item_id = ?").run(id);
  db.prepare('delete from course_type_checklist_items where id = ?').run(id);
}

export function listCourseTypeChecklistItems(db: DatabaseSync, courseTypeId: string): ChecklistItem[] {
  return db
    .prepare('select * from course_type_checklist_items where course_type_id = ? order by sort_order, created_at, label')
    .all(courseTypeId)
    .map(mapCourseTypeChecklistItem);
}

export function listChecklistForClassSession(db: DatabaseSync, classSessionId: string): ChecklistItem[] {
  const courseRow = db.prepare('select course_type_id from class_sessions where id = ?').get(classSessionId) as Row | undefined;
  if (!courseRow) throw new Error(`Class session not found: ${classSessionId}`);
  return [...listChecklistItems(db), ...listCourseTypeChecklistItems(db, rowString(courseRow.course_type_id))];
}

export function listEnrollmentChecklistState(db: DatabaseSync, classSessionId: string, contactIds: string[] = []): EnrollmentChecklistState[] {
  const items = listChecklistForClassSession(db, classSessionId);
  if (items.length === 0) return [];
  const scopedContactIds = [...new Set(contactIds.map((id) => id.trim()).filter(Boolean))];
  const contactWhere = scopedContactIds.length ? `and c.id in (${scopedContactIds.map(() => '?').join(', ')})` : '';

  const roster = db
    .prepare(
      `select c.id, c.first_name, c.last_name, c.email
       from contacts c
       join enrollments e on e.contact_id = c.id
       where e.class_session_id = ?
         ${contactWhere}
       order by c.last_name, c.first_name`
    )
    .all(classSessionId, ...scopedContactIds) as Row[];
  if (roster.length === 0) return [];
  const completionWhere = scopedContactIds.length ? `and contact_id in (${scopedContactIds.map(() => '?').join(', ')})` : '';
  const completionRows = db
    .prepare(`select contact_id, item_scope, item_id from enrollment_checklist_completions where class_session_id = ? ${completionWhere}`)
    .all(classSessionId, ...scopedContactIds) as Row[];
  const completed = new Set(
    completionRows.map((row) => completionKey(rowString(row.contact_id), rowString(row.item_scope), rowString(row.item_id)))
  );

  return roster.flatMap((contact) =>
    items.map((item) => ({
      classSessionId,
      contactId: rowString(contact.id),
      contactName: `${contact.first_name} ${contact.last_name}`,
      contactEmail: rowString(contact.email),
      itemScope: item.scope,
      itemId: item.id,
      label: item.label,
      sortOrder: item.sortOrder,
      completed: completed.has(completionKey(rowString(contact.id), item.scope, item.id))
    }))
  );
}

export function setEnrollmentChecklistCompletion(db: DatabaseSync, input: EnrollmentChecklistCompletionInput) {
  if (!input.completed || !checklistItemAppliesToClass(db, input.classSessionId, input.itemScope, input.itemId)) {
    db.prepare('delete from enrollment_checklist_completions where class_session_id = ? and contact_id = ? and item_scope = ? and item_id = ?')
      .run(input.classSessionId, input.contactId, input.itemScope, input.itemId);
    return;
  }

  db.prepare(
    `insert into enrollment_checklist_completions (class_session_id, contact_id, item_scope, item_id, completed_at)
     values (?, ?, ?, ?, ?)
     on conflict(class_session_id, contact_id, item_scope, item_id) do update set completed_at = excluded.completed_at`
  ).run(input.classSessionId, input.contactId, input.itemScope, input.itemId, now());
}

function getChecklistItem(db: DatabaseSync, id: string) {
  const row = db.prepare('select * from checklist_items where id = ?').get(id) as Row | undefined;
  if (!row) throw new Error(`Checklist item not found: ${id}`);
  return mapGlobalChecklistItem(row);
}

function getCourseTypeChecklistItem(db: DatabaseSync, id: string) {
  const row = db.prepare('select * from course_type_checklist_items where id = ?').get(id) as Row | undefined;
  if (!row) throw new Error(`Course type checklist item not found: ${id}`);
  return mapCourseTypeChecklistItem(row);
}

function nextGlobalSortOrder(db: DatabaseSync) {
  const row = db.prepare('select coalesce(max(sort_order), -1) + 1 as next_sort_order from checklist_items').get() as Row;
  return Number(row.next_sort_order);
}

function nextCourseTypeSortOrder(db: DatabaseSync, courseTypeId: string) {
  const row = db
    .prepare('select coalesce(max(sort_order), -1) + 1 as next_sort_order from course_type_checklist_items where course_type_id = ?')
    .get(courseTypeId) as Row;
  return Number(row.next_sort_order);
}

function checklistItemAppliesToClass(db: DatabaseSync, classSessionId: string, scope: ChecklistItemScope, itemId: string) {
  if (scope === 'global') {
    return Boolean(db.prepare('select id from checklist_items where id = ?').get(itemId));
  }
  return Boolean(
    db
      .prepare(
        `select cti.id
         from course_type_checklist_items cti
         join class_sessions cs on cs.course_type_id = cti.course_type_id
         where cs.id = ? and cti.id = ?`
      )
      .get(classSessionId, itemId)
  );
}

function completionKey(contactId: string, itemScope: string, itemId: string) {
  return `${contactId}:${itemScope}:${itemId}`;
}

function mapGlobalChecklistItem(row: Row): ChecklistItem {
  return {
    id: rowString(row.id),
    label: rowString(row.label),
    scope: 'global',
    sortOrder: Number(row.sort_order),
    createdAt: rowString(row.created_at)
  };
}

function mapCourseTypeChecklistItem(row: Row): ChecklistItem {
  return {
    id: rowString(row.id),
    courseTypeId: rowString(row.course_type_id),
    label: rowString(row.label),
    scope: 'course_type',
    sortOrder: Number(row.sort_order),
    createdAt: rowString(row.created_at)
  };
}
