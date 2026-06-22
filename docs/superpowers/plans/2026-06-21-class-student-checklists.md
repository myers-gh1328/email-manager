# Class Student Checklists Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-student class checklist tracking backed by global and course-type checklist definitions.

**Architecture:** SQLite owns checklist definitions and completion rows through repository methods. The classes route manages checklist definitions, and class detail renders/toggles per-student checklist completion for enrolled students. Definitions are live, so existing classes use the current global and course-type definitions without snapshotting.

**Tech Stack:** SvelteKit 2, Svelte 5, TypeScript, `node:sqlite` `DatabaseSync`, Vitest.

---

## File Structure

- Modify `src/lib/server/repository/schema.ts`: create checklist tables during migration.
- Create `src/lib/server/repository/checklists.ts`: checklist SQL, row mapping local to checklist behavior, completion toggles.
- Modify `src/lib/server/repository/types.ts`: checklist input/result types.
- Modify `src/lib/server/repository/index.ts`: expose checklist repository methods and types.
- Modify `src/routes/classes/+page.server.ts`: load and mutate global/course-type checklist definitions.
- Modify `src/routes/classes/+page.svelte`: add checklist management forms.
- Modify `src/routes/classes/[id]/+page.server.ts`: load per-enrollment checklist state and add toggle action.
- Modify `src/routes/classes/[id]/+page.svelte`: render per-student checklist controls.
- Modify `tests/repository.contacts.test.ts`: repository behavior tests for checklist definitions and completion.
- Modify `tests/operator-visibility-contract.test.ts`: route contract for class checklist load/action.
- Modify `docs/ARCHITECTURE.md`: document checklist tables and class roster visibility.

---

### Task 1: Repository Checklist Persistence

**Files:**
- Modify: `src/lib/server/repository/schema.ts`
- Create: `src/lib/server/repository/checklists.ts`
- Modify: `src/lib/server/repository/types.ts`
- Modify: `src/lib/server/repository/index.ts`
- Test: `tests/repository.contacts.test.ts`

- [ ] **Step 1: Write failing repository tests**

Add these tests to `tests/repository.contacts.test.ts` inside the existing `describe('repository contacts and classes', () => { ... })` block:

