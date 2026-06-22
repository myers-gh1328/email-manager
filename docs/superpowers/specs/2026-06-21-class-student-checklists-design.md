# Class Student Checklists Design

## Goal

Add checklist tracking for each student enrolled in a class. Checklist definitions come from a generic global list plus additional items configured per course type. Completion state is always per student enrollment.

## Requirements

- Instructors can manage a generic checklist list that applies to every class.
- Instructors can manage additional checklist items for a course type.
- A class roster shows the combined checklist for each enrolled student: global items first, then that class's course-type items.
- Checking an item for one student affects only that student in that class.
- Definition changes apply to all existing classes immediately.
- Removing a checklist definition deletes completion state for that item.
- Checklist item labels are user-defined text. The app does not ship fixed item names.
- Checklist persistence stays in the repository layer. Routes do not own SQL.

## Data Model

Create three SQLite tables:

- `checklist_items`: global checklist definitions.
- `course_type_checklist_items`: course-type-specific checklist definitions.
- `enrollment_checklist_completions`: per-student completion records for a class enrollment and checklist item.

Completion records identify the item by scope and item id:

- `item_scope`: `global` or `course_type`.
- `item_id`: the id from the matching definition table.

The completion table uses a unique key on `class_session_id`, `contact_id`, `item_scope`, and `item_id`. Foreign keys to `class_sessions` and `contacts` delete completion rows when an enrollment's class or contact is removed. Definition delete helpers explicitly delete matching completion rows before deleting the definition.

## Repository API

Expose focused repository methods:

- `createChecklistItem({ label })`
- `updateChecklistItem(id, { label })`
- `deleteChecklistItem(id)`
- `listChecklistItems()`
- `createCourseTypeChecklistItem({ courseTypeId, label })`
- `updateCourseTypeChecklistItem(id, { label })`
- `deleteCourseTypeChecklistItem(id)`
- `listCourseTypeChecklistItems(courseTypeId)`
- `listChecklistForClassSession(classSessionId)`
- `listEnrollmentChecklistState(classSessionId)`
- `setEnrollmentChecklistCompletion({ classSessionId, contactId, itemScope, itemId, completed })`

`listChecklistForClassSession` returns the combined global and course-type item definitions for the class. `listEnrollmentChecklistState` returns one row per roster student and applicable checklist item, including `completed`.

## UI

`/classes` gains global checklist management near the class workflow, visible as a separate checklist defaults section. Course-type edit gains an additional checklist item section beside existing course-type editing and default email settings.

`/classes/[id]` shows checklist controls inside each roster student's card. Each checkbox submits one small form for that student/item state, preserving the current route and leaving unrelated student state untouched.

## Validation And Error Handling

Checklist labels are required after trimming. Empty labels fail through the existing required-form helper. Unknown class, contact, or item ids surface as normal repository/action errors. Toggling an item that no longer exists should remove any stale completion row when set to incomplete and avoid creating a completion row when the item definition is missing.

## Testing

Add repository coverage for:

- Global checklist CRUD and ordering.
- Course-type checklist CRUD and ordering.
- Combined class checklist includes global and class course-type items.
- Completion state is per student and per class.
- Deleting a definition removes completion records.

Add route contract coverage that class detail load includes checklist state and the class page has a checklist toggle action.

## Out Of Scope

- Due dates, notes, file uploads, reminders, or audit history for checklist items.
- Fixed scuba-specific checklist item names.
- Checklist state in campaign/template rendering.
