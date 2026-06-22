import type { DatabaseSync } from 'node:sqlite';
import { now } from './ids';
import type { CourseTypeDefaultTemplateInput, Row } from './types';

export function setCourseTypeDefaultTemplate(db: DatabaseSync, input: CourseTypeDefaultTemplateInput) {
  db.prepare(
    `insert into course_type_default_templates (
      course_type_id, purpose, label, template_id, sort_order, send_offset_minutes, created_at
    ) values (?, ?, ?, ?, ?, ?, ?)
    on conflict(course_type_id, purpose, label)
    do update set template_id = excluded.template_id, sort_order = excluded.sort_order, send_offset_minutes = excluded.send_offset_minutes`
  ).run(input.courseTypeId, input.purpose, input.label?.trim() ?? '', input.templateId, input.sortOrder ?? 0, input.sendOffsetMinutes ?? 0, now());
}

export function removeCourseTypeDefaultTemplate(db: DatabaseSync, input: { courseTypeId: string; purpose: string; label?: string }) {
  db.prepare('delete from course_type_default_templates where course_type_id = ? and purpose = ? and label = ?')
    .run(input.courseTypeId, input.purpose, input.label?.trim() ?? '');
}

export function listCourseTypeDefaultTemplates(db: DatabaseSync, courseTypeId: string) {
  return db
    .prepare(
      `select cdt.*, t.name as template_name
       from course_type_default_templates cdt
       join templates t on t.id = cdt.template_id
       where cdt.course_type_id = ?
       order by cdt.sort_order, cdt.purpose, cdt.label`
    )
    .all(courseTypeId)
    .map(mapDefaultTemplate);
}

export function listDefaultTemplatesForClassSession(db: DatabaseSync, classSessionId: string) {
  return db
    .prepare(
      `select cdt.*, t.name as template_name
       from class_sessions cs
       join course_type_default_templates cdt on cdt.course_type_id = cs.course_type_id
       join templates t on t.id = cdt.template_id
       where cs.id = ?
       order by cdt.sort_order, cdt.purpose, cdt.label`
    )
    .all(classSessionId)
    .map(mapDefaultTemplate);
}

function mapDefaultTemplate(row: Row) {
  return {
    courseTypeId: String(row.course_type_id),
    purpose: String(row.purpose),
    label: String(row.label ?? ''),
    templateId: String(row.template_id),
    templateName: String(row.template_name),
    sortOrder: Number(row.sort_order ?? 0),
    sendOffsetMinutes: Number(row.send_offset_minutes ?? 0)
  };
}
