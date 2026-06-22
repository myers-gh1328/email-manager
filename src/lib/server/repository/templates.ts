import type { DatabaseSync } from 'node:sqlite';
import { newId, now } from './ids';
import { mapTemplate } from './mappers';
import type { Row, TemplateInput } from './types';

export function createTemplate(db: DatabaseSync, input: TemplateInput) {
  const id = newId();
  db.prepare('insert into templates (id, name, subject, body, created_at) values (?, ?, ?, ?, ?)')
    .run(id, input.name.trim(), input.subject.trim(), input.body.trim(), now());
  return getTemplate(db, id);
}

export function listTemplates(db: DatabaseSync) {
  return db.prepare('select * from templates order by name').all().map(mapTemplate);
}

export function getTemplate(db: DatabaseSync, id: string) {
  const row = db.prepare('select * from templates where id = ?').get(id) as Row | undefined;
  if (!row) throw new Error(`Template not found: ${id}`);
  return mapTemplate(row);
}

export function updateTemplate(db: DatabaseSync, id: string, input: TemplateInput) {
  db.prepare('update templates set name = ?, subject = ?, body = ? where id = ?')
    .run(input.name.trim(), input.subject.trim(), input.body.trim(), id);
  return getTemplate(db, id);
}

export function deleteTemplate(db: DatabaseSync, id: string) {
  const campaignCount = db.prepare('select count(*) as value from campaigns where template_id = ?').get(id) as Row;
  if (Number(campaignCount.value) > 0) {
    throw new Error('Template is used by an existing campaign and cannot be deleted.');
  }
  db.prepare('delete from templates where id = ?').run(id);
}
