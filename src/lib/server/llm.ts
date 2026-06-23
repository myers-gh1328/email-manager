import { repo } from './app';
import { decryptSecret } from './crypto';
import { getSettings } from './settings';

const rosterResponseFormat = {
  type: 'json_schema',
  json_schema: {
    name: 'student_roster',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['students'],
      properties: {
        students: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['firstName', 'lastName', 'email', 'phone', 'notes'],
            properties: {
              firstName: { type: 'string' },
              lastName: { type: 'string' },
              email: { type: 'string' },
              phone: { type: 'string' },
              notes: { type: 'string' }
            }
          }
        }
      }
    }
  }
} as const;

const templateResponseFormat = {
  type: 'json_schema',
  json_schema: {
    name: 'email_template_draft',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['subject', 'body'],
      properties: {
        subject: { type: 'string' },
        body: { type: 'string' }
      }
    }
  }
} as const;

export async function suggestTemplate(
  prompt: string,
  current?: {
    subject?: string;
    body?: string;
  }
) {
  const settings = getSettings();
  if (!settings.aiEnabled || !settings.aiBaseUrl || !settings.aiModel) {
    throw new Error('AI assistance is disabled or incomplete.');
  }

  const response = await fetch(`${settings.aiBaseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(settings.aiApiKeyConfigured ? { authorization: `Bearer ${decryptSecret(repo.getSetting('ai.apiKey'))}` } : {})
    },
    body: JSON.stringify({
      model: settings.aiModel,
      messages: [
        {
          role: 'system',
          content:
            'You help an instructor or training provider write concise, warm class communication emails. Return only the requested subject and body. Do not include a signoff, sender name, signature block, phone number, website, or invented contact details. The app appends the configured signature later. Use placeholders like {{firstName}}, {{courseName}}, {{classDateRange}}, {{classStartTime}}, and {{classLocation}} when helpful.'
        },
        {
          role: 'user',
          content: current?.subject || current?.body
            ? `Revise this email draft using the instruction below.\n\nInstruction:\n${prompt}\n\nCurrent subject:\n${current.subject ?? ''}\n\nCurrent body:\n${current.body ?? ''}`
            : prompt
        }
      ],
      response_format: templateResponseFormat,
      temperature: 0.7
    })
  });

  if (!response.ok) throw new Error(`AI endpoint returned ${response.status}`);
  const data = await response.json();
  return parseTemplateResponse(String(data.choices?.[0]?.message?.content ?? '').trim());
}

export async function listAiModels(input: { baseUrl: string; apiKey?: string }) {
  if (!input.baseUrl.trim()) throw new Error('Enter an AI base URL before loading models.');
  const response = await fetch(`${input.baseUrl.replace(/\/$/, '')}/models`, {
    headers: {
      ...(input.apiKey ? { authorization: `Bearer ${input.apiKey}` } : {})
    }
  });
  if (!response.ok) throw new Error(`AI model list returned ${response.status}`);
  const data = await response.json();
  const models = Array.isArray(data.data) ? data.data : Array.isArray(data.models) ? data.models : [];
  return models
    .map((model: unknown) => (typeof model === 'string' ? model : typeof (model as { id?: unknown })?.id === 'string' ? (model as { id: string }).id : ''))
    .filter(Boolean)
    .sort((a: string, b: string) => a.localeCompare(b));
}

export async function extractRosterFromImage(imageDataUrl: string) {
  const settings = getSettings();
  if (!settings.aiEnabled || !settings.aiVisionEnabled || !settings.aiBaseUrl || !settings.aiModel) {
    throw new Error('Enable a vision-capable AI model before importing screenshots.');
  }

  const response = await fetch(`${settings.aiBaseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(settings.aiApiKeyConfigured ? { authorization: `Bearer ${decryptSecret(repo.getSetting('ai.apiKey'))}` } : {})
    },
    body: JSON.stringify({
      model: settings.aiModel,
      messages: [
        {
          role: 'system',
          content:
            'Extract student roster rows from screenshots. Use empty strings for missing fields.'
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Extract student contact rows from this roster screenshot.' },
            { type: 'image_url', image_url: { url: imageDataUrl } }
          ]
        }
      ],
      response_format: rosterResponseFormat,
      temperature: 0
    })
  });

  if (!response.ok) throw new Error(`AI endpoint returned ${response.status}`);
  const data = await response.json();
  const content = String(data.choices?.[0]?.message?.content ?? '').trim();
  const parsed = parseRosterResponse(content);
  return parsed.students;
}

export function parseRosterResponse(content: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('AI roster import requires a model endpoint that supports JSON schema responses.');
  }

  if (!isRosterResponse(parsed)) {
    throw new Error('AI roster import returned JSON that did not match the required roster schema.');
  }
  return parsed;
}

export function parseTemplateResponse(content: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('AI template drafting requires a model endpoint that supports JSON schema responses.');
  }

  if (!isTemplateResponse(parsed)) {
    throw new Error('AI template drafting returned JSON that did not match the required template schema.');
  }
  return parsed;
}

function isRosterResponse(value: unknown): value is {
  students: Array<{ firstName: string; lastName: string; email: string; phone: string; notes: string }>;
} {
  if (!value || typeof value !== 'object' || !Array.isArray((value as { students?: unknown }).students)) return false;
  return (value as { students: unknown[] }).students.every(
    (student) =>
      Boolean(student) &&
      typeof student === 'object' &&
      typeof (student as { firstName?: unknown }).firstName === 'string' &&
      typeof (student as { lastName?: unknown }).lastName === 'string' &&
      typeof (student as { email?: unknown }).email === 'string' &&
      typeof (student as { phone?: unknown }).phone === 'string' &&
      typeof (student as { notes?: unknown }).notes === 'string'
  );
}

function isTemplateResponse(value: unknown): value is { subject: string; body: string } {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    typeof (value as { subject?: unknown }).subject === 'string' &&
    typeof (value as { body?: unknown }).body === 'string'
  );
}
