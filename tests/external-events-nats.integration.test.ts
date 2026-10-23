import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { afterEach, test } from 'vitest';
import { jetstream, jetstreamManager } from '@nats-io/jetstream';
import { connect } from '@nats-io/transport-node';
import { runNatsSubscriber } from '../src/lib/server/external-events-nats';
import { createTestRepository } from './repository-helpers';

const subject = 'example.events.contact.upsert';
const stream = 'EXAMPLE';
const consumer = 'example-importer';
const active: Array<{ server: ChildProcess; dir: string }> = [];

async function startServer() {
  const dir = await mkdtemp(path.join(tmpdir(), 'external-events-nats-'));
  const name = `${consumer}-${createHash('sha256').update(subject).digest('hex').slice(0, 12)}`;
  const configPath = path.join(dir, 'nats.conf');
  await writeFile(configPath, `
port: -1
jetstream: { store_dir: "${dir}" }
authorization {
  users: [
    { user: "publisher", password: "test", permissions: {
      publish: ["example.events.>", "$JS.API.>"], subscribe: ["_INBOX.>"]
    } },
    { user: "importer", password: "test", permissions: {
      publish: [
        "$JS.API.CONSUMER.INFO.${stream}.${name}",
        "$JS.API.CONSUMER.CREATE.${stream}.${name}.${subject}",
        "$JS.API.CONSUMER.MSG.NEXT.${stream}.${name}",
        "$JS.ACK.${stream}.${name}.>"
      ], subscribe: ["_INBOX.>"]
    } }
  ]
}
`);
  const server = spawn('nats-server', ['-c', configPath, '--ports_file_dir', dir], {
    stdio: 'ignore'
  });
  active.push({ server, dir });
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const ports = (await readdir(dir)).find((name) => name.endsWith('.ports'));
    if (ports) {
      const config = JSON.parse(await readFile(path.join(dir, ports), 'utf8'));
      return config.nats[0] as string;
    }
    if (server.exitCode !== null) throw new Error(`nats-server exited: ${server.exitCode}`);
    await delay(50);
  }
  throw new Error('nats-server did not publish a port');
}

async function until(check: () => boolean) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (check()) return;
    await delay(50);
  }
  throw new Error('expected external event was not ingested');
}

function event(id: string) {
  return JSON.stringify({
    type: 'contact.upsert', id, source: 'example', occurredAt: '2026-06-21T15:00:00Z',
    data: { externalId: id, email: `${id}@example.com` }
  });
}

afterEach(async () => {
  for (const { server, dir } of active.splice(0)) {
    server.kill();
    if (server.exitCode === null) await new Promise((resolve) => server.once('exit', resolve));
    await rm(dir, { recursive: true, force: true });
  }
}, 30000);

test('replays offline events and continues after malformed input', async () => {
  const url = await startServer();
  const publisher = await connect({ servers: url, user: 'publisher', pass: 'test' });
  const manager = await jetstreamManager(publisher);
  await manager.streams.add({ name: stream, subjects: ['example.events.>'] });
  const js = jetstream(publisher);
  const repo = createTestRepository();
  const config = {
    enabled: true, provider: 'nats', url: url.replace('nats://', 'nats://importer:test@'),
    subjects: [subject], consumer, stream, importMode: 'review' as const
  };

  await js.publish(subject, event('before-start'));
  const firstStop = new AbortController();
  const firstRun = runNatsSubscriber(config, repo, firstStop.signal);
  await until(() => repo.getExternalEventIngestion('example', 'before-start')?.status === 'pending');
  firstStop.abort();
  await firstRun;

  await js.publish(subject, event('while-offline'));
  await js.publish(subject, '{malformed');
  const secondStop = new AbortController();
  const secondRun = runNatsSubscriber(config, repo, secondStop.signal);
  await until(() => repo.getExternalEventIngestion('example', 'while-offline')?.status === 'pending');
  await js.publish(subject, event('after-malformed'));
  await until(() => repo.getExternalEventIngestion('example', 'after-malformed')?.status === 'pending');
  secondStop.abort();
  await secondRun;
  await publisher.close();
}, 30000);
