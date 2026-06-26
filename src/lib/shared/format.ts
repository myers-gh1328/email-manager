export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export function formatClassSchedule(session: { startsOn: string; endsOn?: string; startTime?: string }) {
  const endsOn = session.endsOn || session.startsOn;
  const dateRange = endsOn === session.startsOn ? session.startsOn : `${session.startsOn} - ${endsOn}`;
  return session.startTime ? `${dateRange} · ${session.startTime}` : dateRange;
}

export function purposeLabel(purpose: string) {
  return purpose
    .split('_')
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ');
}

export function timingLabel(minutes: number) {
  if (minutes === 0) return 'at class start';
  const absolute = Math.abs(minutes);
  const value = absolute % (24 * 60) === 0 ? absolute / (24 * 60) : absolute / 60;
  const unit = absolute % (24 * 60) === 0 ? 'day' : 'hour';
  return `${value} ${unit}${value === 1 ? '' : 's'} ${minutes < 0 ? 'before' : 'after'}`;
}

export function deliveryStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: 'Ready to send',
    sending: 'Sending',
    sent: 'Sent',
    failed: 'Failed',
    retry_scheduled: 'Will retry',
    needs_attention: 'Needs review',
    skipped: 'Skipped',
    'not planned': 'Not prepared'
  };
  return labels[status] ?? status;
}

export function messageStatusLabel(status: string) {
  const labels: Record<string, string> = {
    accepted: 'Accepted by mail server',
    sent: 'Sent',
    failed: 'Failed'
  };
  return labels[status] ?? status;
}

export function scheduledEmailStatusLabel(readyToSend: boolean) {
  return readyToSend ? 'Ready to send' : 'Draft';
}

export function scheduledEmailDeliverySummary(counts: {
  recipientCount: number;
  pendingCount?: number;
  sentCount?: number;
  failedCount?: number;
}) {
  const parts = [`${counts.recipientCount} recipient${counts.recipientCount === 1 ? '' : 's'}`];
  if (counts.pendingCount) parts.push(`${counts.pendingCount} prepared`);
  if (counts.sentCount) parts.push(`${counts.sentCount} sent`);
  if (counts.failedCount) parts.push(`${counts.failedCount} needs review`);
  return parts.join(' · ');
}
