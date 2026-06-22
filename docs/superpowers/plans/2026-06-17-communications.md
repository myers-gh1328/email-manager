# Communications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a direct email workflow and shared per-contact outbound communication history.

**Architecture:** Add a repository-owned `communications` table and helper methods. Direct email sends and campaign delivery attempts write one communication row per recipient. A new SvelteKit `/communications` page provides compose, preview, send, and history filtering.

**Tech Stack:** SvelteKit 2, Svelte 5, TypeScript, `node:sqlite` `DatabaseSync`, Vitest, Nodemailer.

---

### Task 1: Repository Communication Log

**Files:**
- Modify: `src/lib/server/repository/schema.ts`
- Modify: `src/lib/server/repository/types.ts`
- Create: `src/lib/server/repository/communications.ts`
- Modify: `src/lib/server/repository/index.ts`
- Test: existing repository test file under `src/**/*.test.ts` or `tests/**/*.test.ts`

- [ ] Write failing tests proving communication rows can be created and listed by contact with most recent first.
- [ ] Run the targeted test and confirm it fails because repository communication methods do not exist.
- [ ] Add `communications` schema with one row per recipient.
- [ ] Add `CommunicationInput`, `CommunicationHistoryItem`, and repository methods `recordCommunication`, `listCommunications`, and `listContactCommunications`.
- [ ] Run the targeted test and confirm it passes.

### Task 2: Campaign Communication Logging

**Files:**
- Modify: `src/lib/server/background.ts`
- Test: existing background or repository test file

- [ ] Write a failing test proving a campaign success records a communication row tied to the recipient.
- [ ] Run the targeted test and confirm it fails because campaign sending does not record communications.
- [ ] After `sendEmail` succeeds, record a `sent` campaign communication with rendered subject/body and provider message.
- [ ] When `sendEmail` throws, record a `failed` campaign communication with rendered subject/body and error message.
- [ ] Run the targeted test and confirm it passes.

### Task 3: Direct Email Server Workflow

**Files:**
- Create: `src/lib/server/direct-email.ts`
- Modify: `src/lib/server/page-data.ts`
- Create: `src/routes/communications/+page.server.ts`
- Test: direct email unit test under existing test layout

- [ ] Write failing tests for direct preview and send: multiple contacts render personalized subject/body, `doNotEmail` recipients are blocked, and each attempted recipient creates a communication row.
- [ ] Run the targeted test and confirm it fails because direct email helpers do not exist.
- [ ] Add server helper functions for direct preview/send using existing template rendering and mailer.
- [ ] Add `/communications` load data and actions: `previewDirectEmail`, `sendDirectEmail`, and history filter support.
- [ ] Run the targeted test and confirm it passes.

### Task 4: Communications UI

**Files:**
- Modify: `src/routes/+layout.svelte`
- Create: `src/routes/communications/+page.svelte`
- Modify: global styles if the repo has a shared stylesheet

- [ ] Add a nav link for `Communications`.
- [ ] Build composer controls for recipients, optional template, subject, body, preview, and send.
- [ ] Build history filter and history rows with recipient, timestamp, source, status, subject, and body.
- [ ] Make disabled/do-not-email state visible without allowing accidental direct sends.
- [ ] Run `npm run check` and fix Svelte/TypeScript issues.

### Task 5: Full Verification

**Files:**
- No production file changes expected unless verification finds defects.

- [ ] Run `npm test`.
- [ ] Run `npm run check`.
- [ ] Run `npm run build`.
- [ ] Inspect `git diff` for unrelated changes, secrets, and data files.
