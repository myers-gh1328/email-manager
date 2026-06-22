import type { AppRepository, AgentAuditEventInput } from '../repository';

export function recordAgentAudit(repo: AppRepository, input: AgentAuditEventInput) {
  return repo.recordAgentAuditEvent(input);
}
