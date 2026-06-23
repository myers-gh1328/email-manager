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
