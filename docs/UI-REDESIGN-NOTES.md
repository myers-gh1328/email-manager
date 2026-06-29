# UI Redesign Notes

Audience: maintainers and design agents.

These notes capture page-by-page product and usability fixes before the UI is
changed. They are intentionally blunt about current workflow problems so future
implementation work can preserve the app's safety guarantees while making the
pages easier for non-technical operators to understand.

## Cross-Cutting List And Picker Rules

### Pagination And Search

- Any history, audit, campaign, contact, or email list that can grow beyond a
  small setup list must be paginated.
- Large lists must have search.
- Search should be server-side when the underlying dataset can grow into the
  hundreds or thousands.
- Do not render thousands of rows or full email bodies in default list views.
- Default list rows should be summaries. Details belong behind a selected item,
  detail route, drawer, or modal.

### Contact/User Selection

- Do not use plain select boxes for contacts/users.
- Contact/user pickers become unmanageable quickly as the address book grows.
- Use a searchable multi-select for any workflow where the operator chooses one
  or more contacts.
- Use the same shared picker component across pages instead of rebuilding
  slightly different selectors in each route.
- The shared component should support:
  - search by name and email
  - selected recipient chips
  - keyboard navigation
  - empty state
  - disabled/do-not-email indication
  - single-select mode where a workflow truly needs exactly one contact
  - multi-select mode for email recipients and enrollment workflows

### Data-Backed Dropdowns

- Any dropdown or picker populated from user-managed app data should include an
  "Add new" path.
- The operator should not have to abandon the current workflow because a course
  type, location, template, or contact is missing.
- "Add new" should preserve the user's current form state and return them to
  the workflow after creation.
- Apply this to:
  - contacts/people
  - class/course types
  - locations
  - templates
  - any future user-managed lookup data
- Prefer inline creation or a focused modal/drawer when it can be done safely.
  Use a dedicated page only when the creation workflow is too complex.

## Dashboard

### Intended Job

- Answer: what needs my attention today?
- Show whether sending is ready, paused, blocked, or has problems.
- Show upcoming class/email activity at a summary level.
- Link the operator to the right workflow page for action.
- Avoid turning the dashboard into a management or send-control page.

### Current Problems

- Status badges look like navigation but do not take the user to the matching
  page or workflow.
- The "resend failed today" action is risky and does not belong on a dashboard.
- The retry action can appear without enough surrounding context about what
  failed, who was affected, or why a retry is safe.
- Status badges are not grouped by user concern.
- Several labels expose implementation details that non-technical users should
  not need to understand.
- The page uses "approved" language for scheduled emails, which implies a
  multi-person approval workflow that does not exist in this single-user app.

### Required Changes

- Remove send/retry action buttons from the dashboard.
- Replace naked actions with attention items that link to the page where the
  issue can be reviewed and resolved.
- Make summary badges either clearly clickable links or visually non-clickable
  status text. Do not mix the two.
- Group status by operator concern:
  - Email sending
  - Upcoming scheduled emails
  - Setup needed
  - Recent problems
- Hide healthy technical internals by default. Surface technical details only
  when they block work or explain a problem.
- Replace "approved" wording in the dashboard with plain single-user states:
  - Draft
  - Scheduled
  - Ready to send
  - Paused
  - Needs attention
  - Sent
  - Failed

### Better Dashboard Shape

- Attention needed:
  - Email sending is paused.
  - SMTP setup is incomplete.
  - Failed emails need review.
  - Test mode is on.
  - Each item links to the relevant page.
- Upcoming emails:
  - Next scheduled email.
  - Count of scheduled emails this week.
  - Link to scheduled email/campaign workflow.
- Upcoming classes:
  - Classes today or soon.
  - Link to class detail.
- Setup/status:
  - Small, plain-language summary only.
  - No random ungrouped diagnostic badges.

### Scale Notes

- The dashboard should not load or render every campaign.
- Use bounded queries for upcoming scheduled emails, recent problems, and counts.
- Keep history and retry details on dedicated pages with pagination and review
  context.

## Communications

### Intended Job

