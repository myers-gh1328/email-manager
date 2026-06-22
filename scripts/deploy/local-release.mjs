import { cpSync, existsSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '../..');
const releaseRoot = resolve(process.env.SCUBA_RELEASE_ROOT ?? join(repoRoot, 'releases', 'local'));
const releaseDir = join(releaseRoot, 'releases', timestamp());
const currentLink = join(releaseRoot, 'current');
const healthUrl = process.env.SCUBA_HEALTH_URL ?? `http://127.0.0.1:${process.env.SCUBA_DEPLOY_PORT ?? '3010'}`;

mkdirSync(releaseDir, { recursive: true });

run('npm', ['run', 'build'], {
  cwd: repoRoot,
  env: { ...process.env, SCUBA_BUILD_OUT: join(releaseDir, 'build') }
});

linkOrCopy(join(repoRoot, 'node_modules'), join(releaseDir, 'node_modules'));
if (existsSync(join(repoRoot, 'data'))) {
  linkOrCopy(join(repoRoot, 'data'), join(releaseDir, 'data'));
}

rmSync(currentLink, { force: true, recursive: true });
linkOrCopy(releaseDir, currentLink, { directoryLink: true });

if (process.env.SCUBA_RESTART_COMMAND) {
  runShell(process.env.SCUBA_RESTART_COMMAND, repoRoot);
} else {
  console.log('No SCUBA_RESTART_COMMAND configured; release built without restarting a service.');
}

if (process.env.SCUBA_SKIP_HEALTH_CHECK === 'true') {
  console.log(`Deployed ${releaseDir}`);
  process.exit(0);
}

const healthy = await waitForHealth(healthUrl, 20);
if (healthy) {
  console.log(`Deployed ${releaseDir}`);
  process.exit(0);
}

console.error(`Release built at ${releaseDir}, but the app did not answer at ${healthUrl}.`);
process.exit(1);

function run(command, args, options) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32', ...options });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function runShell(command, cwd) {
  const result = spawnSync(command, { cwd, stdio: 'inherit', shell: true });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function linkOrCopy(source, target, options = {}) {
  try {
    symlinkSync(source, target, options.directoryLink ? 'junction' : 'dir');
  } catch {
    cpSync(source, target, { recursive: true });
  }
}

async function waitForHealth(url, attempts) {
  for (let index = 0; index < attempts; index += 1) {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      if (response.ok) return true;
    } catch {
      // Retry until the process manager has had a chance to start the app.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  }
  return false;
}

function timestamp() {
  return new Date().toISOString().replaceAll(/[-:TZ.]/g, '').slice(0, 14);
}
