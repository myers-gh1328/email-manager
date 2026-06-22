import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AppRepository } from '../src/lib/server/repository';

export function createTestRepository() {
  return new AppRepository(join(mkdtempSync(join(tmpdir(), 'scuba-email-')), 'app.sqlite'));
}