- Rename the page to "History".
- Make it the concise email history page for the app.
- Answer: what emails were sent, what failed, and what replies need review?
- Keep one-off direct email creation out of this page.

### Current Problems

- The page tries to be a direct email composer, outbound history log, and reply
  review surface at the same time.
- "Communications" is vague and makes the page harder to understand.
- Since this is already an email app, "History" is clear enough. Users will not
  read it as unrelated world history.
- Full message bodies and replies compete with the history list.
- The page is not paginated, which makes it a poor fit for thousands of sent
  emails.

### Required Changes

- Rename the navigation item and page heading from "Communications" to
  "History".
- Create a separate page for one-off emails. Use a plain name such as
  "New Email" or "One-Off Email".
- Remove the direct email composer from History.
- Make History summary-first:
  - recipient
  - subject
  - source
  - sent/failed status
  - sent date
  - reply/review indicator
- Show full email body, provider details, failures, and replies only after the
  user opens a specific history item.
- Put replies that need review near the top through a filter or dedicated view,
  not by mixing every reply into the full history list.

### Better History Shape

- Header:
  - "History"
  - short status/filter controls
  - link or button to "New Email"
- Main list:
  - paginated email history rows
  - no full bodies in the default list
  - clear failed/needs-review indicators
- Detail view:
  - full rendered email
  - delivery result
  - related contact/class/campaign links
  - replies and review controls

### Scale Notes

- History must be server-paginated.
- History must have search.
- History list queries should not load email bodies or all replies by default.
- Search and filters should run through bounded server-side queries.
- Add indexes for common filters and ordering before treating the page as
  large-history ready.

## Contacts

### Intended Job

- Make this the address book for people the instructor teaches or emails.
- Use plain language. Do not call contacts "reusable student contacts" in the
  page header.
- Prefer "People" or "Contacts" plus a concise description such as "Students
  and email recipients".

### Current Problems

- "Reusable student contacts" is awkward product language.
- The contact page can become too busy if it tries to show complete email
  history, class history, import flows, and editing all at once.
- Full email history does not belong inline on the contact detail page.
- Contact lists and contact pickers will become unmanageable without search and
  pagination.

### Required Changes

- Rename or rewrite the header so it sounds natural:
  - "People"
  - "Contacts"
  - "Students and email recipients"
- Make the contact list searchable and paginated.
- Show only the 3 most recent emails on a contact detail view.
- Include reply indicators in those recent email items.
- Add a link from contact detail to History with the contact/customer filter
  prefilled.
- Keep complete email history on the History page, not Contacts.
- Keep imports available, but do not let import UI dominate the default contact
  management view.

### Reply Handling

- When a student replies, the instructor should be able to reply back from
  inside the app.
- Contact detail should make recent replies visible without turning into a full
  inbox.
- Reply actions should preserve context:
  - original sent email
  - student/contact
  - class or campaign when available
  - previous reply thread

### Better Contacts Shape

- Header:
  - "People" or "Contacts"
  - primary action: add person/contact
  - secondary action: import
- Main list:
  - searchable
  - paginated
  - summary rows with name, email, phone, do-not-email state
- Detail:
  - profile fields
  - do-not-email state
  - current/recent class involvement
  - 3 most recent emails with reply indicators
  - link to full filtered History

## Classes

### Intended Job

- Make Classes the place to find, create, and open class sessions.
- Keep the page focused on actual dated classes.
- Class detail should open when the operator selects a class.

### Current Problems

- The page mixes dated classes, course types, locations, defaults, checklists,
  and enrollment-related setup.
- Course types and locations are setup data, not the main class-session
  workflow.
- Putting course types and locations directly on Classes makes the page feel
  like a configuration workbench instead of a class list.

### Required Changes

- Make Classes list-first:
  - upcoming classes
  - past classes behind a filter or tab
  - search
  - pagination
  - create class action
- Selecting a class should open class detail.
- Remove course type management from the main Classes page.
- Remove location management from the main Classes page.
- Move course types and locations to a setup/settings-style area or dedicated
  pages.
