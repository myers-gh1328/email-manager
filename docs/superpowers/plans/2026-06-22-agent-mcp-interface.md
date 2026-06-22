# Agent MCP Interface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional local MCP agent access for Training Communications Studio while preserving the existing UI, local-first data ownership, send-once email safety, explicit approvals, and user-configurable agent permissions.

**Architecture:** Build MCP as a local-only optional interface over shared server workflow helpers. Keep SQLite access inside the repository, keep SMTP/scheduling inside existing mailer/background/direct-email modules, and put MCP orchestration under `src/lib/server/agent/`. Ship the full design incrementally with narrow commits and tests per slice.

**Tech Stack:** SvelteKit 2, Svelte 5, TypeScript, Node adapter, `node:sqlite`, Vitest, Nodemailer, MCP TypeScript SDK.

---

## Source Design

Implement against:

- `docs/superpowers/specs/2026-06-22-agent-mcp-interface-design.md`
- `docs/ARCHITECTURE.md`
- `docs/AI-MAINTAINER.md`
- `docs/AGENTIC-OPERATING-MODEL.md`
- `docs/OPEN-SOURCE-READINESS.md`

## Team Workstreams

Use separate workers only where write sets are disjoint.

1. **Foundation worker:** product-neutral docs/asset rename and governance updates.
2. **Settings worker:** settings data model, vocabulary, agent permissions, searchable collapsible settings UI.
3. **MCP worker:** MCP packaging, response envelope, read-only orientation tools.
4. **Approval worker:** approval/audit schema, repository API, approval service tests.
5. **Workflow worker:** contacts/classes/templates tools after MCP foundation lands.
6. **Send-safety worker:** campaign/direct-email prepare and commit tools after approval worker lands.
7. **Skills worker:** repo-local generic agent skills after tool contracts stabilize.

Do not run workers 2, 3, and 4 against the same files at the same time without coordination because all may touch `src/lib/server/settings.ts`, `src/lib/server/repository/index.ts`, or package scripts.

## File Map

### New Files

- `src/lib/server/agent/envelope.ts`: response envelope, success/error helpers, warning/next action shape.
- `src/lib/server/agent/errors.ts`: stable agent error codes and mapping helpers.
- `src/lib/server/agent/permissions.ts`: permission keys, defaults, settings conversion, permission check helper.
- `src/lib/server/agent/vocabulary.ts`: vocabulary defaults and label normalization.
- `src/lib/server/agent/orientation.ts`: `get_app_overview`, `get_scheduler_readiness`, `get_agent_capabilities`, `get_navigation_state`.
- `src/lib/server/agent/approvals.ts`: prepare/commit validation, exact confirmation checks, expiration and changed-state handling.
- `src/lib/server/agent/audit.ts`: audit event recording helpers.
- `src/lib/server/agent/tools/contacts.ts`: contact workflow tools.
- `src/lib/server/agent/tools/classes.ts`: class workflow tools.
- `src/lib/server/agent/tools/templates.ts`: template workflow tools.
- `src/lib/server/agent/tools/campaigns.ts`: campaign prepare/commit tools.
- `src/lib/server/agent/tools/communications.ts`: direct email prepare/commit tools.
- `src/lib/server/repository/agent.ts`: agent approval and audit SQL.
- `src/mcp/server.ts`: MCP server and tool registration.
- `src/mcp/index.ts`: stdio MCP entry point.
- `tsconfig.mcp.json`: standalone MCP TypeScript build.
- `tests/agent-envelope.test.ts`
- `tests/agent-settings.test.ts`
- `tests/agent-orientation.test.ts`
- `tests/repository.agent.test.ts`
- `tests/agent.approvals.test.ts`
- `tests/agent.contacts.test.ts`
- `tests/agent.classes.test.ts`
- `tests/agent.templates.test.ts`
- `tests/agent.campaigns.test.ts`
- `tests/agent.direct-email.test.ts`
- `.agents/skills/agent-orientation/SKILL.md`
- `.agents/skills/agent-contacts/SKILL.md`
- `.agents/skills/agent-classes/SKILL.md`
- `.agents/skills/agent-templates/SKILL.md`
- `.agents/skills/agent-campaigns/SKILL.md`
- `.agents/skills/agent-communications/SKILL.md`
- `.agents/skills/agent-settings/SKILL.md`

### Modified Files

- `package.json`: product name, MCP dependency, MCP scripts.
- `package-lock.json`: dependency lock update.
- `src/lib/server/app.ts`: remove standalone-MCP-hostile `$app/environment` dependency or isolate it.
- `src/lib/server/settings.ts`: app settings, agent access, permissions, vocabulary helpers.
- `src/lib/server/page-data.ts`: include vocabulary and agent settings only where safe for browser load data.
- `src/lib/server/repository/schema.ts`: agent approval/audit tables.
- `src/lib/server/repository/types.ts`: agent approval/audit types.
- `src/lib/server/repository/index.ts`: repository API exports.
- `src/routes/settings/+page.server.ts`: scoped actions for agent access, permissions, vocabulary.
- `src/routes/settings/+page.svelte`: searchable collapsible settings sections.
- `src/styles.css`: settings search/collapsible section polish if page-local CSS is insufficient.
- `tests/agent-assets.test.ts`: generic skill expectations and MCP policy.
- `tests/accessibility-contract.test.ts`: accessible settings search/collapsible controls.
- `tests/navigation.test.ts`: product name or route copy expectations if affected.
- `AGENTS.md`, `README.md`, `docs/ARCHITECTURE.md`, `docs/AI-MAINTAINER.md`, `docs/AGENTIC-OPERATING-MODEL.md`, `docs/AGENT-DEV-ENV.md`, `docs/OPEN-SOURCE-READINESS.md`: product-neutral docs and MCP policy.

## Task 1: Product-Neutral Foundation

