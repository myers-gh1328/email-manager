import { applyExternalEvent } from './external-events';
import type { ExternalEventMode } from './external-events';
import { errorText } from './form-utils';

export interface ExternalEventsConfig {
  enabled: boolean;
  provider: string;
  url: string;
  subjects: string[];
  consumer: string;
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

  void runNatsSubscriber(config).catch((error) => {
    started = false;
    console.error(`External event subscriber stopped: ${errorText(error)}`);
  });
}

async function runNatsSubscriber(config: ExternalEventsConfig) {
  const { repo } = await import('./app');
  const { connect } = await importOptionalNats();
  const connection = await connect(buildNatsConnectOptions(config));
  const decoder = new TextDecoder();

  for (const subject of config.subjects) {
    const subscription = connection.subscribe(subject);
    void (async () => {
      for await (const message of subscription) {
        applyExternalEvent(repo, decoder.decode(message.data), { mode: config.importMode });
      }
    })();
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

async function importOptionalNats(): Promise<{ connect: (options: NatsConnectOptions) => Promise<any> }> {
  const importer = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<unknown>;
  const transport = (await importer('@nats-io/transport-node')) as { connect: (options: NatsConnectOptions) => Promise<any> };
  return { connect: transport.connect };
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
