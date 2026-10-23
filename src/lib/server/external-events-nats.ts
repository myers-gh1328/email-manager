import { createHash } from 'node:crypto';
import { AckPolicy, DeliverPolicy, JetStreamApiCodes, JetStreamApiError, jetstream } from '@nats-io/jetstream';
import { connect } from '@nats-io/transport-node';
import { applyExternalEvent } from './external-events';
import type { ExternalEventMode } from './external-events';
import type { AppRepository } from './repository';

export interface ExternalEventsConfig {
  enabled: boolean;
  provider: string;
  url: string;
  subjects: string[];
  consumer: string;
  stream: string;
  importMode: ExternalEventMode;
}

interface NatsConnectOptions {
  servers: string;
  name: string;
  user?: string;
  pass?: string;
}

let started = false;

export function getExternalEventsConfig(env: NodeJS.ProcessEnv = process.env): ExternalEventsConfig {
  return {
    enabled: env.EXTERNAL_EVENTS_ENABLED === 'true',
    provider: env.EXTERNAL_EVENTS_PROVIDER ?? 'none',
    url: env.EXTERNAL_EVENTS_URL ?? 'nats://127.0.0.1:4222',
    subjects: splitSubjects(env.EXTERNAL_EVENTS_SUBJECTS ?? ''),
    consumer: env.EXTERNAL_EVENTS_CONSUMER ?? 'email-manager',
    stream: env.EXTERNAL_EVENTS_STREAM ?? '',
    importMode: parseImportMode(env.EXTERNAL_EVENTS_IMPORT_MODE)
  };
}

export function startExternalEventSubscriber(config = getExternalEventsConfig()) {
  if (started || !config.enabled) return;
  started = true;

  if (config.provider !== 'nats') {
    console.error(`External events are enabled but provider '${config.provider}' is not supported.`);
    return;
  }

  if (!config.subjects.length) {
    console.error('External events are enabled but EXTERNAL_EVENTS_SUBJECTS is empty.');
    return;
  }

  if (!config.stream) {
    console.error('External events are enabled but EXTERNAL_EVENTS_STREAM is empty.');
    return;
  }

  void import('./app').then(({ repo }) => runNatsSubscriber(config, repo)).catch(() => {
    started = false;
    console.error('External event subscriber stopped; check NATS availability, permissions, and durable configuration.');
  });
}

export async function runNatsSubscriber(config: ExternalEventsConfig, repo: AppRepository, signal?: AbortSignal) {
  if (!config.stream) throw new Error('EXTERNAL_EVENTS_STREAM is required.');
  const connection = await connect(buildNatsConnectOptions(config));
  const decoder = new TextDecoder();
  const active = new Set<{ stop: () => void }>();
  const stop = () => {
    for (const messages of active) messages.stop();
  };
  signal?.addEventListener('abort', stop, { once: true });

  try {
    const js = jetstream(connection);
    const manager = await js.jetstreamManager(false);
    await Promise.all(config.subjects.map(async (subject) => {
      const name = `${config.consumer}-${createHash('sha256').update(subject).digest('hex').slice(0, 12)}`;
      let consumer;
      try {
        consumer = await js.consumers.get(config.stream, name);
        const info = await consumer.info();
        if (info.config.filter_subject !== subject || info.config.ack_policy !== AckPolicy.Explicit) {
          throw new Error(`External event consumer ${name} has an incompatible configuration.`);
        }
      } catch (error) {
        if (!(error instanceof JetStreamApiError) || error.code !== JetStreamApiCodes.ConsumerNotFound) throw error;
        await manager.consumers.add(config.stream, {
          durable_name: name,
          filter_subject: subject,
          ack_policy: AckPolicy.Explicit,
          deliver_policy: DeliverPolicy.All
        });
        consumer = await js.consumers.get(config.stream, name);
      }

      const messages = await consumer.consume();
      active.add(messages);
      if (signal?.aborted) messages.stop();
      try {
        for await (const message of messages) {
          try {
            const result = applyExternalEvent(repo, decoder.decode(message.data), { mode: config.importMode });
            if (result.status === 'invalid' || result.status === 'unsupported') {
              console.error(`External event rejected (${result.status}); subject ${subject}; stream sequence ${message.seq}.`);
            }
            message.ack();
          } catch {
            console.error(`External event processing failed; subject ${subject}; stream sequence ${message.seq}. Retrying.`);
            message.nak(1000);
          }
        }
      } finally {
        active.delete(messages);
      }
    }));
  } finally {
    signal?.removeEventListener('abort', stop);
    stop();
    await connection.close();
  }
}

export function buildNatsConnectOptions(config: ExternalEventsConfig): NatsConnectOptions {
  try {
    const parsed = new URL(config.url);
    if (parsed.protocol !== 'nats:') {
      return { servers: config.url, name: config.consumer };
    }

    const host = parsed.host;
    const user = decodeURIComponent(parsed.username);
    const pass = decodeURIComponent(parsed.password);
    const options: NatsConnectOptions = {
      servers: host,
      name: config.consumer
    };

    if (user) options.user = user;
    if (pass) options.pass = pass;
    return options;
  } catch {
    return { servers: config.url, name: config.consumer };
  }
}

function splitSubjects(value: string) {
  return value
    .split(',')
    .map((subject) => subject.trim())
    .filter(Boolean);
}

function parseImportMode(value: string | undefined): ExternalEventMode {
  return value === 'apply' ? 'apply' : 'review';
}
