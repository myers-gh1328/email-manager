import { errorText } from './form-utils';

type ImageImportSurface = 'contacts' | 'class_roster';
type DiagnosticWriter = (message: string) => void;

const fallbackMessage = 'Image import failed. Check the AI settings and try again.';

export function reportImageImportFailure(
  surface: ImageImportSurface,
  error: unknown,
  write: DiagnosticWriter = console.error
) {
  const message = errorText(error, fallbackMessage) || fallbackMessage;
  write(JSON.stringify({
    level: 'error',
    event: 'image_import_failed',
    surface,
    error: message
  }));
  return message;
}
