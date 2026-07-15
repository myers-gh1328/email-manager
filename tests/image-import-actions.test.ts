import { beforeEach, describe, expect, test, vi } from 'vitest';

const extractRosterFromImage = vi.fn();
const importContactRows = vi.fn();

vi.mock('$lib/server/app', () => ({ repo: {} }));
vi.mock('$lib/server/settings', () => ({
  getSettings: () => ({ aiEnabled: true, aiVisionEnabled: true, aiBaseUrl: 'https://ai.example.test/v1', aiModel: 'vision-model' })
}));
vi.mock('$lib/server/llm', () => ({ extractRosterFromImage }));
vi.mock('$lib/server/roster-import', () => ({
  importContactRows,
  parseRosterCsv: vi.fn()
}));

describe('contact screenshot import action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('redirects with import counts after a successful extraction', async () => {
    extractRosterFromImage.mockResolvedValue([{ firstName: 'Alex', lastName: 'Rivera' }]);
    importContactRows.mockReturnValue({ created: 1, reused: 0, skipped: 0 });
    const { actions } = await import('../src/routes/contacts/+page.server');

    await expect(actions.importImage({ request: imageRequest() } as never)).rejects.toMatchObject({
      status: 303,
      location: expect.stringContaining('Imported+screenshot+contacts%3A+1+created%2C+0+reused%2C+0+skipped.')
    });
  });

  test('returns the provider failure to the UI and emits a structured error', async () => {
    extractRosterFromImage.mockRejectedValue(new Error('AI endpoint returned 413'));
    const write = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { actions } = await import('../src/routes/contacts/+page.server');

    await expect(actions.importImage({ request: imageRequest() } as never)).resolves.toMatchObject({
      status: 400,
      data: { error: true, message: 'AI endpoint returned 413' }
    });
    expect(write).toHaveBeenCalledWith(expect.stringContaining('"event":"image_import_failed"'));
  });
});

function imageRequest() {
  const form = new FormData();
  form.set('imageFile', new File(['image'], 'roster.png', { type: 'image/png' }));
  return new Request('https://app.example.test/contacts?action=image&/importImage', { method: 'POST', body: form });
}
