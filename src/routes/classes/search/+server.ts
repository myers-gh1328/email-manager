import { json } from '@sveltejs/kit';
import { repo } from '$lib/server/app';
import { formatClassSessionOption } from '$lib/server/page-data';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url }) => {
  const search = url.searchParams.get('q') ?? '';
  return json({
    options: repo.listClassSessionsPage({ search, limit: 25 }).items.map(formatClassSessionOption)
  });
};
