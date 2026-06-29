import type { DatabaseSync } from 'node:sqlite';
import { newId, now } from './ids';
import { mapTemplate } from './mappers';
import type { Row, TemplateInput, TemplatePage, TemplatePageInput } from './types';

export function createTemplate(db: DatabaseSync, input: TemplateInput) {
  const id = newId();
  db.prepare('insert into templates (id, name, subject, body, created_at) values (?, ?, ?, ?, ?)')
    .run(id, input.name.trim(), input.subject.trim(), input.body.trim(), now());
  return getTemplate(db, id);
}

export function listTemplates(db: DatabaseSync) {
  return db.prepare('select * from templates order by name').all().map(mapTemplate);
}

export function listTemplatesPage(db: DatabaseSync, input: TemplatePageInput = {}): TemplatePage {
  const limit = Math.min(Math.max(input.limit ?? 25, 1), 100);
  const offset = Math.max(input.offset ?? 0, 0);
  const search = input.search?.trim() ?? '';
  const where: string[] = [];
  const params: Array<string | number> = [];

  if (search) {
    const pattern = `%${search.toLowerCase()}%`;
    where.push('(lower(name) like ? or lower(subject) like ? or lower(body) like ?)');
    params.push(pattern, pattern, pattern);
  }

  const whereSql = where.length ? `where ${where.join(' and ')}` : '';
  const totalRow = db.prepare(`select count(*) as value from templates ${whereSql}`).get(...params) as Row;
  const items = db
    .prepare(
      `select * from templates
       ${whereSql}
       order by name
       limit ? offset ?`
    )
    .all(...params, limit, offset)
    .map((row) => mapTemplate(row as Row));

  return {
    items,
    total: Number(totalRow.value ?? 0),
    limit,
    offset,
    search
  };
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
    throw new Error('Template is used by an existing scheduled email and cannot be deleted.');
  }
  db.prepare('delete from templates where id = ?').run(id);
}
