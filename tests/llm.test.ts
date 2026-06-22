import { describe, expect, test } from 'vitest';
import { parseRosterResponse, parseTemplateResponse } from '../src/lib/server/llm';

describe('AI response parsing', () => {
  test('accepts roster JSON that matches the schema', () => {
    expect(
      parseRosterResponse(
        JSON.stringify({
          students: [{ firstName: 'Maya', lastName: 'Patel', email: 'maya@example.com', phone: '', notes: '' }]
        })
      )
    ).toEqual({
      students: [{ firstName: 'Maya', lastName: 'Patel', email: 'maya@example.com', phone: '', notes: '' }]
    });
  });

  test('rejects fenced roster JSON because the endpoint must support json_schema', () => {
    expect(() => parseRosterResponse('```json\n{"students":[]}\n```')).toThrow(
      'AI roster import requires a model endpoint that supports JSON schema responses.'
    );
  });

  test('rejects roster JSON that does not match the schema', () => {
    expect(() => parseRosterResponse('{"students":[{"firstName":"Maya"}]}')).toThrow(
      'AI roster import returned JSON that did not match the required roster schema.'
    );
  });

  test('accepts template draft JSON that matches the schema', () => {
    expect(parseTemplateResponse('{"subject":"Welcome {{firstName}}","body":"Hi {{firstName}}"}')).toEqual({
      subject: 'Welcome {{firstName}}',
      body: 'Hi {{firstName}}'
    });
  });

  test('rejects template draft responses that are not schema JSON', () => {
    expect(() => parseTemplateResponse('Subject: Welcome')).toThrow(
      'AI template drafting requires a model endpoint that supports JSON schema responses.'
    );
  });
});