**Files:**
- Modify: `package.json`
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/AI-MAINTAINER.md`
- Modify: `docs/AGENTIC-OPERATING-MODEL.md`
- Modify: `docs/AGENT-DEV-ENV.md`
- Modify: `docs/OPEN-SOURCE-READINESS.md`
- Modify: `tests/agent-assets.test.ts`

- [ ] **Step 1: Inventory current branding**

Run:

```bash
rg -n "legacy product name|scuba-email|scuba" package.json README.md AGENTS.md docs .agents .github .codex src tests
```

Expected: a list of current product and agent-asset references. Do not blindly replace runtime env vars, cookie names, DB filenames, or historical spec content in this task.

- [ ] **Step 2: Update tests for generic agent assets**

In `tests/agent-assets.test.ts`, replace the hard-coded skill list with both existing legacy skills and the intended generic policy. The first passing slice can keep legacy skills while asserting that docs explain the transition.

Add assertions:

```ts
it('documents optional local MCP agent access policy', () => {
  const operatingModel = read('docs/AGENTIC-OPERATING-MODEL.md');
  expect(operatingModel).toContain('optional local MCP');
  expect(operatingModel).toContain('approval');
  expect(operatingModel).toContain('must not expose raw SQL');
});
```

- [ ] **Step 3: Run focused test and verify it fails**

Run:

```bash
npm test -- tests/agent-assets.test.ts
```

Expected: FAIL because docs do not yet contain the MCP policy text.

- [ ] **Step 4: Rename user-facing documentation**

Update docs to use `Training Communications Studio` for app-facing product references. Keep `scuba` only where explaining existing technical names or historical context.

Required doc text in `docs/AGENTIC-OPERATING-MODEL.md`:

```md
## Optional Local MCP Agent Access

Training Communications Studio may expose an optional local MCP server for AI assistants. The MCP surface is workflow-shaped, local-only, and governed by app settings, agent permissions, approval packets, and audit records. It must not expose raw SQL, database file paths, decrypted secrets, or generic filesystem access.
```

- [ ] **Step 5: Keep internal compatibility explicit**

Where existing env vars or files still use `SCUBA_EMAIL_*` or `scuba-email.sqlite`, add short compatibility notes rather than renaming them in this task. Runtime name migrations belong in a later dedicated compatibility slice.

- [ ] **Step 6: Run focused validation**

Run:

```bash
npm test -- tests/agent-assets.test.ts
npm run check
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add package.json README.md AGENTS.md docs tests/agent-assets.test.ts
git commit -m "docs: generalize app agent guidance"
```

## Task 2: Agent Settings, Permissions, And Vocabulary

**Files:**
- Create: `src/lib/server/agent/permissions.ts`
- Create: `src/lib/server/agent/vocabulary.ts`
- Create: `tests/agent-settings.test.ts`
- Modify: `src/lib/server/settings.ts`

- [ ] **Step 1: Add failing tests for defaults**

Create `tests/agent-settings.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { defaultAgentPermissions, agentPermissionKeys } from '../src/lib/server/agent/permissions';
import { defaultVocabulary, normalizeVocabulary } from '../src/lib/server/agent/vocabulary';