- Keep class-session rows concise:
  - course/class name
  - date/time
  - location
  - roster count
  - scheduled email/problem indicators

### Better Classes Shape

- Header:
  - "Classes"
  - search/filter controls
  - create class action
- Main list:
  - paginated class sessions
  - upcoming first
  - row click opens detail
- Detail:
  - opens after selecting a class
  - contains roster, class checklist, and class-specific email schedule
  - does not require course type/location editing to be visible by default

### Checklist Clarity

- The checklist concept is currently unclear, even to the person who designed
  it. Treat that as a product problem, not a copy tweak.
- Clarify what the checklist is for before exposing checklist controls broadly.
- Decide whether checklist items are:
  - instructor preparation tasks for the class
  - per-student completion/requirement tracking
  - both, in separate sections
- Do not mix global defaults, course-type defaults, and per-student completion
  state in one visual area.
- Use workflow-specific names instead of generic "checklist" where possible:
  - "Class prep"
  - "Student requirements"
  - "Roster requirements"
- On class detail, show checklist state only where it helps answer a concrete
  question:
  - What do I still need to do for this class?
  - Which students are missing required items?
- Move checklist configuration/defaults away from the main Classes page.

## Class Detail

### Intended Job

- Make class detail the focused workspace for one selected class.
- Answer:
  - who is enrolled?
  - what emails are scheduled or already sent for this class?
  - what needs attention for this class?
  - what are the class date/time/location details?

### Current Problems

- Too many collapsible sections create visual noise.
- Some collapsible sections open to reveal only one item, which wastes space and
  makes the page feel heavier than it is.
- Add-student flow does not need to be overbuilt for normal class rosters.

### Required Changes

- Add student can be a simple dropdown/picker on class detail.
- Use the shared searchable contact picker only when the contact list size or
  workflow requires it.
- Remove collapsible sections that contain only one item or one simple control.
- Reserve collapses for genuinely optional or dense content.
- Keep common class tasks visible without making the user open panels to find
  them.
- Put advanced or rarely used actions behind secondary controls.

### Better Class Detail Shape

- Class summary stays visible:
  - class name/type
  - date/time
  - location
  - roster count
- Roster:
  - enrolled students
  - simple add-student control
  - do-not-email indicators
- Emails:
  - scheduled emails for this class
  - recent sent/failed class emails
  - link to filtered History for full class email history
- Requirements or prep:
  - only if the checklist concept is clarified
  - no mixed default/configuration state
- Details:
  - edit class details without exposing course type/location management inline

## Templates

### Intended Job

- Make Templates the place to create and edit reusable email text.
- Keep the workflow focused on writing subject/body content and previewing how
  variables render.

### Current Assessment

- The page concept is mostly right.
- It is not as broken as Dashboard, History, or Classes.
- It still needs cleanup so supporting tools do not crowd the writing workflow.

### Required Changes

- Keep template management separate from campaign scheduling and sending.
- Reduce visible variable/token clutter.
- Put variable insertion/help close to the editor instead of as free-floating
  page noise.
- Keep AI drafting optional and secondary.
- Do not let AI controls dominate the page.
- Provide a clear preview mode for rendered template output.
- Add search if the template list grows beyond a small set.

### Better Templates Shape

- Template list:
  - searchable when needed
  - concise rows with name and subject
- Editor:
  - template name
  - subject
  - body
  - variable insert helper
  - preview
- AI assist:
  - available from the editor
  - not the main page section

## Campaigns

### Intended Job

- Reframe this area as scheduled class emails, not marketing campaigns.
- Help the instructor choose a class, choose a template, preview each student's
  message, schedule the email, and monitor delivery.

### Naming

- Avoid "Campaigns" in the product UI where possible.
- Prefer one of:
  - "Scheduled Emails"
  - "Class Emails"
  - "Email Schedule"
- Avoid "approved" language. This is a single-user app, not a multi-person
  approval workflow.
- Use plain states:
  - Draft
  - Scheduled
  - Ready to send
  - Paused
  - Sent
  - Failed
  - Needs attention

