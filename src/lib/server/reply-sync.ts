import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import type { AppSettings } from './settings';
import type { AppRepository, CommunicationReplyInput } from './repository';

export interface ReplySyncResult {
  status: 'disabled' | 'not_configured' | 'synced';
  checked: number;
  imported: number;
  matched: number;
  skipped: number;
}

export interface ReplySyncMessage {
  providerKey: string;
  providerMessageId?: string;
  inReplyTo?: string;
  references?: string[];
  fromName?: string;
  fromEmail?: string;
  subject?: string;
  textBody?: string;
  htmlBody?: string;
  receivedAt: string;
}

export interface ReplySyncMailbox {
  fetchRecent(limit: number): Promise<ReplySyncMessage[]>;
  close(): Promise<void>;
}

export function replySyncConfigured(settings: Pick<AppSettings, 'replySyncHost' | 'replySyncUsername' | 'replySyncPasswordConfigured'>) {
  return Boolean(settings.replySyncHost && settings.replySyncUsername && settings.replySyncPasswordConfigured);
}

export async function syncRepliesNow() {
  const [{ repo }, { getReplySyncPassword, getSettings }] = await Promise.all([
    import('./app'),
    import('./settings')
  ]);
  const settings = getSettings();
  if (!replySyncConfigured(settings)) return emptyResult('not_configured');

  const mailbox = await createImapMailbox(settings, getReplySyncPassword());
  try {
    return await syncRepliesWithMailbox(repo, mailbox);
  } finally {
    await mailbox.close();
  }
}

export async function syncRepliesWithMailbox(
  repository: Pick<AppRepository, 'listCommunicationMessageIds' | 'recordCommunicationReply'>,
  mailbox: ReplySyncMailbox,
  limit = 200
): Promise<ReplySyncResult> {
  const outbound = new Map(
    repository.listCommunicationMessageIds().map((item) => [normalizeMessageId(item.messageId), item.id])
  );
  if (!outbound.size) return { ...emptyResult('synced'), skipped: 0 };

  const messages = await mailbox.fetchRecent(limit);
  let imported = 0;
  let matched = 0;
  let skipped = 0;

  for (const message of messages) {
    const communicationId = matchCommunicationId(message, outbound);
    if (!communicationId) {
      skipped += 1;
      continue;
    }

    matched += 1;
    const reply = repository.recordCommunicationReply(toReplyInput(communicationId, message));
    if (reply.created) imported += 1;
  }

  return { status: 'synced', checked: messages.length, imported, matched, skipped };
}

function matchCommunicationId(message: ReplySyncMessage, outbound: Map<string, string>) {
  const candidates = [
    message.inReplyTo,
    ...(message.references ?? [])
  ].map(normalizeMessageId).filter(Boolean);
  for (const candidate of candidates) {
    const match = outbound.get(candidate);
    if (match) return match;
  }
  return undefined;
}

function toReplyInput(communicationId: string, message: ReplySyncMessage): CommunicationReplyInput {
  const textBody = (message.textBody ?? '').trim();
  return {
    communicationId,
    providerKey: message.providerKey,
    providerMessageId: message.providerMessageId ?? '',
    fromName: message.fromName ?? '',
    fromEmail: message.fromEmail ?? '',
    subject: message.subject ?? '',
    textBody,
    htmlBody: message.htmlBody ?? '',
    snippet: textBody.replace(/\s+/g, ' ').slice(0, 240),
    receivedAt: message.receivedAt
  };
}

function emptyResult(status: ReplySyncResult['status']): ReplySyncResult {
  return { status, checked: 0, imported: 0, matched: 0, skipped: 0 };
}

function normalizeMessageId(value = '') {
  return value.trim().replace(/^<|>$/g, '').toLowerCase();
}

async function createImapMailbox(settings: AppSettings, password: string): Promise<ReplySyncMailbox> {
  const client = new ImapFlow({
    host: settings.replySyncHost,
    port: Number(settings.replySyncPort || 993),
    secure: settings.replySyncTls,
    auth: {
      user: settings.replySyncUsername,
      pass: password
    },
    logger: false
  });
  await client.connect();
  const mailbox = await client.mailboxOpen('INBOX', { readOnly: true });

  return {
    async fetchRecent(limit: number) {
      const exists = Number(mailbox.exists ?? 0);
      if (!exists) return [];
      const start = Math.max(1, exists - limit + 1);
      const messages: ReplySyncMessage[] = [];
      for await (const message of client.fetch(`${start}:*`, { uid: true, source: true })) {
        if (!message.source) continue;
        const parsed = await simpleParser(message.source);
        messages.push({
          providerKey: `${mailbox.uidValidity ?? ''}:${message.uid}`,
          providerMessageId: parsed.messageId,
          inReplyTo: parsed.inReplyTo,
          references: Array.isArray(parsed.references) ? parsed.references : parsed.references ? [parsed.references] : [],
          fromName: parsed.from?.value[0]?.name,
          fromEmail: parsed.from?.value[0]?.address,
          subject: parsed.subject,
          textBody: parsed.text ?? '',
          htmlBody: typeof parsed.html === 'string' ? parsed.html : '',
          receivedAt: (parsed.date ?? new Date()).toISOString()
        });
      }
      return messages;
    },
    async close() {
      await client.logout().catch(() => undefined);
    }
  };
}
