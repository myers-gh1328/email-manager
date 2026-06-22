import { spawnSync } from 'node:child_process';

const commands = [
  ['git', ['diff', '--check']],
  ['npm', ['test']],
  ['npm', ['run', 'check']],
  ['npm', ['run', 'mcp:build']],
  ['npm', ['run', 'mcp:smoke']],
  ['npm', ['run', 'build']]
];

for (const [command, args] of commands) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}