```ts
  test('manages global checklist items in order', () => {
    const repo = createTestRepository();

    const first = repo.createChecklistItem({ label: 'Medical form complete' });
    const second = repo.createChecklistItem({ label: 'Academics complete' });
    const updated = repo.updateChecklistItem(second.id, { label: 'Academic review complete' });

    expect(updated).toMatchObject({ id: second.id, label: 'Academic review complete', sortOrder: 1 });
    expect(repo.listChecklistItems()).toMatchObject([
      { id: first.id, label: 'Medical form complete', scope: 'global', sortOrder: 0 },
      { id: second.id, label: 'Academic review complete', scope: 'global', sortOrder: 1 }
    ]);
  });

  test('combines global and course-type checklist items for a class', () => {
    const repo = createTestRepository();
    const course = repo.createCourseType({ name: 'Open Water' });
    const otherCourse = repo.createCourseType({ name: 'Rescue Diver' });
    const session = repo.createClassSession({ courseTypeId: course.id, startsOn: '2026-07-12', location: 'Blue Quarry' });
    const globalItem = repo.createChecklistItem({ label: 'Global item' });
    const courseItem = repo.createCourseTypeChecklistItem({ courseTypeId: course.id, label: 'Course item' });
    repo.createCourseTypeChecklistItem({ courseTypeId: otherCourse.id, label: 'Other course item' });

    expect(repo.listChecklistForClassSession(session.id)).toMatchObject([
      { id: globalItem.id, label: 'Global item', scope: 'global', sortOrder: 0 },
      { id: courseItem.id, label: 'Course item', scope: 'course_type', courseTypeId: course.id, sortOrder: 0 }
    ]);
  });

  test('tracks checklist completion per student and class', () => {
    const repo = createTestRepository();
    const course = repo.createCourseType({ name: 'Open Water' });
    const firstClass = repo.createClassSession({ courseTypeId: course.id, startsOn: '2026-07-12', location: 'Blue Quarry' });
    const secondClass = repo.createClassSession({ courseTypeId: course.id, startsOn: '2026-08-12', location: 'Blue Quarry' });
    const maya = repo.createContact({ firstName: 'Maya', lastName: 'Patel', email: 'maya@example.com' });
    const jordan = repo.createContact({ firstName: 'Jordan', lastName: 'Lee', email: 'jordan@example.com' });
    repo.enrollContact(firstClass.id, maya.id);
    repo.enrollContact(firstClass.id, jordan.id);
    repo.enrollContact(secondClass.id, maya.id);
    const item = repo.createChecklistItem({ label: 'Medical form complete' });

    repo.setEnrollmentChecklistCompletion({
      classSessionId: firstClass.id,
      contactId: maya.id,
      itemScope: 'global',
      itemId: item.id,
      completed: true
    });

    expect(repo.listEnrollmentChecklistState(firstClass.id)).toMatchObject([
      { contactId: jordan.id, itemId: item.id, itemScope: 'global', completed: false },
      { contactId: maya.id, itemId: item.id, itemScope: 'global', completed: true }
    ]);
    expect(repo.listEnrollmentChecklistState(secondClass.id)).toMatchObject([
      { contactId: maya.id, itemId: item.id, itemScope: 'global', completed: false }
    ]);
  });

  test('deleting checklist definitions removes completion state', () => {
    const repo = createTestRepository();
    const course = repo.createCourseType({ name: 'Open Water' });
    const session = repo.createClassSession({ courseTypeId: course.id, startsOn: '2026-07-12', location: 'Blue Quarry' });
    const contact = repo.createContact({ firstName: 'Maya', lastName: 'Patel', email: 'maya@example.com' });
    repo.enrollContact(session.id, contact.id);
    const globalItem = repo.createChecklistItem({ label: 'Medical form complete' });
    const courseItem = repo.createCourseTypeChecklistItem({ courseTypeId: course.id, label: 'Academics complete' });
    repo.setEnrollmentChecklistCompletion({ classSessionId: session.id, contactId: contact.id, itemScope: 'global', itemId: globalItem.id, completed: true });
    repo.setEnrollmentChecklistCompletion({ classSessionId: session.id, contactId: contact.id, itemScope: 'course_type', itemId: courseItem.id, completed: true });

    repo.deleteChecklistItem(globalItem.id);
    repo.deleteCourseTypeChecklistItem(courseItem.id);

    expect(repo.listChecklistForClassSession(session.id)).toEqual([]);
    expect(repo.listEnrollmentChecklistState(session.id)).toEqual([]);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/repository.contacts.test.ts`

Expected: FAIL with TypeScript/runtime errors that checklist repository methods do not exist.

- [ ] **Step 3: Add checklist types**

Add these interfaces to `src/lib/server/repository/types.ts`:

```ts
export type ChecklistItemScope = 'global' | 'course_type';

export interface ChecklistItemInput {
  label: string;
}

export interface CourseTypeChecklistItemInput {
  courseTypeId: string;
  label: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  scope: ChecklistItemScope;
  courseTypeId?: string;
  sortOrder: number;
  createdAt: string;
}

export interface EnrollmentChecklistCompletionInput {
  classSessionId: string;
  contactId: string;
  itemScope: ChecklistItemScope;
  itemId: string;
  completed: boolean;
}

export interface EnrollmentChecklistState {
  classSessionId: string;
  contactId: string;
  contactName: string;
  contactEmail: string;
  itemScope: ChecklistItemScope;
  itemId: string;
  label: string;
  sortOrder: number;
  completed: boolean;
}
```

- [ ] **Step 4: Add schema tables**

In `src/lib/server/repository/schema.ts`, add these tables inside the main `db.exec` migration block:

```sql
    create table if not exists checklist_items (
      id text primary key,
      label text not null,
      sort_order integer not null default 0,
      created_at text not null
    );

    create table if not exists course_type_checklist_items (
      id text primary key,
      course_type_id text not null references course_types(id) on delete cascade,
      label text not null,
      sort_order integer not null default 0,
      created_at text not null
    );

    create table if not exists enrollment_checklist_completions (
      class_session_id text not null references class_sessions(id) on delete cascade,
      contact_id text not null references contacts(id) on delete cascade,
      item_scope text not null,
      item_id text not null,
      completed_at text not null,
      primary key (class_session_id, contact_id, item_scope, item_id),
      foreign key (class_session_id, contact_id) references enrollments(class_session_id, contact_id) on delete cascade
    );
```

- [ ] **Step 5: Implement checklist repository module**

Create `src/lib/server/repository/checklists.ts` with:

