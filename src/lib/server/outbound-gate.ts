import { OutboundGateError } from './outbound-errors';
import type { AppSettings } from './settings';

export type OutboundSurface =
  | 'campaign_auto'
  | 'manual_send_due'
  | 'mcp_send_due'
  | 'direct_email'
  | 'mcp_direct_email'
  | 'smtp_test';

const attempts: number[] = [];
const lastSurfaceRun = new Map<string, number>();

export interface OutboundBatchContext {
  surface: OutboundSurface;
  settings: Partial<
    Pick<
      AppSettings,
      | 'outboundKillSwitchEnabled'
      | 'outboundMaxPerMinute'
      | 'outboundMaxPerHour'
      | 'outboundPacingSeconds'
      | 'outboundDirectMaxRecipients'
      | 'smtpHost'
      | 'smtpFrom'
    >
  >;
  recipientCount?: number;
  now?: number;
}

export function assertOutboundBatchAllowed(context: OutboundBatchContext) {
  const now = context.now ?? Date.now();
  if (context.settings.outboundKillSwitchEnabled) {
    throw new OutboundGateError('Outbound email is paused in settings.', 'outbound_kill_switch');
  }
  const directCap = context.settings.outboundDirectMaxRecipients ?? 12;
  if ((context.surface === 'direct_email' || context.surface === 'mcp_direct_email') && (context.recipientCount ?? 0) > directCap) {
    throw new OutboundGateError(`Send to ${directCap} or fewer recipients at a time.`, 'recipient_cap_exceeded');
  }
  enforceSurfaceThrottle(context.surface, now);
}

export function reserveOutboundAttempt(context: OutboundBatchContext) {
  const now = context.now ?? Date.now();
  prune(now);
  const minute = attempts.filter((time) => time > now - 60_000).length;
  const hour = attempts.filter((time) => time > now - 3_600_000).length;
  if (minute >= (context.settings.outboundMaxPerMinute ?? 10)) {
    throw new OutboundGateError('Outbound rate limit reached. Try again in a minute.', 'rate_limited', 60);
  }
  if (hour >= (context.settings.outboundMaxPerHour ?? 50)) {
    throw new OutboundGateError('Outbound hourly limit reached. Try again later.', 'rate_limited', 3600);
  }
  attempts.push(now);
}

export function paceOutboundAttempt(context: OutboundBatchContext) {
  if ((context.settings.outboundPacingSeconds ?? 5) <= 0) return;
  if (process.env.NODE_ENV === 'test') return;
  return new Promise((resolve) => setTimeout(resolve, (context.settings.outboundPacingSeconds ?? 5) * 1000));
}

export function resetOutboundGateForTests() {
  attempts.length = 0;
  lastSurfaceRun.clear();
}

function enforceSurfaceThrottle(surface: OutboundSurface, now: number) {
  if (process.env.NODE_ENV === 'test') return;
  const minimum =
    surface === 'manual_send_due' ? 30_000 :
    surface === 'mcp_send_due' || surface === 'mcp_direct_email' ? 10_000 :
    0;
  if (!minimum) return;
  const last = lastSurfaceRun.get(surface) ?? 0;
  if (last && now - last < minimum) {
    throw new OutboundGateError('That send action was just run. Try again shortly.', 'send_throttled', Math.ceil((minimum - (now - last)) / 1000));
  }
  lastSurfaceRun.set(surface, now);
}

function prune(now: number) {
  for (let index = attempts.length - 1; index >= 0; index -= 1) {
    if (attempts[index] <= now - 3_600_000) attempts.splice(index, 1);
  }
}
