import { decodeCursor, encodeCursor, pageSize, toPage } from './pagination';

describe('pagination', () => {
  it('round-trips an opaque cursor', () => {
    const cursor = { sortKey: '2026-01-01T10:00:00.000Z', id: 'abc' };
    const encoded = encodeCursor(cursor);
    expect(encoded).not.toContain('|');
    expect(decodeCursor(encoded)).toEqual(cursor);
  });

  it('treats an absent or empty cursor as the first page', () => {
    expect(decodeCursor(undefined)).toBeNull();
    expect(decodeCursor('')).toBeNull();
  });

  it.each([
    'garbage',
    Buffer.from('|id').toString('base64url'),
    Buffer.from('key|').toString('base64url'),
  ])('rejects a malformed cursor %p', (raw) => {
    expect(() => decodeCursor(raw)).toThrow(expect.objectContaining({ code: 'INVALID_CURSOR' }));
  });

  it('defaults to 25 items and caps at 100', () => {
    expect(pageSize(undefined)).toBe(25);
    expect(pageSize(0)).toBe(1);
    expect(pageSize(500)).toBe(100);
    expect(pageSize(10.7)).toBe(10);
  });

  it('builds a page with a next cursor only when more rows exist', () => {
    const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const cursorOf = (r: { id: string }) => ({ sortKey: 'k', id: r.id });

    const full = toPage(rows, 2, cursorOf);
    expect(full.items).toEqual([{ id: 'a' }, { id: 'b' }]);
    expect(decodeCursor(full.nextCursor!)).toEqual({ sortKey: 'k', id: 'b' });

    expect(toPage(rows, 3, cursorOf).nextCursor).toBeNull();
    expect(toPage([], 3, cursorOf)).toEqual({ items: [], nextCursor: null });
  });
});