```ts
import type { DatabaseSync } from 'node:sqlite';
import { newId, now } from './ids';
import type {
  ChecklistItem,
  ChecklistItemInput,
  ChecklistItemScope,
  CourseTypeChecklistItemInput,
  EnrollmentChecklistCompletionInput,
  EnrollmentChecklistState,
  Row
} from './types';

export function createChecklistItem(db: DatabaseSync, input: ChecklistItemInput) {
  const id = newId();
  db.prepare('insert into checklist_items (id, label, sort_order, created_at) values (?, ?, ?, ?)')
    .run(id, input.label.trim(), nextGlobalSortOrder(db), now());
  return getChecklistItem(db, id);
}

export function updateChecklistItem(db: DatabaseSync, id: string, input: ChecklistItemInput) {
  db.prepare('update checklist_items set label = ? where id = ?').run(input.label.trim(), id);
  return getChecklistItem(db, id);
}

export function deleteChecklistItem(db: DatabaseSync, id: string) {
  db.prepare("delete from enrollment_checklist_completions where item_scope = 'global' and item_id = ?").run(id);
  db.prepare('delete from checklist_items where id = ?').run(id);
}

export function listChecklistItems(db: DatabaseSync): ChecklistItem[] {
  return db.prepare('select * from checklist_items order by sort_order, created_at, label').all().map(mapGlobalChecklistItem);
}

export function createCourseTypeChecklistItem(db: DatabaseSync, input: CourseTypeChecklistItemInput) {
  const id = newId();
  db.prepare('insert into course_type_checklist_items (id, course_type_id, label, sort_order, created_at) values (?, ?, ?, ?, ?)')
    .run(id, input.courseTypeId, input.label.trim(), nextCourseTypeSortOrder(db, input.courseTypeId), now());
  return getCourseTypeChecklistItem(db, id);
}

export function updateCourseTypeChecklistItem(db: DatabaseSync, id: string, input: ChecklistItemInput) {
  db.prepare('update course_type_checklist_items set label = ? where id = ?').run(input.label.trim(), id);
  return getCourseTypeChecklistItem(db, id);
}

export function deleteCourseTypeChecklistItem(db: DatabaseSync, id: string) {
  db.prepare("delete from enrollment_checklist_completions where item_scope = 'course_type' and item_id = ?").run(id);
  db.prepare('delete from course_type_checklist_items where id = ?').run(id);
}

export function listCourseTypeChecklistItems(db: DatabaseSync, courseTypeId: string): ChecklistItem[] {
  return db
    .prepare('select * from course_type_checklist_items where course_type_id = ? order by sort_order, created_at, label')
    .all(courseTypeId)
    .map(mapCourseTypeChecklistItem);
}

export function listChecklistForClassSession(db: DatabaseSync, classSessionId: string): ChecklistItem[] {
  const globalItems = listChecklistItems(db);
  const courseRow = db.prepare('select course_type_id from class_sessions where id = ?').get(classSessionId) as Row | undefined;
  if (!courseRow) throw new Error(`Class session not found: ${classSessionId}`);
  return [...globalItems, ...listCourseTypeChecklistItems(db, String(courseRow.course_type_id))];
}

export function listEnrollmentChecklistState(db: DatabaseSync, classSessionId: string): EnrollmentChecklistState[] {
  const items = listChecklistForClassSession(db, classSessionId);
  if (items.length === 0) return [];
  const roster = db
    .prepare(
      `select c.id, c.first_name, c.last_name, c.email
       from contacts c
       join enrollments e on e.contact_id = c.id
       where e.class_session_id = ?
       order by c.last_name, c.first_name`
    )
    .all(classSessionId) as Row[];
  const completionRows = db
    .prepare('select item_scope, item_id from enrollment_checklist_completions where class_session_id = ?')
    .all(classSessionId) as Row[];
  const completed = new Set(completionRows.map((row) => `${row.item_scope}:${row.item_id}`));
  return roster.flatMap((contact) =>
    items.map((item) => ({
      classSessionId,
      contactId: String(contact.id),
      contactName: `${contact.first_name} ${contact.last_name}`,
      contactEmail: String(contact.email),
      itemScope: item.scope,
      itemId: item.id,
      label: item.label,
      sortOrder: item.sortOrder,
      completed: completed.has(`${item.scope}:${item.id}`) && completionBelongsToContact(db, classSessionId, String(contact.id), item.scope, item.id)
    }))
  );
}

export function setEnrollmentChecklistCompletion(db: DatabaseSync, input: EnrollmentChecklistCompletionInput) {
  if (!checklistItemExists(db, input.itemScope, input.itemId)) {
    db.prepare('delete from enrollment_checklist_completions where class_session_id = ? and contact_id = ? and item_scope = ? and item_id = ?')
      .run(input.classSessionId, input.contactId, input.itemScope, input.itemId);
    return;
  }
  if (!input.completed) {
    db.prepare('delete from enrollment_checklist_completions where class_session_id = ? and contact_id = ? and item_scope = ? and item_id = ?')
      .run(input.classSessionId, input.contactId, input.itemScope, input.itemId);
    return;
  }
  db.prepare(
    `insert into enrollment_checklist_completions (class_session_id, contact_id, item_scope, item_id, completed_at)
     values (?, ?, ?, ?, ?)
     on conflict(class_session_id, contact_id, item_scope, item_id) do update set completed_at = excluded.completed_at`
  ).run(input.classSessionId, input.contactId, input.itemScope, input.itemId, now());
}

function getChecklistItem(db: DatabaseSync, id: string) {
  const row = db.prepare('select * from checklist_items where id = ?').get(id) as Row | undefined;
  if (!row) throw new Error(`Checklist item not found: ${id}`);
  return mapGlobalChecklistItem(row);
}

function getCourseTypeChecklistItem(db: DatabaseSync, id: string) {
  const row = db.prepare('select * from course_type_checklist_items where id = ?').get(id) as Row | undefined;
  if (!row) throw new Error(`Course type checklist item not found: ${id}`);
  return mapCourseTypeChecklistItem(row);
}

function nextGlobalSortOrder(db: DatabaseSync) {
  const row = db.prepare('select coalesce(max(sort_order), -1) + 1 as next_sort_order from checklist_items').get() as Row;
  return Number(row.next_sort_order);
}

function nextCourseTypeSortOrder(db: DatabaseSync, courseTypeId: string) {
  const row = db
    .prepare('select coalesce(max(sort_order), -1) + 1 as next_sort_order from course_type_checklist_items where course_type_id = ?')
    .get(courseTypeId) as Row;
  return Number(row.next_sort_order);
}

function checklistItemExists(db: DatabaseSync, scope: ChecklistItemScope, itemId: string) {
  const table = scope === 'global' ? 'checklist_items' : 'course_type_checklist_items';
  return Boolean(db.prepare(`select id from ${table} where id = ?`).get(itemId));
}

function completionBelongsToContact(db: DatabaseSync, classSessionId: string, contactId: string, itemScope: ChecklistItemScope, itemId: string) {
  return Boolean(
    db
      .prepare(
        'select 1 from enrollment_checklist_completions where class_session_id = ? and contact_id = ? and item_scope = ? and item_id = ?'
      )
      .get(classSessionId, contactId, itemScope, itemId)
  );
}

function mapGlobalChecklistItem(row: Row): ChecklistItem {
  return {
    id: String(row.id),
    label: String(row.label),
    scope: 'global',
    sortOrder: Number(row.sort_order),
    createdAt: String(row.created_at)
  };
}

function mapCourseTypeChecklistItem(row: Row): ChecklistItem {
  return {
    id: String(row.id),
    courseTypeId: String(row.course_type_id),
    label: String(row.label),
    scope: 'course_type',
    sortOrder: Number(row.sort_order),
    createdAt: String(row.created_at)
  };
}
```

