import type { DatabaseSync } from 'node:sqlite';
import { now } from './ids';
import { rowString } from './mappers';
import type { Row } from './types';

export function getSetting(db: DatabaseSync, key: string) {
  const row = db.prepare('select value from settings where key = ?').get(key) as Row | undefined;
  return row ? rowString(row.value) : '';
}

export function setSetting(db: DatabaseSync, key: string, value: string) {
  db.prepare(
    'insert into settings (key, value, updated_at) values (?, ?, ?) on conflict(key) do update set value = excluded.value, updated_at = excluded.updated_at'
  ).run(key, value, now());
}

export function deleteSetting(db: DatabaseSync, key: string) {
  db.prepare('delete from settings where key = ?').run(key);
}

export function listSettingKeysByPrefix(db: DatabaseSync, prefix: string) {
  return db
    .prepare('select key from settings where key like ?')
    .all(`${prefix}%`)
    .map((row) => rowString((row as Row).key));
}

export function stats(db: DatabaseSync) {
  return {
    contacts: count(db, 'contacts'),
    classSessions: count(db, 'class_sessions'),
    templates: count(db, 'templates'),
    campaigns: count(db, 'campaigns'),
    pendingDeliveries: Number(
      (db.prepare("select count(*) as value from campaign_deliveries where status = 'pending'").get() as Row).value
    )
  };
}

function count(db: DatabaseSync, table: string) {
  return Number((db.prepare(`select count(*) as value from ${table}`).get() as Row).value);
}
