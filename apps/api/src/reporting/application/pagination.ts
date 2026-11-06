import type { Page } from '@cardsim/shared';
import { InvalidCursorError } from './errors';

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

/** Position dans un tri `(sortKey desc, id desc)`. */
export interface Cursor {
  sortKey: string;
  id: string;
}

/** Curseur opaque : base64url de `sortKey|id`. */
export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(`${cursor.sortKey}|${cursor.id}`, 'utf8').toString('base64url');
}

export function decodeCursor(raw: string | undefined): Cursor | null {
  if (raw === undefined || raw === '') return null;
  const decoded = Buffer.from(raw, 'base64url').toString('utf8');
  const separator = decoded.lastIndexOf('|');
  if (separator <= 0 || separator === decoded.length - 1) throw new InvalidCursorError();
  return { sortKey: decoded.slice(0, separator), id: decoded.slice(separator + 1) };
}

export function pageSize(limit: number | undefined): number {
  if (limit === undefined) return DEFAULT_PAGE_SIZE;
  return Math.min(Math.max(Math.trunc(limit), 1), MAX_PAGE_SIZE);
}

/**
 * Construit une page à partir de `size + 1` lignes lues : la ligne en trop indique qu'il existe
 * une page suivante, dont le curseur est la dernière ligne gardée.
 */
export function toPage<T>(rows: T[], size: number, cursorOf: (item: T) => Cursor): Page<T> {
  const items = rows.slice(0, size);
  const last = items.at(-1);
  return {
    items,
    nextCursor: rows.length > size && last !== undefined ? encodeCursor(cursorOf(last)) : null,
  };
}
