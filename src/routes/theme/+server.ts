import { redirect } from '@sveltejs/kit';
import { setThemeMode } from '$lib/server/settings';

export const POST = async ({ request }) => {
  const form = await request.formData();
  setThemeMode(String(form.get('themeMode') ?? 'system'));
  throw redirect(303, request.headers.get('referer') ?? '/');
};
