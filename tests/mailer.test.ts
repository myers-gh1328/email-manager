import { describe, expect, test } from 'vitest';
import { applySignature, textToEmailHtml } from '../src/lib/server/mailer';

describe('mailer formatting', () => {
  test('appends a plain signature before generating email html', () => {
    const text = applySignature('Hello Maya.', 'Alex Instructor\n555-0100');

    expect(text).toBe('Hello Maya.\n\nAlex Instructor\n555-0100');
    expect(textToEmailHtml(text)).toBe('<p>Hello Maya.</p>\n<p>Alex Instructor<br>555-0100</p>');
  });

  test('escapes html while converting text to email html', () => {
    expect(textToEmailHtml('Use <gear> & check "forms".')).toBe('<p>Use &lt;gear&gt; &amp; check &quot;forms&quot;.</p>');
  });
});
