import { describe, expect, it } from 'vitest';
import { agentError, agentOk } from '../src/lib/server/agent/envelope';
import { agentErrorCodes, isAgentErrorCode } from '../src/lib/server/agent/errors';

describe('agent response envelope', () => {
  it('wraps successful data with stable metadata defaults', () => {
    expect(agentOk({ id: 'contact_1' })).toEqual({
      ok: true,
      data: { id: 'contact_1' },
      warnings: [],
      nextActions: [],
      labels: {}
    });
  });

  it('wraps stable machine-readable errors', () => {
    expect(agentError('validation_failed', 'Fix the input.', { field: 'email' })).toEqual({
      ok: false,
      error: {
        code: 'validation_failed',
        message: 'Fix the input.',
        details: { field: 'email' }
      },
      warnings: [],
      nextActions: [],
      labels: {}
    });
  });

  it('keeps the approved error code vocabulary stable', () => {
    expect(agentErrorCodes).toEqual([
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
    ]);
    expect(isAgentErrorCode('approval_required')).toBe(true);
    expect(isAgentErrorCode('unknown')).toBe(false);
  });
});
