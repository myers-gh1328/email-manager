import type { AgentError, AgentErrorCode } from './errors';
import type { VocabularyLabels } from './vocabulary';

export interface AgentEnvelopeMeta {
  warnings?: string[];
  nextActions?: string[];
  labels?: Partial<VocabularyLabels>;
}

export type AgentEnvelope<T> =
  | {
      ok: true;
      data: T;
      warnings: string[];
      nextActions: string[];
      labels: Partial<VocabularyLabels>;
    }
  | {
      ok: false;
      error: AgentError;
      warnings: string[];
      nextActions: string[];
      labels: Partial<VocabularyLabels>;
    };

export function agentOk<T>(data: T, meta: AgentEnvelopeMeta = {}): AgentEnvelope<T> {
  return {
    ok: true,
    data,
    warnings: meta.warnings ?? [],
    nextActions: meta.nextActions ?? [],
    labels: meta.labels ?? {}
  };
}

export function agentError<T = never>(
  code: AgentErrorCode,
  message: string,
  details?: Record<string, unknown>,
  meta: AgentEnvelopeMeta = {}
): AgentEnvelope<T> {
  return {
    ok: false,
    error: { code, message, ...(details ? { details } : {}) },
    warnings: meta.warnings ?? [],
    nextActions: meta.nextActions ?? [],
    labels: meta.labels ?? {}
  };
}
