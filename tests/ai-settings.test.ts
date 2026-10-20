import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { repo } from '../src/lib/server/app';
import { encryptSecret } from '../src/lib/server/crypto';
import { AI_MODEL, extractRosterFromImage, suggestTemplate } from '../src/lib/server/llm';
import { aiBaseUrl, getSettings, updateAiSettings } from '../src/lib/server/settings';

const endpoint = 'http://ai-gateway.example.test/c/email-manager/v1';
const originalBaseUrl = process.env.SCUBA_EMAIL_AI_BASE_URL;

function completion(content: unknown) {
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
}

describe('AI endpoint configuration', () => {
  beforeEach(() => {
    process.env.SCUBA_EMAIL_AI_BASE_URL = `${endpoint}/`;
    repo.setSetting('ai.enabled', 'true');
    repo.setSetting('ai.visionEnabled', 'true');
  });

  afterEach(() => {
    if (originalBaseUrl === undefined) delete process.env.SCUBA_EMAIL_AI_BASE_URL;
    else process.env.SCUBA_EMAIL_AI_BASE_URL = originalBaseUrl;
    for (const key of ['ai.enabled', 'ai.visionEnabled', 'ai.baseUrl', 'ai.model', 'ai.apiKey']) repo.setSetting(key, '');
    vi.unstubAllGlobals();
  });

  test('reads the base URL only from the environment', () => {
    expect(aiBaseUrl()).toBe(endpoint);
    expect(aiBaseUrl({})).toBe('');
    expect(aiBaseUrl({ SCUBA_EMAIL_AI_BASE_URL: '  ' })).toBe('');
  });

  test('ignores legacy stored endpoint, model, and key settings', () => {
    delete process.env.SCUBA_EMAIL_AI_BASE_URL;
    repo.setSetting('ai.baseUrl', 'http://legacy.example.test/v1');
    repo.setSetting('ai.model', 'legacy-model');
    repo.setSetting('ai.apiKey', encryptSecret('legacy-key'));

    const settings = getSettings();
    expect(settings.aiEndpointConfigured).toBe(false);
    expect(settings).not.toHaveProperty('aiBaseUrl');
    expect(settings).not.toHaveProperty('aiModel');
  });

  test('saving AI settings stores only the on/off switches', () => {
    const form = new FormData();
    form.set('aiEnabled', 'on');
    form.set('aiBaseUrl', 'http://attacker.example.test/v1');
    form.set('aiModel', 'chosen-model');
    form.set('aiApiKey', 'posted-key');

    updateAiSettings(form);

    expect(repo.getSetting('ai.enabled')).toBe('true');
    expect(repo.getSetting('ai.visionEnabled')).toBe('false');
    expect(repo.getSetting('ai.baseUrl')).toBe('');
    expect(repo.getSetting('ai.model')).toBe('');
    expect(repo.getSetting('ai.apiKey')).toBe('');
  });

  test('template drafting calls the configured endpoint with the automatic model', async () => {
    repo.setSetting('ai.baseUrl', 'http://legacy.example.test/v1');
    repo.setSetting('ai.model', 'legacy-model');
    repo.setSetting('ai.apiKey', encryptSecret('legacy-key'));
    const fetchMock = vi.fn().mockResolvedValue(completion({ subject: 'Hi', body: 'Body' }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(suggestTemplate('Write a welcome email')).resolves.toEqual({ subject: 'Hi', body: 'Body' });

    expect(AI_MODEL).toBe('auto');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${endpoint}/chat/completions`);
    expect(init.headers).toEqual({ 'content-type': 'application/json' });
    expect(JSON.parse(init.body).model).toBe('auto');
  });

  test('roster image import calls the configured endpoint with the automatic model', async () => {
    const student = { firstName: 'Maya', lastName: 'Patel', email: 'maya@example.com', phone: '', notes: '' };
    const fetchMock = vi.fn().mockResolvedValue(completion({ students: [student] }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(extractRosterFromImage('data:image/png;base64,abc')).resolves.toEqual([student]);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${endpoint}/chat/completions`);
    expect(JSON.parse(init.body).model).toBe('auto');
  });

  test('AI calls fail closed without an endpoint and never call fetch', async () => {
    delete process.env.SCUBA_EMAIL_AI_BASE_URL;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(suggestTemplate('Write a welcome email')).rejects.toThrow('no AI endpoint is configured');
    await expect(extractRosterFromImage('data:image/png;base64,abc')).rejects.toThrow('configured AI endpoint');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
