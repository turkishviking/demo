import type { Brand } from '../../../shared/domain/brand';

export type PersonId = Brand<string, 'PersonId'>;

export const PersonId = {
  from: (value: string): PersonId => value as PersonId,
};
