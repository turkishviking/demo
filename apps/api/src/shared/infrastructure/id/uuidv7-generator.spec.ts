import { Uuidv7Generator } from './uuidv7-generator';

describe('Uuidv7Generator', () => {
  it('produces RFC 9562 version 7 UUIDs', () => {
    const id = new Uuidv7Generator().next();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('encodes the timestamp in the first 48 bits so ids sort by creation time', () => {
    const ts = 0x0190_0000_0000;
    const id = new Uuidv7Generator(
      () => ts,
      (n) => new Uint8Array(n),
    ).next();
    expect(id).toBe('01900000-0000-7000-8000-000000000000');

    const earlier = new Uuidv7Generator(() => 1_000).next();
    const later = new Uuidv7Generator(() => 2_000).next();
    expect(earlier < later).toBe(true);
  });

  it('generates distinct ids', () => {
    const generator = new Uuidv7Generator();
    const ids = new Set(Array.from({ length: 1000 }, () => generator.next()));
    expect(ids.size).toBe(1000);
  });
});
