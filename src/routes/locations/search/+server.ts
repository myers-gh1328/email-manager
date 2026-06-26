import { json } from '@sveltejs/kit';
import { repo } from '$lib/server/app';
import { formatLocationOption } from '$lib/server/page-data';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url }) => {
  const search = url.searchParams.get('q') ?? '';
  return json({
    options: repo.listLocationsPage({ search, limit: 25 }).items.map(formatLocationOption)
  });
};
