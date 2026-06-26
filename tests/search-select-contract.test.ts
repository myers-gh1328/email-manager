import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

describe('SearchSelect contract', () => {
  test('submits through a real select instead of a hidden datalist value', () => {
    const source = readFileSync('src/lib/SearchSelect.svelte', 'utf8');

    expect(source).toContain('<select');
    expect(source).not.toContain('type="hidden"');
    expect(source).not.toContain('<datalist');
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
});