- [ ] **Step 6: Wire repository index**

In `src/lib/server/repository/index.ts`, import checklist functions from `./checklists`, import and export checklist types from `./types`, and add matching `AppRepository` methods:

```ts
  createChecklistItem(input: ChecklistItemInput) {
    return createChecklistItem(this.db, input);
  }

  updateChecklistItem(id: string, input: ChecklistItemInput) {
    return updateChecklistItem(this.db, id, input);
  }

  deleteChecklistItem(id: string) {
    return deleteChecklistItem(this.db, id);
  }

  listChecklistItems() {
    return listChecklistItems(this.db);
  }

  createCourseTypeChecklistItem(input: CourseTypeChecklistItemInput) {
    return createCourseTypeChecklistItem(this.db, input);
  }

  updateCourseTypeChecklistItem(id: string, input: ChecklistItemInput) {
    return updateCourseTypeChecklistItem(this.db, id, input);
  }

  deleteCourseTypeChecklistItem(id: string) {
    return deleteCourseTypeChecklistItem(this.db, id);
  }

  listCourseTypeChecklistItems(courseTypeId: string) {
    return listCourseTypeChecklistItems(this.db, courseTypeId);
  }

  listChecklistForClassSession(classSessionId: string) {
    return listChecklistForClassSession(this.db, classSessionId);
  }

  listEnrollmentChecklistState(classSessionId: string) {
    return listEnrollmentChecklistState(this.db, classSessionId);
  }

  setEnrollmentChecklistCompletion(input: EnrollmentChecklistCompletionInput) {
    return setEnrollmentChecklistCompletion(this.db, input);
  }
```

