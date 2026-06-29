import { json } from '@sveltejs/kit';
import { repo } from '$lib/server/app';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url }) => {
  const search = url.searchParams.get('q') ?? '';
  return json({
    contacts: repo.listContactsPage({ search, limit: 25 }).items
  });
};
