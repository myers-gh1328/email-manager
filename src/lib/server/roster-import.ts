import type { AppSettings } from './settings';
import { formatPhoneNumber } from '../shared/phone';

export interface RosterImportRow {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  notes?: string;
}

export interface RosterImportRepository {
  createContact(input: RosterImportRow): { id: string; email: string };
  findContactsByEmails(emails: string[]): Array<{ id: string; email: string }>;
  enrollContact(classSessionId: string, contactId: string): unknown;
}

export interface RosterImportResult {
  created: number;
  reused: number;
  skipped: number;
  enrolled: number;
}

type VisionExtractor = (imageDataUrl: string) => Promise<RosterImportRow[]>;

const columnAliases: Record<keyof RosterImportRow, string[]> = {
  firstName: ['first name', 'firstname', 'first', 'given name', 'student first'],
  lastName: ['last name', 'lastname', 'last', 'surname', 'family name', 'student last'],
  email: ['email', 'email address', 'e-mail', 'student email'],
  phone: ['phone', 'phone number', 'mobile', 'cell'],
  notes: ['notes', 'note', 'comments', 'comment']
};

export function parseRosterCsv(csv: string): RosterImportRow[] {
  const rows = parseCsv(csv).filter((row) => row.some((cell) => cell.trim()));
  const [headers, ...records] = rows;
  if (!headers?.length) return [];

  const indexes = Object.fromEntries(
    Object.entries(columnAliases).map(([key, aliases]) => [
      key,
      headers.findIndex((header) => aliases.includes(normalizeHeader(header)))
    ])
  ) as Record<keyof RosterImportRow, number>;

  return records.map((record) => ({
    firstName: valueAt(record, indexes.firstName),
    lastName: valueAt(record, indexes.lastName),
    email: valueAt(record, indexes.email).toLowerCase(),
    phone: formatPhoneNumber(valueAt(record, indexes.phone)),
    notes: valueAt(record, indexes.notes)
  }));
}

export function importRosterRows(
  repo: RosterImportRepository,
  classSessionId: string,
  rows: RosterImportRow[]
): RosterImportResult {
  const result = importContactRows(repo, rows);
  const contactIds = [...new Set(result.contactIds)];
  for (const contactId of contactIds) {
    repo.enrollContact(classSessionId, contactId);
  }

  return {
    created: result.created,
    reused: result.reused,
    skipped: result.skipped,
    enrolled: contactIds.length
  };
}

export function importContactRows(
  repo: Pick<RosterImportRepository, 'createContact' | 'findContactsByEmails'>,
  rows: RosterImportRow[]
): RosterImportResult & { contactIds: string[] } {
  let created = 0;
  let reused = 0;
  let skipped = 0;
  const contactIds: string[] = [];
  const importedEmails = rows.map((row) => row.email);
  const contactsByEmail = new Map(repo.findContactsByEmails(importedEmails).map((contact) => [contact.email.toLowerCase(), contact]));

  for (const row of rows) {
    if (!row.firstName.trim() || !row.lastName.trim() || !row.email.trim()) {
      skipped += 1;
      continue;
    }

    const email = row.email.trim().toLowerCase();
    let contact = contactsByEmail.get(email);
    if (contact) {
      reused += 1;
    } else {
      contact = repo.createContact({ ...row, email, phone: formatPhoneNumber(row.phone) });
      contactsByEmail.set(email, contact);
      created += 1;
    }
    contactIds.push(contact.id);
  }

  return { created, reused, skipped, enrolled: 0, contactIds };
}

export async function extractRosterRowsFromImage(
  settings: Pick<AppSettings, 'aiEnabled' | 'aiVisionEnabled' | 'aiBaseUrl' | 'aiModel' | 'aiApiKeyConfigured'>,
  extractor: VisionExtractor,
  imageDataUrl: string
) {
  if (!settings.aiEnabled || !settings.aiVisionEnabled || !settings.aiBaseUrl || !settings.aiModel) {
    throw new Error('Enable a vision-capable AI model before importing screenshots.');
  }
  return extractor(imageDataUrl);
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[_-]/g, ' ');
}

function valueAt(record: string[], index: number) {
  return index >= 0 ? (record[index] ?? '').trim() : '';
}

function parseCsv(input: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    const next = input[i + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  row.push(cell);
  rows.push(row);
  return rows;
}
