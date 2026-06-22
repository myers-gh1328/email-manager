import { join } from 'node:path';
import { AppRepository } from './repository';

export const isAgentDev = process.env.npm_lifecycle_event === 'dev:agent' || process.env.npm_lifecycle_event === 'dev:agent:seed';

const dataDir = process.env.SCUBA_EMAIL_DATA_DIR ?? join(process.cwd(), isAgentDev ? '.agent-dev/data' : 'data');
const dbPath = process.env.SCUBA_EMAIL_DB ?? join(dataDir, 'scuba-email.sqlite');

export const repo = new AppRepository(dbPath);

export const isDev = process.env.NODE_ENV !== 'production';
