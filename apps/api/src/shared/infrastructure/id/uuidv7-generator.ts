import { randomBytes } from 'node:crypto';
import type { IdGenerator } from '../../application/id-generator.port';

/**
 * UUID v7 (RFC 9562) : 48 bits de timestamp en millisecondes + aléatoire.
 * Les ids sont triables par date de création, ce qui garde les index B-tree compacts.
 */
export class Uuidv7Generator implements IdGenerator {
  constructor(
    private readonly nowMs: () => number = Date.now,
    private readonly random: (size: number) => Uint8Array = randomBytes,
  ) {}

  next(): string {
    const bytes = new Uint8Array(16);
    const timestamp = BigInt(this.nowMs());
    for (let i = 0; i < 6; i++) {
      bytes[i] = Number((timestamp >> BigInt(8 * (5 - i))) & 0xffn);
    }
    bytes.set(this.random(10), 6);
    bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x70; // version 7
    bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80; // variante RFC 4122

    const hex = Buffer.from(bytes).toString('hex');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
}
