export const agentErrorCodes = [
  'agent_permission_denied',
  'approval_required',
  'approval_expired',
  'approval_changed',
  'validation_failed',
  'not_found',
  'conflict',
  'smtp_not_ready',
  'test_mode_blocks_automatic_send',
  'send_once_protected',
  'commit_failed'
] as const;

export type AgentErrorCode = (typeof agentErrorCodes)[number];

export interface AgentError {
  code: AgentErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export function isAgentErrorCode(code: string): code is AgentErrorCode {
  return (agentErrorCodes as readonly string[]).includes(code);
}