### Current Problems

- "Campaign" sounds like marketing software.
- "Approved" implies a workflow that does not exist.
- The page mixes creation, preview, scheduling, status, and history.
- The list is not paginated.
- Delivery retry/review belongs in a focused detail context, not as ambient
  dashboard-style action.

### Required Changes

- Rename the navigation/page from Campaigns to the chosen plain-language name.
- Make the main page a searchable, paginated list of scheduled/class emails.
- Add filters:
  - upcoming
  - draft
  - sent
  - failed
  - needs attention
- Make create/schedule a focused flow:
  - select class
  - select template
  - preview recipients/messages
  - choose send time
  - schedule
- Remove approval terminology from labels, buttons, badges, and help text.
- Link delivery history to History with the scheduled email filter prefilled.

### Better Scheduled Email Shape

- Main list:
  - class
  - template/email name
  - send time
  - status
  - recipient count
  - failed/needs-attention count
- Create flow:
  - step-by-step or clearly grouped sections
  - preview before scheduling
  - missing variable warnings before scheduling
- Detail:
  - delivery status per recipient
  - retry failed recipients only after review
  - link to filtered History

## Settings

### Intended Job

- Make Settings the home for app configuration, not daily workflow.
- Keep setup concerns out of operational pages like Classes and Dashboard.
- Show basic, user-facing setup before advanced technical settings.

### Current Risk

- Settings is the correct place for many controls, but it can become a junk
  drawer without strong grouping.
- Technical concepts need plain-language labels and explanatory context.
- Non-technical operators should see what they need to configure before they
  see ports, OAuth details, app secrets, proxy settings, or agent internals.

### Required Grouping

- Sending:
  - SMTP or Microsoft connection
  - sender/from details
  - test email
  - sending paused state
  - rate limits
- Email content:
  - signature
  - app vocabulary where it affects visible email/workflow language
- Reply sync:
  - IMAP setup
  - sync status
  - sync now
- AI:
  - enable/disable
  - endpoint/model
  - vision support
  - test/load models
- Security:
  - admin password
  - external sign-on
  - remote access safety
- App data:
  - course types
  - locations
  - checklist defaults, if the checklist concept remains
- Advanced:
  - agent access
  - proxy/remote internals
  - technical diagnostics

### Required Changes

- Keep grouped forms; saving one group must not resave unrelated settings.
- Use plain labels before technical labels.
- Hide advanced details until needed.
- Move course type and location management here or to dedicated setup pages
  rather than keeping them on Classes.
- If checklist defaults remain, move configuration here or to a dedicated setup
  area after the checklist concept is clarified.

## Test Audit

### Intended Job

- Make this a safety log for emails redirected by test mode.
- Answer:
  - who would have received the email?
  - where was it actually sent?
  - when did it happen?
  - what was sent?

### Naming

- Avoid "Test Audit" if it reads as a technical QA page.
- Prefer one of:
  - "Test Sends"
  - "Test Mode Log"
  - "Redirected Emails"

### Current Risk

- The page can feel like a primary workflow even though it is a secondary
  safety log.
- The name is technical and vague.
- Without pagination/search, it will degrade as test sends accumulate.

### Required Changes

- Keep this page secondary.
- Show it in navigation only when test mode is on, or link to it from
  Settings/Sending.
- If accessed while test mode is off, clearly state that test mode is currently
  off.
- Add pagination.
- Add search/filtering.
- Show concise rows:
  - intended recipient
  - actual test recipient
  - subject
  - sent time
  - source when available
- Link to the matching History item when possible.

## Setup

### Intended Job

- Make Setup the first-run page that protects the local installation.
- Keep it focused on creating the local admin password.

### Required Changes

- Do not turn Setup into a full onboarding wizard.
- Do not ask for SMTP, AI, remote access, templates, course types, or other
  advanced setup here.
- Use plain local-first language:
  - "Set up this app"
  - "Create the password for this installation"
  - "This password protects the app on this computer or server"
- After setup, send the user into the app and guide remaining setup through
  Dashboard attention items or Settings.

### Better Setup Shape

