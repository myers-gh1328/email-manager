import type { FailureKind } from './scheduler';

export interface ClassifiedFailure {
  kind: Exclude<FailureKind, ''>;
  summary: string;
  retryable: boolean;
}

export class OutboundGateError extends Error {
  constructor(
    message: string,
    public code = 'outbound_blocked',
    public retryAfterSeconds?: number
  ) {
    super(message);
  }
}

export function classifyOutboundFailure(error: unknown): ClassifiedFailure {
  const code = numericCode(error);
  const message = safeErrorSummary(error);
  if (code && code >= 400 && code < 500) return { kind: 'transient', retryable: true, summary: 'Mail server temporarily rejected the message. The app will retry.' };
  if (code && code >= 500) return { kind: 'permanent', retryable: false, summary: 'Mail server rejected the message. Check the recipient or SMTP settings.' };
  if (isTemporaryNetworkError(error)) return { kind: 'transient', retryable: true, summary: 'Temporary network problem while sending. The app will retry.' };
  if (isPermanentAuthError(error)) return { kind: 'permanent', retryable: false, summary: 'SMTP sign-in failed. Check settings.' };
  return { kind: 'unknown', retryable: false, summary: message || 'The mail server response was unclear. Review before retrying.' };
}

export function safeErrorSummary(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  return sanitizeOutboundText(raw) || 'The mail server response was unclear. Review before retrying.';
}

export function sanitizeOutboundText(value: string) {
  return value
    .replace(/(password|passwd|pwd|client_secret|access_token|refresh_token|api[_-]?key)=\S+/gi, '$1=[redacted]')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
    .replace(/[A-Za-z]:\\[^\s]+/g, '[local path]')
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[ip]')
    .slice(0, 240);
}

function numericCode(error: unknown) {
  if (!error || typeof error !== 'object') return undefined;
  const candidate = (error as { responseCode?: unknown; statusCode?: unknown; code?: unknown }).responseCode
    ?? (error as { statusCode?: unknown }).statusCode;
  const parsed = Number(candidate);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function isTemporaryNetworkError(error: unknown) {
  const code = String((error as { code?: unknown })?.code ?? '').toUpperCase();
  return ['ETIMEDOUT', 'ECONNRESET', 'EAI_AGAIN', 'ESOCKET', 'ECONNECTION'].includes(code);
}

function isPermanentAuthError(error: unknown) {
  const text = `${String((error as { code?: unknown })?.code ?? '')} ${error instanceof Error ? error.message : String(error ?? '')}`.toLowerCase();
  return text.includes('invalid_grant') || text.includes('invalid_client') || text.includes('auth') || text.includes('credential');
}