- [ ] **Step 7: Run repository tests**

Run: `npm test -- tests/repository.contacts.test.ts`

Expected: PASS.

---

### Task 2: Classes Route And UI

**Files:**
- Modify: `src/routes/classes/+page.server.ts`
- Modify: `src/routes/classes/+page.svelte`
- Modify: `src/routes/classes/[id]/+page.server.ts`
- Modify: `src/routes/classes/[id]/+page.svelte`
- Test: `tests/operator-visibility-contract.test.ts`

- [ ] **Step 1: Write failing route contract test**

Add assertions to `tests/operator-visibility-contract.test.ts` in `keeps implementation hooks for documented visibility requirements`:

```ts
    expect(readFileSync('src/routes/classes/+page.server.ts', 'utf8')).toContain('checklistItems: repo.listChecklistItems()');
    expect(readFileSync('src/routes/classes/[id]/+page.server.ts', 'utf8')).toContain('checklistState: repo.listEnrollmentChecklistState(params.id)');
    expect(readFileSync('src/routes/classes/[id]/+page.server.ts', 'utf8')).toContain('toggleChecklistItem');
```

- [ ] **Step 2: Run contract test to verify it fails**

Run: `npm test -- tests/operator-visibility-contract.test.ts`

Expected: FAIL because route hooks are not present.

- [ ] **Step 3: Load and mutate checklist definitions on `/classes`**

In `src/routes/classes/+page.server.ts`, add to the load return object:

```ts
    checklistItems: repo.listChecklistItems(),
```

When `selectedCourseId` is present, add:

```ts
    selectedCourseChecklistItems: selectedCourseId ? repo.listCourseTypeChecklistItems(selectedCourseId) : [],
```

Add actions:

```ts
  createChecklistItem: async ({ request }) => {
    const form = await request.formData();
    repo.createChecklistItem({ label: required(form, 'label') });
    return { message: 'Checklist item added.' };
  },
  updateChecklistItem: async ({ request }) => {
    const form = await request.formData();
    repo.updateChecklistItem(required(form, 'itemId'), { label: required(form, 'label') });
    return { message: 'Checklist item updated.' };
  },
  deleteChecklistItem: async ({ request }) => {
    const form = await request.formData();
    repo.deleteChecklistItem(required(form, 'itemId'));
    return { message: 'Checklist item deleted.' };
  },
  createCourseTypeChecklistItem: async ({ request }) => {
    const form = await request.formData();
    repo.createCourseTypeChecklistItem({ courseTypeId: required(form, 'courseId'), label: required(form, 'label') });
    return { message: 'Course checklist item added.' };
  },
  updateCourseTypeChecklistItem: async ({ request }) => {
    const form = await request.formData();
    repo.updateCourseTypeChecklistItem(required(form, 'itemId'), { label: required(form, 'label') });
    return { message: 'Course checklist item updated.' };
  },
  deleteCourseTypeChecklistItem: async ({ request }) => {
    const form = await request.formData();
    repo.deleteCourseTypeChecklistItem(required(form, 'itemId'));
    return { message: 'Course checklist item deleted.' };
  },
```

- [ ] **Step 4: Add checklist management UI to `/classes`**

In `src/routes/classes/+page.svelte`, add a `panel-form` under the top action row:

