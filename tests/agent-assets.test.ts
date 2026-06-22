import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('agent-facing repository assets', () => {
  it('documents canonical agent entry points from root guidance', () => {
    const agents = read('AGENTS.md');
    expect(agents).toContain('npm run agent:check');
    expect(agents).toContain('docs/AGENTIC-OPERATING-MODEL.md');
    expect(agents).toContain('.agents/skills/');
    expect(agents).toContain('.codex/agents/');
  });

  it('keeps repo-local skills discoverable and actionable', () => {
    const legacySkills = [
      '.agents/skills/scuba-email-change/SKILL.md',
      '.agents/skills/scuba-send-safety/SKILL.md',
      '.agents/skills/scuba-ui-workflow/SKILL.md'
    ];

    for (const path of legacySkills) {
      const content = read(path);
      expect(content).toMatch(/^---[\s\S]*name:/);
      expect(content).toMatch(/description:/);
      expect(content).toContain('## When To Use');
      expect(content).toContain('## Procedure');
      expect(content).toContain('npm run agent:check');
    }
  });

  it('keeps generic MCP agent workflow skills discoverable and safe', () => {
    const skills = [
      '.agents/skills/agent-orientation/SKILL.md',
      '.agents/skills/agent-contacts/SKILL.md',
      '.agents/skills/agent-classes/SKILL.md',
      '.agents/skills/agent-templates/SKILL.md',
      '.agents/skills/agent-campaigns/SKILL.md',
      '.agents/skills/agent-communications/SKILL.md',
      '.agents/skills/agent-settings/SKILL.md'
    ];

    for (const path of skills) {
      const content = read(path);
      expect(content).toMatch(/^---[\s\S]*name:/);
      expect(content).toMatch(/description:/);
      expect(content).toContain('## When To Use');
      expect(content).toContain('## Procedure');
      expect(content).toContain('MCP tools');
      expect(content).toContain('Do not read or edit runtime database files');
      expect(content).toContain('exact confirmation text');
    }
  });

  it('provides scoped rules, review agents, and prompts for recurring workflows', () => {
    const expectedFiles = [
      '.cursor/rules/sveltekit-routes.mdc',
      '.cursor/rules/server-boundaries.mdc',
      '.cursor/rules/tests-and-validation.mdc',
      '.codex/agents/send-safety-review.agent.md',
      '.codex/agents/ui-workflow-review.agent.md',
      '.codex/agents/docs-score-review.agent.md',
      '.github/prompts/agent-smoke-test.prompt.md',
      '.github/prompts/send-safety-review.prompt.md'
    ];

    for (const path of expectedFiles) {
      expect(existsSync(path), `${path} should exist`).toBe(true);
      expect(read(path)).toMatch(/^---[\s\S]*description:/);
    }
  });

  it('documents optional local MCP agent access policy', () => {
    const operatingModel = read('docs/AGENTIC-OPERATING-MODEL.md');
    expect(operatingModel).toContain('optional local MCP');
    expect(operatingModel).toContain('approval');
    expect(operatingModel).toContain('must not expose raw SQL');
  });

  it('defines a single full validation script for agents', () => {
    const packageJson = read('package.json');
    const standardsCheck = read('scripts/agent/standards-check.mjs');
    expect(packageJson).toContain('"agent:check": "node scripts/agent/standards-check.mjs"');
    expect(standardsCheck).toContain("'git', ['diff', '--check']");
    expect(standardsCheck).toContain("'npm', ['test']");
    expect(standardsCheck).toContain("'run', 'check'");
    expect(standardsCheck).toContain("'run', 'build'");
  });
});