- Title: "Set up this app"
- One form:
  - password
  - confirm password
- One primary action:
  - create password
- After success:
  - route to Dashboard or Settings/Sending depending on the chosen first-run
    flow

## New Email

### Intended Job

- Own one-off direct email sending.
- Keep direct compose separate from History.
- Answer: who am I emailing, what will they receive, and am I ready to send?

### Required Shape

- Recipient picker:
  - shared searchable contact multi-select
  - do-not-email indication
  - add-new contact option
- Message:
  - choose template or write from scratch
  - subject
  - body
  - optional AI assist as a secondary tool
- Preview:
  - show final message per recipient before sending
  - show missing variables or blocked recipients
- Send:
  - clear recipient count
  - respect direct-send caps, pacing, test mode, and kill switch
  - after send, route to History filtered to the send/batch when possible

### Non-Goals

- Do not show full email history here.
- Do not mix scheduled class email workflows into this page.

## History Detail

### Intended Job

- Show one sent/failed email record in full context.
- Keep the main History list summary-first.

### Required Shape

- Header:
  - recipient
  - subject
  - sent/failed status
  - sent date
- Message:
  - rendered subject/body snapshot
  - original recipient and effective recipient when test mode changed delivery
- Context links:
  - contact/person
  - class when available
  - scheduled email/campaign when available
- Delivery:
  - provider result
  - failure reason when available
  - retry path only when safe and contextual
- Replies:
  - matching replies
  - reviewed/unreviewed state
  - reply-back action from inside the app

## App Data Setup

### Intended Job

- Provide a home for user-managed lookup/configuration data that should not
  clutter daily workflow pages.
- Replace course type and location management on the main Classes page.

### Contents

- Course types:
  - name/description
  - default email schedule/templates
  - course-specific requirements only if the checklist concept survives
- Locations:
  - name
  - address
  - phone/website
  - parking and meeting notes
- Checklist/default requirements:
  - only after the checklist concept is clarified
  - split class prep from student requirements if both remain

### Placement Options

- Preferred simple option: Settings > App Data.
- Alternative: dedicated pages if these workflows become too large for
  Settings.

### Required Behavior

- Any workflow picker for course type/location/template/contact must provide an
  "Add new" path back to this data without losing form state.

## Scheduled Email Detail

### Intended Job

- Replace campaign detail language with scheduled/class email language.
- Show status and delivery results for one scheduled email.

### Required Shape

- Header:
  - email/template name
  - class
  - scheduled send time
  - plain status: Draft, Scheduled, Sent, Failed, Needs attention, Paused
- Preview:
  - final rendered messages or access to preview
  - missing-variable warnings before scheduling
- Recipients:
  - paginated when large
  - status per recipient
  - failure/reply indicators
- Actions:
  - edit draft/schedule before send
  - retry failed recipients only after review
  - no "approval" terminology
- Links:
  - class detail
  - template
  - filtered History

## App Shell And Navigation

### Intended Job

- Make the app structure obvious from the left navigation.
- Navigation labels should match user intent, not internal models.

### Proposed Navigation

- Dashboard
- People or Contacts
- Classes
- Templates
- Scheduled Emails or Class Emails
- History
- Settings
- Test Sends, visible only when test mode is on

### Required Changes

- Rename "Communications" to "History".
- Rename "Campaigns" to "Scheduled Emails", "Class Emails", or "Email
  Schedule".
- Add "New Email" as an action or page separate from History.
- Keep Test Sends secondary.
- Make nav badges/counts clickable when they look actionable.
- Avoid ungrouped status badges in the shell or dashboard.

## Shared Components

### Required Components

- Searchable contact picker:
  - single-select and multi-select modes
  - selected chips
  - do-not-email state
  - add-new contact path
- Paginated list/table pattern:
  - search
  - filters
  - empty state
  - loading state
  - row summary plus detail navigation
- Data-backed picker pattern:
  - add-new option
  - preserve current form state
  - return to current workflow after creation
- Status language helpers:
  - avoid "approved"
  - map internal states to plain user-facing labels
