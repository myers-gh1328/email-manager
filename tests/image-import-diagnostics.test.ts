import { describe, expect, test, vi } from 'vitest';
import { reportImageImportFailure } from '../src/lib/server/image-import-diagnostics';

describe('image import diagnostics', () => {
  test('returns a useful user message and writes metadata-only structured diagnostics', () => {
    const write = vi.fn();

    const message = reportImageImportFailure('contacts', new Error('Vision model rejected the image.'), write);

    expect(message).toBe('Vision model rejected the image.');
    expect(write).toHaveBeenCalledWith(JSON.stringify({
      level: 'error',
      event: 'image_import_failed',
      surface: 'contacts',
      error: 'Vision model rejected the image.'
    }));
  });

  test('uses an actionable fallback without logging image or form data', () => {
    const write = vi.fn();

    const message = reportImageImportFailure('class_roster', { unexpected: true }, write);

    expect(message).toBe('Image import failed. Check the AI settings and try again.');
    expect(write).toHaveBeenCalledWith(JSON.stringify({
      level: 'error',
      event: 'image_import_failed',
      surface: 'class_roster',
      error: 'Image import failed. Check the AI settings and try again.'
    }));
  });
});
