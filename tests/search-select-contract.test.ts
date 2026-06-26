import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

describe('SearchSelect contract', () => {
  test('submits through a real select instead of a hidden datalist value', () => {
    const source = readFileSync('src/lib/SearchSelect.svelte', 'utf8');

    expect(source).toContain('<select');
    expect(source).not.toContain('type="hidden"');
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
  });

  test('uses the shared contact picker for class enrollment without a one-field collapse', () => {
    const classDetail = readFileSync('src/routes/classes/[id]/+page.svelte', 'utf8');
    const picker = readFileSync('src/lib/ContactMultiSelect.svelte', 'utf8');

    expect(classDetail).toContain("import ContactMultiSelect from '$lib/ContactMultiSelect.svelte'");
    expect(classDetail).toContain('<ContactMultiSelect');
    expect(classDetail).toContain("name=\"contactId\"");
    expect(classDetail).toContain("mode=\"single\"");
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
    expect(classDetailServer).toContain("import { loadContactOptions } from '$lib/server/page-data'");
    expect(classDetailServer).toContain('contactOptions: loadContactOptions()');
    expect(picker).toContain("searchHref = '/contacts/search'");
    expect(picker).toContain('fetch(');
    expect(contactSearchRoute).toContain('repo.listContactsPage');
    expect(contactSearchRoute).toContain('limit: 25');
  });
});
