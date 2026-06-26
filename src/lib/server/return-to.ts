import { redirect } from '@sveltejs/kit';
import { text } from './form-utils';

export function localReturnTo(returnTo: string) {
  if (!returnTo.startsWith('/') || returnTo.startsWith('//')) return '';
  return returnTo;
}

export function returnAfterCreate(form: FormData, message: string) {
  const returnTo = localReturnTo(text(form, 'returnTo'));
  if (returnTo) throw redirect(303, withMessage(returnTo, message));
  return { message };
}

function withMessage(path: string, message: string) {
  const [pathname, query = ''] = path.split('?');
  const params = new URLSearchParams(query);
  params.set('message', message);
  return `${pathname}?${params.toString()}`;
}
