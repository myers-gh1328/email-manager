import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

describe('SearchSelect contract', () => {
  test('submits through a searchable option list instead of a native select box', () => {
    const source = readFileSync('src/lib/SearchSelect.svelte', 'utf8');

    expect(source).toContain('type="hidden"');
    expect(source).toContain('role="listbox"');
    expect(source).toContain('aria-selected');
    expect(source).toContain('selectOption');
    expect(source).not.toContain('<select');
    expect(source).not.toContain('<datalist');
  });

  test('filters options in the shared app-data select and can link to add-new workflows', () => {
    const source = readFileSync('src/lib/SearchSelect.svelte', 'utf8');
    const classes = readFileSync('src/routes/classes/+page.svelte', 'utf8');
    const scheduledEmails = readFileSync('src/routes/campaigns/+page.svelte', 'utf8');
    const newEmail = readFileSync('src/routes/new-email/+page.svelte', 'utf8');

    expect(source).toContain('bind:value={search}');
    expect(source).toContain('filteredOptions');
    expect(source).toContain('No options match that search.');
    expect(source).toContain('addHref');
    expect(source).toContain('addLabel');
    expect(classes).toContain('addLabel="Add course"');
    expect(classes).toContain('addLabel="Add location"');
    expect(scheduledEmails).toContain('addLabel="Add class"');
    expect(scheduledEmails).toContain('addLabel="Add template"');
    expect(scheduledEmails).toContain('addHref="/templates?action=create"');
    expect(newEmail).toContain('addLabel="Add template"');
    expect(newEmail).toContain('addHref="/templates?action=create"');
  });

  test('uses a shared searchable contact multi-select for direct email recipients', () => {
    const newEmail = readFileSync('src/routes/new-email/+page.svelte', 'utf8');
    const picker = readFileSync('src/lib/ContactMultiSelect.svelte', 'utf8');

    expect(newEmail).toContain("import ContactMultiSelect from '$lib/ContactMultiSelect.svelte'");
    expect(newEmail).toContain('<ContactMultiSelect');
    expect(newEmail).not.toContain('let recipientSearch');
    expect(picker).toContain('Search recipients');
    expect(picker).toContain("name = 'contactIds'");
    expect(picker).toContain('selectedContactIds');
    expect(picker).toContain('selectedIds');
    expect(picker).toContain('<input type="hidden" {name} value={contactId} />');
    expect(picker).toContain('toggleContact');
    expect(picker).toContain('addHref');
    expect(picker).toContain('addLabel');
    expect(newEmail).toContain('addLabel="Add contact"');
    expect(newEmail).toContain('addHref="/contacts?action=add"');
  });

  test('uses the shared contact picker for class enrollment without a one-field collapse', () => {
    const classDetail = readFileSync('src/routes/classes/[id]/+page.svelte', 'utf8');
    const picker = readFileSync('src/lib/ContactMultiSelect.svelte', 'utf8');

    expect(classDetail).toContain("import ContactMultiSelect from '$lib/ContactMultiSelect.svelte'");
    expect(classDetail).toContain('<ContactMultiSelect');
    expect(classDetail).toContain("name=\"contactId\"");
    expect(classDetail).toContain("mode=\"single\"");
    expect(classDetail).toContain('addLabel="Add contact"');
    expect(classDetail).toContain('addHref="/contacts?action=add"');
    expect(classDetail).not.toContain('<summary>Add student</summary>');
    expect(picker).toContain("mode = 'multi'");
    expect(picker).toContain("type={mode === 'single' ? 'radio' : 'checkbox'}");
  });

  test('does not load every contact into shared recipient pickers', () => {
    const pageData = readFileSync('src/lib/server/page-data.ts', 'utf8');
    const classDetailServer = readFileSync('src/routes/classes/[id]/+page.server.ts', 'utf8');
    const picker = readFileSync('src/lib/ContactMultiSelect.svelte', 'utf8');
    const contactSearchRoute = readFileSync('src/routes/contacts/search/+server.ts', 'utf8');

    expect(pageData).not.toContain('contacts: repo.listContacts()');
    expect(classDetailServer).not.toContain('contacts: repo.listContacts()');
    expect(pageData).toContain('function loadContactOptions');
    expect(pageData).toContain('repo.listContactsPage({ limit: 25 }).items');
    expect(pageData).toContain('contactOptions: loadContactOptions()');
    expect(classDetailServer).toContain('loadContactOptions');
    expect(classDetailServer).toContain('contactOptions: loadContactOptions()');
    expect(picker).toContain("searchHref = '/contacts/search'");
    expect(picker).toContain('fetch(');
    expect(contactSearchRoute).toContain('repo.listContactsPage');
    expect(contactSearchRoute).toContain('limit: 25');
  });

  test('does not load every class or template into shared search selects', () => {
    const pageData = readFileSync('src/lib/server/page-data.ts', 'utf8');
    const classDetailServer = readFileSync('src/routes/classes/[id]/+page.server.ts', 'utf8');
    const scheduledEmails = readFileSync('src/routes/campaigns/+page.svelte', 'utf8');
    const classDetail = readFileSync('src/routes/classes/[id]/+page.svelte', 'utf8');
    const newEmail = readFileSync('src/routes/new-email/+page.svelte', 'utf8');
    const searchSelect = readFileSync('src/lib/SearchSelect.svelte', 'utf8');
    const classSearchRoute = readFileSync('src/routes/classes/search/+server.ts', 'utf8');
    const templateSearchRoute = readFileSync('src/routes/templates/search/+server.ts', 'utf8');

    expect(pageData).not.toContain('classSessions: repo.listClassSessions()');
    expect(pageData).not.toContain('templates: repo.listTemplates()');
    expect(classDetailServer).not.toContain('templates: repo.listTemplates()');
    expect(pageData).toContain('function loadClassSessionOptions');
    expect(pageData).toContain('function loadTemplateOptions');
    expect(pageData).toContain('repo.listClassSessionsPage({ limit: 25 }).items');
    expect(pageData).toContain('repo.listTemplatesPage({ limit: 25 }).items');
    expect(scheduledEmails).toContain('searchHref="/classes/search"');
    expect(scheduledEmails).toContain('searchHref="/templates/search"');
    expect(classDetail).toContain('searchHref="/templates/search"');
    expect(newEmail).toContain('searchHref="/templates/search"');
    expect(searchSelect).toContain('searchHref');
    expect(searchSelect).toContain('fetch(');
    expect(classSearchRoute).toContain('repo.listClassSessionsPage');
    expect(templateSearchRoute).toContain('repo.listTemplatesPage');
  });

  test('does not preload unused picker options for the class list page', () => {
    const pageData = readFileSync('src/lib/server/page-data.ts', 'utf8');

    expect(pageData).not.toContain('contactOptions: loadContactOptions(),\n    courseTypes: repo.listCourseTypes()');
    expect(pageData).not.toContain('templateOptions: loadTemplateOptions(),\n    classSessions: classSessionsPage.items');
  });

  test('uses the shared search select for discovered AI models in settings', () => {
    const settings = readFileSync('src/routes/settings/+page.svelte', 'utf8');

    expect(settings).toContain("import SearchSelect from '$lib/SearchSelect.svelte'");
    expect(settings).toContain('aiModelOptions');
    expect(settings).toContain('<SearchSelect');
    expect(settings).toContain('name="aiModel"');
    expect(settings).toContain('placeholder="Search models"');
    expect(settings).not.toContain('<select name="aiModel"');
  });
});
