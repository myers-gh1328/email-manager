import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomBytes } from 'node:crypto';

const generatedSecretFileName = '.scuba-email-app-secret';

export interface AppSecretStatus {
  configured: boolean;
  source: 'env' | 'generated' | 'missing';
  filePath: string;
}

export function getAppSecret() {
  const configured = process.env.SCUBA_EMAIL_APP_SECRET?.trim();
  if (configured) return configured;

  const path = appSecretFilePath();
  mkdirSync(dirname(path), { recursive: true });
  if (existsSync(path)) return readFileSync(path, 'utf8').trim();

  const generated = randomBytes(32).toString('base64url');
  writeFileSync(path, `${generated}\n`, { mode: 0o600 });
  return generated;
}

export function getAppSecretStatus(): AppSecretStatus {
  if (process.env.SCUBA_EMAIL_APP_SECRET?.trim()) {
    return { configured: true, source: 'env', filePath: appSecretFilePath() };
  }
  const path = appSecretFilePath();
  return {
    configured: existsSync(path),
    source: existsSync(path) ? 'generated' : 'missing',
    filePath: path
  };
}

function appSecretFilePath() {
  return process.env.SCUBA_EMAIL_APP_SECRET_FILE ?? join(dataDir(), generatedSecretFileName);
}

function dataDir() {
  const isAgentDev = process.env.npm_lifecycle_event === 'dev:agent' || process.env.npm_lifecycle_event === 'dev:agent:seed';
  return process.env.SCUBA_EMAIL_DATA_DIR ?? join(process.cwd(), isAgentDev ? '.agent-dev/data' : 'data');
}