```svelte
    <section class="panel-form">
      <h3>Checklist defaults</h3>
      <div class="list compact-list">
        {#each data.checklistItems as item}
          <article class="row-card">
            <form method="POST" action="?/updateChecklistItem" class="inline-edit-form" use:enhance>
              <input name="itemId" type="hidden" value={item.id} />
              <label>Item<input name="label" value={item.label} required /></label>
              <button type="submit">Save</button>
            </form>
            <form method="POST" action="?/deleteChecklistItem" use:enhance>
              <input name="itemId" type="hidden" value={item.id} />
              <button class="secondary" type="submit">Delete</button>
            </form>
          </article>
        {:else}
          <p class="empty">No global checklist items yet.</p>
        {/each}
      </div>
      <form method="POST" action="?/createChecklistItem" class="inline-edit-form" use:enhance>
        <label>New item<input name="label" required /></label>
        <button type="submit">Add item</button>
      </form>
    </section>
```

Inside the `data.selectedCourse` branch after the course edit form, add:

```svelte
        <form method="POST" action="?/createCourseTypeChecklistItem" class="panel-form" use:enhance>
          <h3>Additional checklist items</h3>
          <input name="courseId" type="hidden" value={data.selectedCourse.id} />
          <div class="list compact-list">
            {#each data.selectedCourseChecklistItems as item}
              <article class="row-card">
                <div>
                  <strong>{item.label}</strong>
                  <p>Applies to this course type.</p>
                </div>
                <div class="button-row">
                  <form method="POST" action="?/deleteCourseTypeChecklistItem" use:enhance>
                    <input name="itemId" type="hidden" value={item.id} />
                    <button class="secondary" type="submit">Delete</button>
                  </form>
                </div>
              </article>
            {:else}
              <p class="empty">No additional checklist items for this course type.</p>
            {/each}
          </div>
          <label>New item<input name="label" required /></label>
          <button type="submit">Add course item</button>
        </form>
```

If nested forms cause invalid HTML in review, replace each listed item with separate sibling update/delete forms.

- [ ] **Step 5: Load and toggle checklist state on class detail**

In `src/routes/classes/[id]/+page.server.ts`, add to load return:

```ts
  checklistState: repo.listEnrollmentChecklistState(params.id),
```

Add action:

```ts
  toggleChecklistItem: async ({ params, request }) => {
    const form = await request.formData();
    repo.setEnrollmentChecklistCompletion({
      classSessionId: params.id,
      contactId: required(form, 'contactId'),
      itemScope: required(form, 'itemScope') === 'course_type' ? 'course_type' : 'global',
      itemId: required(form, 'itemId'),
      completed: text(form, 'completed') === 'true'
    });
    return { message: 'Checklist updated.' };
  },
```

- [ ] **Step 6: Render checklist per student**

In `src/routes/classes/[id]/+page.svelte`, add helper:

```ts
  function checklistForContact(contactId: string) {
    return data.checklistState.filter((item) => item.contactId === contactId);
  }
```

Inside each roster `row-card`, under the email paragraph, add:

```svelte
            {@const checklist = checklistForContact(contact.id)}
            {#if checklist.length}
              <div class="student-checklist">
                {#each checklist as item}
                  <form method="POST" action="?/toggleChecklistItem" use:enhance>
                    <input name="contactId" type="hidden" value={contact.id} />
                    <input name="itemScope" type="hidden" value={item.itemScope} />
                    <input name="itemId" type="hidden" value={item.itemId} />
                    <input name="completed" type="hidden" value={item.completed ? 'false' : 'true'} />
                    <button class:good={item.completed} class="checklist-toggle" type="submit">
                      <span aria-hidden="true">{item.completed ? '✓' : '□'}</span>
                      {item.label}
                    </button>
                  </form>
                {/each}
              </div>
            {/if}
```

Add local styles:

```svelte
<style>
  .student-checklist {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 10px;
  }

  .checklist-toggle {
    min-height: 36px;
  }
</style>
```

- [ ] **Step 7: Run route contract test**

Run: `npm test -- tests/operator-visibility-contract.test.ts`

Expected: PASS.

---

### Task 3: Documentation And Verification

**Files:**
- Modify: `docs/ARCHITECTURE.md`

- [ ] **Step 1: Document checklist model**

In `docs/ARCHITECTURE.md`, add checklist bullets to Data Model:

```md
- Checklist items store global and course-type class preparation requirements.
- Enrollment checklist completions store per-student checklist state for a class.
```

Add an Operator Visibility bullet:

```md
- Class detail must show per-student checklist state using global checklist items plus course-type checklist items.
```

- [ ] **Step 2: Run focused tests**

Run:

```bash
npm test -- tests/repository.contacts.test.ts tests/operator-visibility-contract.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run CI-equivalent gate**

Run:

```bash
npm run agent:check
```

Expected: PASS.
