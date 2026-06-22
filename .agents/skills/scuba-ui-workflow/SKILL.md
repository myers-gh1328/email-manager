---
name: scuba-ui-workflow
description: Use when changing Svelte route pages, layout, navigation, forms, responsive behavior, workflow grouping, or visible scheduler/email state.
paths:
  - "src/routes/**/*.svelte"
  - "src/routes/**/+page.server.ts"
  - "src/lib/**/*.svelte"
  - "src/styles.css"
  - "tests/*contract*.test.ts"
  - "docs/AGENT-DEV-ENV.md"
---

# Scuba UI Workflow

## When To Use

Use this skill for user-facing route changes, navigation changes, form placement, responsive layout, design polish, and any change that affects whether an instructor can understand send state.

Do not use it for purely server-only changes that have no visible workflow impact.

## Procedure

1. Read `AGENTS.md` route boundaries and `docs/AGENT-DEV-ENV.md`.
2. Start the seeded agent environment when browser inspection is needed:
   - `npm run dev:agent:seed`
   - `npm run dev:agent`
3. Inspect affected pages with `agent-browser`, including a mobile viewport when layout or navigation changes.
4. Keep edit forms near the data they modify. Avoid dumping all edit forms into a detached right-side column.
5. Group controls by workflow and submit only the group being changed.
6. Use contextual tags, helper controls, and status chips only where they explain the current workflow.
7. Preserve dark-mode support and responsive navigation.
8. Add or update contract tests when behavior can be protected without brittle markup snapshots.
9. Run `npm run agent:check` before claiming completion.

## Required UI Contracts

- The nav collapses on small screens and uses an icon affordance.
- Test audit navigation is only visible while email test mode is enabled.
- Settings are grouped by operational concern.
- Class detail shows inherited course-type defaults and actual scheduled emails.
- Communications shows complete outbound history.
- Scheduler readiness is visible on the dashboard.
- Template tags are contextual to template editing, not free-floating page clutter.

## Evidence

For layout or navigation changes, report the pages inspected and whether desktop and mobile states were checked. Screenshots are useful when the issue is visual.
