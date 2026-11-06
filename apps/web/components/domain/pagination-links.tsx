import type { Route } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface PaginationLinksProps {
  basePath: '/people' | '/groups';
  /** Filtres courants, conservés dans les liens. */
  params: Record<string, string | undefined>;
  nextCursor: string | null;
}

export function pageHref(
  basePath: string,
  params: Record<string, string | undefined>,
  cursor?: string,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && key !== 'cursor') search.set(key, value);
  }
  if (cursor) search.set('cursor', cursor);
  const text = search.toString();
  return text ? `${basePath}?${text}` : basePath;
}

/** Pagination par curseur : « page suivante » et retour au début (pas de numéro de page). */
export function PaginationLinks({ basePath, params, nextCursor }: PaginationLinksProps) {
  if (!params.cursor && !nextCursor) return null;
  return (
    <nav aria-label="Pagination" className="flex justify-end gap-2">
      {params.cursor && (
        <Button asChild variant="outline" size="sm">
          <Link href={pageHref(basePath, params) as Route}>Première page</Link>
        </Button>
      )}
      {nextCursor && (
        <Button asChild variant="outline" size="sm">
          <Link href={pageHref(basePath, params, nextCursor) as Route}>Page suivante</Link>
        </Button>
      )}
    </nav>
  );
}