describe('agent settings defaults', () => {
  it('defaults to read-only agent permissions', () => {
    expect(defaultAgentPermissions.viewData).toBe(true);
    for (const key of agentPermissionKeys.filter((key) => key !== 'viewData')) {
      expect(defaultAgentPermissions[key]).toBe(false);
    }
  });

  it('uses stable default vocabulary labels', () => {
    expect(defaultVocabulary.courseTypeLabel).toBe('Course type');
    expect(defaultVocabulary.classSessionLabel).toBe('Class session');
    expect(defaultVocabulary.studentLabel).toBe('Student');
    expect(defaultVocabulary.instructorLabel).toBe('Instructor');
  });

  it('trims vocabulary overrides and falls back when blank', () => {
    const labels = normalizeVocabulary({
      courseTypeLabel: ' Program ',
      classSessionLabel: '',
      studentLabel: ' Participant ',
      instructorLabel: ''
    });
    expect(labels.courseTypeLabel).toBe('Program');
    expect(labels.classSessionLabel).toBe('Class session');
    expect(labels.studentLabel).toBe('Participant');
    expect(labels.instructorLabel).toBe('Instructor');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/agent-settings.test.ts
```

Expected: FAIL because the new modules do not exist.

- [ ] **Step 3: Implement permission module**

Create `src/lib/server/agent/permissions.ts`:

```ts
export const agentPermissionKeys = [
  'viewData',
  'editRecords',
  'importData',
  'prepareEmail',
  'scheduleEmail',
  'sendEmail',
  'updateSettings',
  'manageAgentAccess'
] as const;

export type AgentPermissionKey = (typeof agentPermissionKeys)[number];
export type AgentPermissions = Record<AgentPermissionKey, boolean>;

export const defaultAgentPermissions: AgentPermissions = {
  viewData: true,
  editRecords: false,
  importData: false,
  prepareEmail: false,
  scheduleEmail: false,
  sendEmail: false,
  updateSettings: false,
  manageAgentAccess: false
};

export function settingKeyForAgentPermission(key: AgentPermissionKey) {
  return `agent.permission.${key}`;
}

export function normalizeAgentPermissions(values: Partial<Record<AgentPermissionKey, boolean | string>>): AgentPermissions {
  const permissions = { ...defaultAgentPermissions };
  for (const key of agentPermissionKeys) {
    const value = values[key];
    if (typeof value === 'boolean') permissions[key] = value;
    if (typeof value === 'string') permissions[key] = value === 'true' || value === 'on';
  }
  return permissions;
}
```

- [ ] **Step 4: Implement vocabulary module**

Create `src/lib/server/agent/vocabulary.ts`:

```ts
export interface VocabularyLabels {
  courseTypeLabel: string;
  courseTypePluralLabel: string;
  classSessionLabel: string;
  classSessionPluralLabel: string;
  studentLabel: string;
  studentPluralLabel: string;
  instructorLabel: string;
  instructorPluralLabel: string;
}

export const defaultVocabulary: VocabularyLabels = {
  courseTypeLabel: 'Course type',
  courseTypePluralLabel: 'Course types',
  classSessionLabel: 'Class session',
  classSessionPluralLabel: 'Class sessions',
  studentLabel: 'Student',
  studentPluralLabel: 'Students',
  instructorLabel: 'Instructor',
  instructorPluralLabel: 'Instructors'
};

export function normalizeVocabulary(values: Partial<Record<keyof VocabularyLabels, string>>): VocabularyLabels {
  const labels = { ...defaultVocabulary };
  for (const key of Object.keys(defaultVocabulary) as Array<keyof VocabularyLabels>) {
    const value = values[key]?.trim();
    if (value) labels[key] = value;
  }
  return labels;
}
```

- [ ] **Step 5: Extend application settings**

Modify `src/lib/server/settings.ts`:

```ts
import {
  agentPermissionKeys,
  defaultAgentPermissions,
  normalizeAgentPermissions,
  settingKeyForAgentPermission,
  type AgentPermissions
} from './agent/permissions';
import { defaultVocabulary, normalizeVocabulary, type VocabularyLabels } from './agent/vocabulary';
```

Add to `AppSettings`:

```ts
agentEnabled: boolean;
agentPermissions: AgentPermissions;
vocabulary: VocabularyLabels;
```

Add to `getSettings()`:

```ts
agentEnabled: repo.getSetting('agent.enabled') === 'true',
agentPermissions: normalizeAgentPermissions(
  Object.fromEntries(agentPermissionKeys.map((key) => [key, repo.getSetting(settingKeyForAgentPermission(key)) || String(defaultAgentPermissions[key])]))
),
vocabulary: normalizeVocabulary({
  courseTypeLabel: repo.getSetting('vocabulary.courseTypeLabel') || defaultVocabulary.courseTypeLabel,
  courseTypePluralLabel: repo.getSetting('vocabulary.courseTypePluralLabel') || defaultVocabulary.courseTypePluralLabel,
  classSessionLabel: repo.getSetting('vocabulary.classSessionLabel') || defaultVocabulary.classSessionLabel,
  classSessionPluralLabel: repo.getSetting('vocabulary.classSessionPluralLabel') || defaultVocabulary.classSessionPluralLabel,
  studentLabel: repo.getSetting('vocabulary.studentLabel') || defaultVocabulary.studentLabel,
  studentPluralLabel: repo.getSetting('vocabulary.studentPluralLabel') || defaultVocabulary.studentPluralLabel,
  instructorLabel: repo.getSetting('vocabulary.instructorLabel') || defaultVocabulary.instructorLabel,
  instructorPluralLabel: repo.getSetting('vocabulary.instructorPluralLabel') || defaultVocabulary.instructorPluralLabel
})
```

Add grouped update helpers:

```ts
export function updateAgentAccessSettings(form: FormData) {
  set('agent.enabled', checked(form, 'agentEnabled'));
}

export function updateAgentPermissionSettings(form: FormData) {
  for (const key of agentPermissionKeys) {
    set(settingKeyForAgentPermission(key), checked(form, key));
  }
}

export function updateVocabularySettings(form: FormData) {
  const labels = normalizeVocabulary({
    courseTypeLabel: String(form.get('courseTypeLabel') ?? ''),
    courseTypePluralLabel: String(form.get('courseTypePluralLabel') ?? ''),
    classSessionLabel: String(form.get('classSessionLabel') ?? ''),
    classSessionPluralLabel: String(form.get('classSessionPluralLabel') ?? ''),
    studentLabel: String(form.get('studentLabel') ?? ''),
    studentPluralLabel: String(form.get('studentPluralLabel') ?? ''),
    instructorLabel: String(form.get('instructorLabel') ?? ''),
    instructorPluralLabel: String(form.get('instructorPluralLabel') ?? '')
  });
  for (const [key, value] of Object.entries(labels)) {
    set(`vocabulary.${key}`, value);
  }
}
```

- [ ] **Step 6: Run tests**

Run:

```bash
npm test -- tests/agent-settings.test.ts
npm run check
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add src/lib/server/agent/permissions.ts src/lib/server/agent/vocabulary.ts src/lib/server/settings.ts tests/agent-settings.test.ts
git commit -m "feat: add agent settings defaults"
```

## Task 3: Searchable Collapsible Settings UI

**Files:**
- Modify: `src/routes/settings/+page.server.ts`
- Modify: `src/routes/settings/+page.svelte`
- Modify: `src/styles.css` if needed
- Modify: `tests/accessibility-contract.test.ts`

- [ ] **Step 1: Add settings actions**

Modify `src/routes/settings/+page.server.ts` imports:

```ts
import {
  updateAgentAccessSettings,
  updateAgentPermissionSettings,
  updateAiSettings,
  updateDeliverySettings,
  updateProfileSettings,
  updateRemoteAccessSettings,
  updateSmtpSettings,
  updateVocabularySettings
} from '$lib/server/settings';
```

Add actions:

```ts
updateAgentAccess: async ({ request }) => {
  updateAgentAccessSettings(await request.formData());
  return { message: 'Agent access settings saved.' };
},
updateAgentPermissions: async ({ request }) => {
  updateAgentPermissionSettings(await request.formData());
  return { message: 'Agent permissions saved.' };
},
updateVocabulary: async ({ request }) => {
  updateVocabularySettings(await request.formData());
  return { message: 'Vocabulary settings saved.' };
},
```

- [ ] **Step 2: Add accessible settings search helper**

In `src/routes/settings/+page.svelte`, add state:

```svelte
let settingsSearch = $state('');

function sectionMatches(title: string, terms: string[]) {
  const query = settingsSearch.trim().toLowerCase();
  if (!query) return true;
  return [title, ...terms].join(' ').toLowerCase().includes(query);
}
```

- [ ] **Step 3: Restructure settings into details sections**

Use native `details`/`summary`. Each existing form keeps its own `action`.

Add search control near the top:

```svelte
<label class="settings-search">
  Search settings
  <input bind:value={settingsSearch} placeholder="Agent, SMTP, password, schedule" />
</label>
```

Wrap agent access section:

```svelte
{#if sectionMatches('Agent Access', ['ai assistant claude code local tools mcp token'])}
  <details class="settings-section" open>
    <summary>Agent Access</summary>
    <form method="POST" action="?/updateAgentAccess" class="panel-form" use:enhance>
      <label class="check with-help">
        <span><input name="agentEnabled" type="checkbox" checked={data.settings.agentEnabled} /> Enable AI agent access</span>
        <small>Let AI assistants like Claude Code operate this app through approved local tools.</small>
      </label>
      <p class="help-text">Risky actions like sending email still require explicit approval.</p>
      <button type="submit">Save agent access</button>
    </form>
  </details>
{/if}
```

Wrap permissions section:

```svelte
{#if sectionMatches('Agent Permissions', ['view edit import prepare schedule send settings approval'])}
  <details class="settings-section" open>
    <summary>Agent Permissions</summary>
    <form method="POST" action="?/updateAgentPermissions" class="panel-form" use:enhance>
      <label class="check"><span><input name="viewData" type="checkbox" checked={data.settings.agentPermissions.viewData} /> Let agents view my app data</span></label>
      <label class="check"><span><input name="editRecords" type="checkbox" checked={data.settings.agentPermissions.editRecords} /> Let agents draft and edit records</span></label>
      <label class="check"><span><input name="importData" type="checkbox" checked={data.settings.agentPermissions.importData} /> Let agents import roster data</span></label>
      <label class="check"><span><input name="prepareEmail" type="checkbox" checked={data.settings.agentPermissions.prepareEmail} /> Let agents prepare emails for my approval</span></label>
      <label class="check"><span><input name="scheduleEmail" type="checkbox" checked={data.settings.agentPermissions.scheduleEmail} /> Let agents schedule approved emails</span></label>
      <label class="check"><span><input name="sendEmail" type="checkbox" checked={data.settings.agentPermissions.sendEmail} /> Let agents send approved emails</span></label>
      <label class="check"><span><input name="updateSettings" type="checkbox" checked={data.settings.agentPermissions.updateSettings} /> Let agents update selected settings</span></label>
      <button type="submit">Save agent permissions</button>
    </form>
  </details>
{/if}
```

Wrap vocabulary section:

```svelte
{#if sectionMatches('Vocabulary', ['labels course class student instructor participant workshop'])}
  <details class="settings-section" open>
    <summary>Vocabulary</summary>
    <form method="POST" action="?/updateVocabulary" class="panel-form" use:enhance>
      <div class="split">
        <label>Course type label<input name="courseTypeLabel" value={data.settings.vocabulary.courseTypeLabel} /></label>
        <label>Course types label<input name="courseTypePluralLabel" value={data.settings.vocabulary.courseTypePluralLabel} /></label>
      </div>
      <div class="split">
        <label>Class session label<input name="classSessionLabel" value={data.settings.vocabulary.classSessionLabel} /></label>
        <label>Class sessions label<input name="classSessionPluralLabel" value={data.settings.vocabulary.classSessionPluralLabel} /></label>
      </div>
      <div class="split">
        <label>Student label<input name="studentLabel" value={data.settings.vocabulary.studentLabel} /></label>
        <label>Students label<input name="studentPluralLabel" value={data.settings.vocabulary.studentPluralLabel} /></label>
      </div>
      <div class="split">
        <label>Instructor label<input name="instructorLabel" value={data.settings.vocabulary.instructorLabel} /></label>
        <label>Instructors label<input name="instructorPluralLabel" value={data.settings.vocabulary.instructorPluralLabel} /></label>
      </div>
      <button type="submit">Save vocabulary</button>
    </form>
  </details>
{/if}
```

- [ ] **Step 4: Add focused accessibility contract**

In `tests/accessibility-contract.test.ts`, add a markup/string contract if existing tests use source inspection:

```ts
it('keeps settings searchable and grouped with native collapsible sections', () => {
  const source = readFileSync('src/routes/settings/+page.svelte', 'utf8');
  expect(source).toContain('Search settings');
  expect(source).toContain('<details');
  expect(source).toContain('<summary>Agent Access</summary>');
  expect(source).toContain('<summary>Agent Permissions</summary>');
  expect(source).toContain('<summary>Vocabulary</summary>');
});
```

- [ ] **Step 5: Run checks**

Run:

```bash
npm test -- tests/accessibility-contract.test.ts tests/agent-settings.test.ts
npm run check
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add src/routes/settings/+page.server.ts src/routes/settings/+page.svelte src/styles.css tests/accessibility-contract.test.ts
git commit -m "feat: add agent settings sections"
```

## Task 4: Agent Response Envelope And MCP Packaging

**Files:**
- Create: `src/lib/server/agent/envelope.ts`
- Create: `src/lib/server/agent/errors.ts`
- Create: `src/lib/server/agent/orientation.ts`
- Create: `src/mcp/server.ts`
- Create: `src/mcp/index.ts`
- Create: `tsconfig.mcp.json`
- Create: `tests/agent-envelope.test.ts`
- Create: `tests/agent-orientation.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/lib/server/app.ts`

- [ ] **Step 1: Install MCP SDK**

Run:

```bash
npm install @modelcontextprotocol/sdk
```

Expected: `package.json` and `package-lock.json` update.

- [ ] **Step 2: Add failing envelope test**

Create `tests/agent-envelope.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { agentError, agentOk } from '../src/lib/server/agent/envelope';

describe('agent response envelope', () => {
  it('wraps successful data with warnings, next actions, and labels', () => {
    expect(agentOk({ value: 1 }, { warnings: ['Check settings'], nextActions: ['get_scheduler_readiness'], labels: { classSessionLabel: 'Workshop' } })).toEqual({
      ok: true,
      data: { value: 1 },
      warnings: ['Check settings'],
      nextActions: ['get_scheduler_readiness'],
      labels: { classSessionLabel: 'Workshop' }
    });
  });

  it('wraps stable machine-readable errors without secrets', () => {
    expect(agentError('agent_permission_denied', 'Permission denied.', { permission: 'sendEmail' })).toEqual({
      ok: false,
      error: { code: 'agent_permission_denied', message: 'Permission denied.', details: { permission: 'sendEmail' } },
      warnings: [],
      nextActions: [],
      labels: {}
    });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run:

```bash
npm test -- tests/agent-envelope.test.ts
```

Expected: FAIL because `envelope.ts` does not exist.

- [ ] **Step 4: Implement errors and envelope**

Create `src/lib/server/agent/errors.ts`:

```ts
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
  'send_once_protected'
] as const;

export type AgentErrorCode = (typeof agentErrorCodes)[number];
```

Create `src/lib/server/agent/envelope.ts`:

```ts
import type { AgentErrorCode } from './errors';

export interface AgentResponseOptions {
  warnings?: string[];
  nextActions?: string[];
  labels?: Record<string, string>;
}

export function agentOk<T>(data: T, options: AgentResponseOptions = {}) {
  return {
    ok: true as const,
    data,
    warnings: options.warnings ?? [],
    nextActions: options.nextActions ?? [],
    labels: options.labels ?? {}
  };
}

export function agentError(code: AgentErrorCode, message: string, details: Record<string, unknown> = {}, options: AgentResponseOptions = {}) {
  return {
    ok: false as const,
    error: { code, message, details },
    warnings: options.warnings ?? [],
    nextActions: options.nextActions ?? [],
    labels: options.labels ?? {}
  };
}
```

- [ ] **Step 5: Make `app.ts` safe for standalone import**

Modify `src/lib/server/app.ts` to remove `$app/environment`:

```ts
import { join } from 'node:path';
import { AppRepository } from './repository';

export const isAgentDev = process.env.npm_lifecycle_event === 'dev:agent' || process.env.npm_lifecycle_event === 'dev:agent:seed';

const dataDir = process.env.SCUBA_EMAIL_DATA_DIR ?? join(process.cwd(), isAgentDev ? '.agent-dev/data' : 'data');
const dbPath = process.env.SCUBA_EMAIL_DB ?? join(dataDir, 'scuba-email.sqlite');

export const repo = new AppRepository(dbPath);

export const isDev = process.env.NODE_ENV !== 'production';
```

- [ ] **Step 6: Add orientation helper**

Create `src/lib/server/agent/orientation.ts`:

```ts
import { loadDashboardData } from '../page-data';
import { getSettings } from '../settings';
import { agentOk } from './envelope';

export function getAgentCapabilities() {
  const settings = getSettings();
  return agentOk({
    agentEnabled: settings.agentEnabled,
    permissions: settings.agentPermissions
  }, { labels: settings.vocabulary });
}

export function getSchedulerReadiness() {
  const data = loadDashboardData();
  return agentOk(data.schedulerStatus, {
    labels: data.settings.vocabulary,
    nextActions: data.schedulerStatus.ready ? ['list_campaigns'] : ['get_settings_readiness']
  });
}

export function getAppOverview() {
  const data = loadDashboardData();
  return agentOk({
    stats: data.stats,
    schedulerReadiness: data.schedulerStatus,
    settings: {
      schedulerEnabled: data.settings.schedulerEnabled,
      emailTestModeEnabled: data.settings.emailTestModeEnabled,
      smtpPasswordConfigured: data.settings.smtpPasswordConfigured,
      aiEnabled: data.settings.aiEnabled,
      agentEnabled: data.settings.agentEnabled
    }
  }, { labels: data.settings.vocabulary, nextActions: ['get_scheduler_readiness', 'get_agent_capabilities'] });
}
```

- [ ] **Step 7: Add orientation tests**

Create `tests/agent-orientation.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { getAgentCapabilities, getAppOverview } from '../src/lib/server/agent/orientation';

describe('agent orientation tools', () => {
  it('returns capabilities in the agent envelope', () => {
    const response = getAgentCapabilities();
    expect(response.ok).toBe(true);
    expect(response.data.permissions.viewData).toBe(true);
    expect(response.labels.studentLabel).toBe('Student');
  });

  it('does not expose decrypted secrets in app overview', () => {
    const response = getAppOverview();
    const serialized = JSON.stringify(response);
    expect(serialized).not.toContain('smtp.password');
    expect(serialized).not.toContain('ai.apiKey');
    expect(serialized).not.toContain('app secret');
  });
});
```

- [ ] **Step 8: Add MCP TypeScript build**

Create `tsconfig.mcp.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "build-mcp",
    "rootDir": ".",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "target": "ES2022",
    "noEmit": false,
    "paths": {
      "$lib/*": ["./src/lib/*"]
    }
  },
  "include": ["src/mcp/**/*.ts", "src/lib/server/**/*.ts", "src/lib/shared/**/*.ts", ".svelte-kit/ambient.d.ts"]
}
```

- [ ] **Step 9: Add MCP server entry**

Create `src/mcp/server.ts` using the current `@modelcontextprotocol/sdk` API. Register read-only tools:

```ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getAgentCapabilities, getAppOverview, getSchedulerReadiness } from '../lib/server/agent/orientation';

export function createMcpServer() {
  const server = new McpServer({ name: 'training-communications-studio', version: '0.1.0' });

  server.tool('get_app_overview', {}, async () => ({ content: [{ type: 'text', text: JSON.stringify(getAppOverview(), null, 2) }] }));
  server.tool('get_scheduler_readiness', {}, async () => ({ content: [{ type: 'text', text: JSON.stringify(getSchedulerReadiness(), null, 2) }] }));
  server.tool('get_agent_capabilities', {}, async () => ({ content: [{ type: 'text', text: JSON.stringify(getAgentCapabilities(), null, 2) }] }));

  return server;
}
```

Create `src/mcp/index.ts`:

```ts
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMcpServer } from './server';

const server = createMcpServer();
await server.connect(new StdioServerTransport());
```

- [ ] **Step 10: Add scripts**

Modify `package.json`:

```json
"mcp:build": "svelte-kit sync && tsc -p tsconfig.mcp.json",
"mcp": "node build-mcp/src/mcp/index.js"
```

- [ ] **Step 11: Run checks**

Run:

```bash
npm test -- tests/agent-envelope.test.ts tests/agent-orientation.test.ts
npm run mcp:build
npm run check
```

Expected: PASS. If `@modelcontextprotocol/sdk` API differs, update `src/mcp/server.ts` to the installed SDK's documented registration shape and keep the three tool names stable.

- [ ] **Step 12: Commit**

Run:

```bash
git add package.json package-lock.json tsconfig.mcp.json src/lib/server/app.ts src/lib/server/agent src/mcp tests/agent-envelope.test.ts tests/agent-orientation.test.ts
git commit -m "feat: add read-only mcp server"
```

## Task 5: Approval And Audit Repository

**Files:**
- Create: `src/lib/server/repository/agent.ts`
- Create: `tests/repository.agent.test.ts`
- Modify: `src/lib/server/repository/schema.ts`
- Modify: `src/lib/server/repository/types.ts`
- Modify: `src/lib/server/repository/index.ts`

- [ ] **Step 1: Write repository tests**

Create `tests/repository.agent.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createTestRepository } from './repository-helpers';

describe('agent approval and audit repository', () => {
  it('creates and reads a pending approval', () => {
    const repo = createTestRepository();
    const approval = repo.createAgentApproval({
      toolName: 'prepare_direct_email',
      risk: 'sends_email',
      summary: 'Send email to one participant',
      operationJson: JSON.stringify({ contactIds: ['c1'] }),
      reviewJson: JSON.stringify({ recipients: 1 }),
      confirmationText: 'APPROVE SEND appr_test',
      expiresAt: '2030-01-01T00:00:00.000Z'
    });
    expect(approval.status).toBe('pending');
    expect(repo.getAgentApproval(approval.id)?.summary).toBe('Send email to one participant');
  });

  it('records audit events in newest-first order', () => {
    const repo = createTestRepository();
    repo.recordAgentAuditEvent({ toolName: 'get_app_overview', risk: 'read', action: 'read', summary: 'Read overview', status: 'ok' });
    const page = repo.listAgentAuditEvents({ limit: 10 });
    expect(page.items[0].toolName).toBe('get_app_overview');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/repository.agent.test.ts
```

Expected: FAIL because repository methods do not exist.

- [ ] **Step 3: Add types**

Add to `src/lib/server/repository/types.ts`:

```ts
export type AgentRisk = 'read' | 'draft_or_edit' | 'imports_data' | 'changes_operational_settings' | 'schedules_email' | 'sends_email' | 'changes_secrets_or_auth';
export type AgentApprovalStatus = 'pending' | 'committed' | 'expired' | 'rejected' | 'failed';
export type AgentAuditAction = 'prepare' | 'commit' | 'reject' | 'expire' | 'read' | 'mutate' | 'permission_denied';

export interface AgentApprovalInput {
  toolName: string;
  risk: AgentRisk;
  summary: string;
  operationJson: string;
  reviewJson: string;
  confirmationText: string;
  expiresAt: string;
}

export interface AgentApproval extends AgentApprovalInput {
  id: string;
  status: AgentApprovalStatus;
  createdAt: string;
  committedAt: string;
  resultJson: string;
}

export interface AgentAuditEventInput {
  toolName: string;
  risk: AgentRisk;
  action: AgentAuditAction;
  summary: string;
  entityType?: string;
  entityId?: string;
  status: string;
}

export interface AgentAuditEvent extends AgentAuditEventInput {
  id: string;
  createdAt: string;
}
```

- [ ] **Step 4: Add schema**

Add to `src/lib/server/repository/schema.ts` migration:

```sql
create table if not exists agent_approvals (
  id text primary key,
  tool_name text not null,
  risk text not null,
  summary text not null,
  operation_json text not null,
  review_json text not null,
  confirmation_text text not null,
  status text not null,
  created_at text not null,
  expires_at text not null,
  committed_at text not null default '',
  result_json text not null default ''
);

create table if not exists agent_audit_events (
  id text primary key,
  tool_name text not null,
  risk text not null,
  action text not null,
  summary text not null,
  entity_type text not null default '',
  entity_id text not null default '',
  status text not null,
  created_at text not null
);
```

Add indexes:

```sql
create index if not exists idx_agent_approvals_status_expires
  on agent_approvals(status, expires_at);
create index if not exists idx_agent_audit_events_created
  on agent_audit_events(created_at);
```

- [ ] **Step 5: Implement repository module**

Create `src/lib/server/repository/agent.ts` with SQL helpers using `id('appr')`, `id('audit')`, and `now()` from `ids.ts`. Keep JSON as strings at repository boundary.

- [ ] **Step 6: Export methods from repository index**

Modify `src/lib/server/repository/index.ts` to expose:

```ts
createAgentApproval(input: AgentApprovalInput)
getAgentApproval(id: string)
listPendingAgentApprovals()
markAgentApprovalCommitted(id: string, resultJson: string)
markAgentApprovalFailed(id: string, resultJson: string)
markAgentApprovalRejected(id: string)
expireAgentApprovals(nowIso: string)
recordAgentAuditEvent(input: AgentAuditEventInput)
listAgentAuditEvents(input?: { limit?: number; cursor?: string })
```

- [ ] **Step 7: Run tests**

Run:

```bash
npm test -- tests/repository.agent.test.ts
npm run check
```

Expected: PASS.

- [ ] **Step 8: Commit**

Run:

```bash
git add src/lib/server/repository tests/repository.agent.test.ts
git commit -m "feat: persist agent approvals"
```

## Task 6: Approval Service

**Files:**
- Create: `src/lib/server/agent/approvals.ts`
- Create: `src/lib/server/agent/audit.ts`
- Create: `tests/agent.approvals.test.ts`

- [ ] **Step 1: Write approval service tests**

Create `tests/agent.approvals.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createTestRepository } from './repository-helpers';
import { commitPreparedApproval, prepareAgentApproval } from '../src/lib/server/agent/approvals';

describe('agent approval service', () => {
  it('requires exact confirmation text', () => {
    const repo = createTestRepository();
    const prepared = prepareAgentApproval(repo, {
      toolName: 'prepare_direct_email',
      risk: 'sends_email',
      summary: 'Send email',
      operation: { subject: 'Hello' },
      review: { recipients: 1 },
      expiresAt: '2030-01-01T00:00:00.000Z'
    });
    const result = commitPreparedApproval(repo, prepared.approvalId, 'wrong', () => ({ ok: true }));
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('approval_required');
  });

  it('commits once with exact confirmation text', () => {
    const repo = createTestRepository();
    const prepared = prepareAgentApproval(repo, {
      toolName: 'prepare_direct_email',
      risk: 'sends_email',
      summary: 'Send email',
      operation: { subject: 'Hello' },
      review: { recipients: 1 },
      expiresAt: '2030-01-01T00:00:00.000Z'
    });
    const committed = commitPreparedApproval(repo, prepared.approvalId, prepared.confirmationText, () => ({ ok: true, id: 'result1' }));
    expect(committed.ok).toBe(true);
    const again = commitPreparedApproval(repo, prepared.approvalId, prepared.confirmationText, () => ({ ok: true }));
    expect(again.ok).toBe(false);
    expect(again.error.code).toBe('conflict');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/agent.approvals.test.ts
```

Expected: FAIL because `approvals.ts` does not exist.

- [ ] **Step 3: Implement audit helper**

Create `src/lib/server/agent/audit.ts`:

```ts
import type { AppRepository } from '../repository';
import type { AgentAuditEventInput } from '../repository/types';

export function recordAgentAudit(repo: AppRepository, input: AgentAuditEventInput) {
  return repo.recordAgentAuditEvent(input);
}
```

- [ ] **Step 4: Implement approval helper**

Create `src/lib/server/agent/approvals.ts` with:

```ts
import type { AppRepository } from '../repository';
import type { AgentRisk } from '../repository/types';
import { agentError, agentOk } from './envelope';

export interface PrepareAgentApprovalInput {
  toolName: string;
  risk: AgentRisk;
  summary: string;
  operation: unknown;
  review: unknown;
  expiresAt: string;
}

export function prepareAgentApproval(repo: AppRepository, input: PrepareAgentApprovalInput) {
  const temporaryConfirmationText = 'pending-confirmation';
  const approval = repo.createAgentApproval({
    toolName: input.toolName,
    risk: input.risk,
    summary: input.summary,
    operationJson: JSON.stringify(input.operation),
    reviewJson: JSON.stringify(input.review),
    confirmationText: temporaryConfirmationText,
    expiresAt: input.expiresAt
  });
  const confirmationText = `${input.risk === 'sends_email' ? 'APPROVE SEND' : 'APPROVE'} ${approval.id}`;
  repo.updateAgentApprovalConfirmationText(approval.id, confirmationText);
  repo.recordAgentAuditEvent({ toolName: input.toolName, risk: input.risk, action: 'prepare', summary: input.summary, status: 'pending' });
  return {
    approvalId: approval.id,
    risk: input.risk,
    summary: input.summary,
    confirmationText,
    expiresAt: input.expiresAt,
    review: input.review,
    warnings: []
  };
}

export function commitPreparedApproval<T>(repo: AppRepository, approvalId: string, confirmationText: string, commit: () => T) {
  const approval = repo.getAgentApproval(approvalId);
  if (!approval) return agentError('not_found', 'Approval was not found.', { approvalId });
  if (approval.status !== 'pending') return agentError('conflict', 'Approval is no longer pending.', { approvalId, status: approval.status });
  if (approval.confirmationText !== confirmationText) return agentError('approval_required', 'Exact confirmation text is required.', { approvalId });
  if (approval.expiresAt < new Date().toISOString()) {
    repo.expireAgentApprovals(new Date().toISOString());
    return agentError('approval_expired', 'Approval has expired.', { approvalId });
  }
  try {
    const result = commit();
    repo.markAgentApprovalCommitted(approvalId, JSON.stringify(result));
    repo.recordAgentAuditEvent({ toolName: approval.toolName, risk: approval.risk, action: 'commit', summary: approval.summary, status: 'committed' });
    return agentOk(result);
  } catch (error) {
    repo.markAgentApprovalFailed(approvalId, JSON.stringify({ message: error instanceof Error ? error.message : String(error) }));
    repo.recordAgentAuditEvent({ toolName: approval.toolName, risk: approval.risk, action: 'commit', summary: approval.summary, status: 'failed' });
    throw error;
  }
}
```

Add `updateAgentApprovalConfirmationText` to repository if this helper uses two-step confirmation generation. Alternatively, generate the id before insert in `prepareAgentApproval` and insert the final confirmation text once.

- [ ] **Step 5: Run tests**

Run:

```bash
npm test -- tests/agent.approvals.test.ts tests/repository.agent.test.ts
npm run check
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add src/lib/server/agent/approvals.ts src/lib/server/agent/audit.ts src/lib/server/repository tests/agent.approvals.test.ts
git commit -m "feat: add agent approval service"
```

## Task 7: Read/Write Workflow Tools For Contacts, Classes, And Templates

**Files:**
- Create: `src/lib/server/agent/tools/contacts.ts`
- Create: `src/lib/server/agent/tools/classes.ts`
- Create: `src/lib/server/agent/tools/templates.ts`
- Create: `tests/agent.contacts.test.ts`
- Create: `tests/agent.classes.test.ts`
- Create: `tests/agent.templates.test.ts`
- Modify: `src/mcp/server.ts`

- [ ] **Step 1: Write permission-denied tests**

Each test file should create a test repo or use existing repository helpers, set default permissions, and assert mutating tools return `agent_permission_denied` while read tools succeed when `viewData` is enabled.

Example for contacts:

```ts
import { describe, expect, it } from 'vitest';
import { createContactTool } from '../src/lib/server/agent/tools/contacts';
import { createTestRepository } from './repository-helpers';

describe('agent contact tools', () => {
  it('denies contact creation when editRecords is disabled', () => {
    const repo = createTestRepository();
    const result = createContactTool(repo, { firstName: 'Jane', lastName: 'Diver', email: 'jane@example.test' });
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('agent_permission_denied');
  });
});
```

- [ ] **Step 2: Implement tool modules**

Use existing repository methods only. Do not add SQL to agent modules.

Contacts:

```ts
import type { AppRepository } from '../../repository';
import type { ContactInput } from '../../repository/types';
import { agentError, agentOk } from '../envelope';
import { getSettings } from '../../settings';

export function searchContactsTool(repo: AppRepository, input: { query?: string; limit?: number }) {
  const settings = getSettings();
  if (!settings.agentPermissions.viewData) return agentError('agent_permission_denied', 'Agents are not allowed to view app data.', { permission: 'viewData' });
  const query = (input.query ?? '').trim().toLowerCase();
  const limit = Math.min(Math.max(input.limit ?? 25, 1), 100);
  const contacts = repo
    .listContacts()
    .filter((contact) => {
      if (!query) return true;
      return [contact.firstName, contact.lastName, contact.email, contact.phone].join(' ').toLowerCase().includes(query);
    })
    .slice(0, limit);
  return agentOk({ contacts, nextCursor: '' }, { labels: settings.vocabulary });
}

export function createContactTool(repo: AppRepository, input: ContactInput) {
  const settings = getSettings();
  if (!settings.agentPermissions.editRecords) return agentError('agent_permission_denied', 'Agents are not allowed to draft or edit records.', { permission: 'editRecords' });
  const contact = repo.createContact(input);
  return agentOk({ contact }, { labels: settings.vocabulary, nextActions: ['get_contact'] });
}

export function updateContactTool(repo: AppRepository, id: string, input: ContactInput) {
  const settings = getSettings();
  if (!settings.agentPermissions.editRecords) return agentError('agent_permission_denied', 'Agents are not allowed to draft or edit records.', { permission: 'editRecords' });
  const contact = repo.updateContact(id, input);
  return agentOk({ contact }, { labels: settings.vocabulary, nextActions: ['get_contact'] });
}
```

Classes and templates follow the same pattern: check permission, call repository/server helper, return `agentOk` with vocabulary labels and next actions.

- [ ] **Step 3: Register MCP tools**

Modify `src/mcp/server.ts` to register contact/class/template tools after the read-only orientation tools. Mutating tool registrations should call the tool helper and return the JSON envelope as text.

- [ ] **Step 4: Run tests**

Run:

```bash
npm test -- tests/agent.contacts.test.ts tests/agent.classes.test.ts tests/agent.templates.test.ts
npm run mcp:build
npm run check
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/lib/server/agent/tools src/mcp/server.ts tests/agent.contacts.test.ts tests/agent.classes.test.ts tests/agent.templates.test.ts
git commit -m "feat: add core agent workflow tools"
```

## Task 8: Campaign And Direct Email Tools With Send Safety

**Files:**
- Create: `src/lib/server/agent/tools/campaigns.ts`
- Create: `src/lib/server/agent/tools/communications.ts`
- Create: `tests/agent.campaigns.test.ts`
- Create: `tests/agent.direct-email.test.ts`
- Modify: `src/mcp/server.ts`
- Modify: `src/lib/server/campaign-email.ts` only if a reusable preview helper must be extracted.
- Modify: `src/lib/server/direct-email.ts` only if a reusable prepare helper must be extracted.
- Modify: `src/lib/server/background.ts` only if `sendDueCampaigns()` needs a safe batch snapshot helper.

- [ ] **Step 1: Write direct email approval tests**

Create tests asserting:

```ts
expect(prepareDirectEmailTool(repo, input).ok).toBe(true);
expect(commitDirectEmailTool(repo, { approvalId, confirmationText: 'wrong' }).error.code).toBe('approval_required');
```

Add cases for do-not-email contacts, missing variables, and communication history.

- [ ] **Step 2: Write campaign send-once tests**

Add tests that seed a campaign with one successful delivery, prepare and commit an MCP send-due operation, and assert the successful recipient is not resent. Mirror patterns from `tests/scheduler.test.ts`, `tests/background.communications.test.ts`, and `tests/repository.campaigns.test.ts`.

- [ ] **Step 3: Implement direct email tools**

`prepare_direct_email`:

- checks `prepareEmail`.
- validates contacts and template variables using existing direct-email/template helpers.
- creates approval with risk `sends_email`.
- includes exact recipients, subject, body preview, skipped do-not-email contacts, and warnings.

`commit_direct_email`:

- checks `sendEmail`.
- calls `commitPreparedApproval`.
- revalidates contacts, do-not-email status, subject/body, and variables.
- calls `sendDirectEmail(...)` from `src/lib/server/direct-email.ts`.
- never calls Nodemailer directly.

- [ ] **Step 4: Implement campaign tools**

Campaign prepare/commit tools must call existing campaign preview/scheduling helpers and repository methods. `commit_send_due_campaigns` must call `sendDueCampaigns()` from `src/lib/server/background.ts` or a shared helper extracted from it. Do not duplicate delivery claim/send/mark logic in MCP code.

- [ ] **Step 5: Register MCP tools**

Register:

```ts
prepare_direct_email
commit_direct_email
prepare_campaign_approval
commit_campaign_approval
prepare_campaign_schedule
commit_campaign_schedule
prepare_send_due_campaigns
commit_send_due_campaigns
```

- [ ] **Step 6: Run send-safety tests**

Run:

```bash
npm test -- tests/agent.campaigns.test.ts tests/agent.direct-email.test.ts tests/scheduler.test.ts tests/background.communications.test.ts tests/direct-email.test.ts tests/mailer.test.ts tests/repository.campaigns.test.ts
npm run mcp:build
npm run check
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add src/lib/server/agent/tools src/mcp/server.ts src/lib/server/campaign-email.ts src/lib/server/direct-email.ts src/lib/server/background.ts tests/agent.campaigns.test.ts tests/agent.direct-email.test.ts
git commit -m "feat: add approval-gated email agent tools"
```

## Task 9: Generic Repo-Local Agent Skills

**Files:**
- Create: `.agents/skills/agent-orientation/SKILL.md`
- Create: `.agents/skills/agent-contacts/SKILL.md`
- Create: `.agents/skills/agent-classes/SKILL.md`
- Create: `.agents/skills/agent-templates/SKILL.md`
- Create: `.agents/skills/agent-campaigns/SKILL.md`
- Create: `.agents/skills/agent-communications/SKILL.md`
- Create: `.agents/skills/agent-settings/SKILL.md`
- Modify: `tests/agent-assets.test.ts`
- Modify: `AGENTS.md`

- [ ] **Step 1: Update agent asset tests**

Modify `tests/agent-assets.test.ts` to include the generic skill paths and assert each skill contains:

```ts
expect(content).toContain('MCP tools');
expect(content).toContain('Do not read or edit runtime database files');
expect(content).toContain('exact confirmation text');
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/agent-assets.test.ts
```

Expected: FAIL because the new skills do not exist.

- [ ] **Step 3: Create skills**

Each skill should include:

```md
## Procedure

1. Call `get_agent_capabilities`.
2. Use MCP tools only.
3. Do not read or edit runtime database files.
4. For risky actions, call `prepare_*`, show the approval packet to the user, and only call `commit_*` with the exact confirmation text returned by the app after the user provides it.
5. Summarize object ids, warnings, skipped recipients, and next actions.
```

Each workflow skill then lists its allowed tools.

- [ ] **Step 4: Update AGENTS.md**

Replace repo-local skill names with generic skill names once they exist. Keep a compatibility note if old `scuba-*` skills remain temporarily.

- [ ] **Step 5: Run tests**

Run:

```bash
npm test -- tests/agent-assets.test.ts
npm run check
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add .agents/skills AGENTS.md tests/agent-assets.test.ts
git commit -m "docs: add generic agent workflow skills"
```

## Task 10: Final Integration And Full Gate

**Files:**
- Modify: `scripts/agent/standards-check.mjs`
- Modify: `docs/AI-MAINTAINER.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `README.md`

- [ ] **Step 1: Add MCP build to agent gate**

Modify `scripts/agent/standards-check.mjs` to run:

```js
await run('npm', ['run', 'mcp:build']);
```

Place it after `npm run check` or before `npm run build`.

- [ ] **Step 2: Update docs**

Ensure docs explain:

- agent access is optional and local-only.
- permissions do not protect against filesystem access granted to a coding agent.
- approval packets are required for schedule/send actions.
- MCP exposes no SQL, database paths, or decrypted secrets.
- settings use searchable collapsible sections.

- [ ] **Step 3: Run complete validation**

Run:

```bash
npm run agent:check
```

Expected: PASS. The gate should include `git diff --check`, `npm test`, `npm run check`, `npm run mcp:build`, and `npm run build`.

- [ ] **Step 4: Manual MCP smoke test**

Run:

```bash
npm run mcp:build
npm run mcp
```

Expected: MCP process starts on stdio. Use an MCP inspector or configured local client to call `get_app_overview`, `get_scheduler_readiness`, and `get_agent_capabilities`. Confirm no decrypted secrets appear.

- [ ] **Step 5: UI inspection**

Run:

```bash
npm run dev:agent:seed
npm run dev:agent
```

Inspect `/settings` on desktop and mobile. Confirm search filters sections, collapsible sections are usable, and grouped saves do not rewrite unrelated settings.

- [ ] **Step 6: Commit**

Run:

```bash
git add scripts/agent/standards-check.mjs docs README.md
git commit -m "chore: add mcp validation to agent gate"
```

## Parallel Execution Order

Start with Task 1. After Task 1 lands:

- Task 2 can run independently.
- A MCP worker can start Task 4 after Task 2 exposes permissions/vocabulary.
- An approval worker can start Task 5 after Task 1; it does not need Task 3 or Task 4.
- Task 3 should wait for Task 2.
- Task 6 waits for Task 5.
- Task 7 waits for Task 4 and Task 2.
- Task 8 waits for Task 6 and Task 7.
- Task 9 waits for tool names from Tasks 4, 7, and 8.
- Task 10 is final integration only.

## Review Checkpoints

Before merging each workstream:

- Confirm no MCP code imports browser-only modules.
- Confirm no route or MCP tool contains raw SQL.
- Confirm no MCP response includes decrypted secrets.
- Confirm send-related MCP tools call existing send helpers rather than duplicating loops.
- Confirm disabled permissions return `agent_permission_denied`.
- Confirm risky commits require exact confirmation text.

## Verification Matrix

Minimum per slice:

```bash
npm run check
```

MCP slices:

```bash
npm run mcp:build
npm test -- tests/agent-envelope.test.ts tests/agent-orientation.test.ts
```

Send-safety slices:

```bash
npm test -- tests/agent.campaigns.test.ts tests/agent.direct-email.test.ts tests/scheduler.test.ts tests/background.communications.test.ts tests/direct-email.test.ts tests/mailer.test.ts
```

Final:

```bash
npm run agent:check
```
