import type { Brand } from '../../../shared/domain/brand';

export type GroupId = Brand<string, 'GroupId'>;

export const GroupId = {
  from: (value: string): GroupId => value as GroupId,
};
