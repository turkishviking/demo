import 'server-only';
import type {
  CreatedDto,
  GroupDetails,
  GroupListItem,
  GroupStatus,
  Page,
  PersonDetails,
  PersonListItem,
  PersonStatus,
} from '@cardsim/shared';
import { apiFind, apiGet, apiRequest, queryString } from './server';

export interface PersonListParams {
  q?: string | undefined;
  status?: PersonStatus | undefined;
  groupId?: string | undefined;
  cursor?: string | undefined;
  limit?: number | undefined;
}

export interface GroupListParams {
  status?: GroupStatus | undefined;
  cursor?: string | undefined;
  limit?: number | undefined;
}

// Lectures (read models de Reporting)
export const listPersons = (params: PersonListParams = {}) =>
  apiGet<Page<PersonListItem>>(`/persons${queryString({ ...params })}`);
export const getPerson = (id: string) => apiFind<PersonDetails>(`/persons/${id}`);
export const listGroups = (params: GroupListParams = {}) =>
  apiGet<Page<GroupListItem>>(`/groups${queryString({ ...params })}`);
export const getGroup = (id: string) => apiFind<GroupDetails>(`/groups/${id}`);

// Commandes (context Cardholders)
export const registerPerson = (body: { firstName: string; lastName: string; email: string }) =>
  apiRequest<CreatedDto>('POST', '/persons', body);
export const renamePerson = (id: string, body: { firstName: string; lastName: string }) =>
  apiRequest<undefined>('POST', `/persons/${id}/rename`, body);
export const deactivatePerson = (id: string) =>
  apiRequest<undefined>('POST', `/persons/${id}/deactivate`);
export const createGroup = (body: { name: string; maxMembers?: number }) =>
  apiRequest<CreatedDto>('POST', '/groups', body);
export const renameGroup = (id: string, body: { name: string }) =>
  apiRequest<undefined>('POST', `/groups/${id}/rename`, body);
export const addMember = (id: string, personId: string) =>
  apiRequest<undefined>('POST', `/groups/${id}/members`, { personId });
export const removeMember = (id: string, personId: string) =>
  apiRequest<undefined>('DELETE', `/groups/${id}/members/${personId}`);
export const changeGroupCapacity = (id: string, maxMembers: number) =>
  apiRequest<undefined>('POST', `/groups/${id}/capacity`, { maxMembers });
export const archiveGroup = (id: string) => apiRequest<undefined>('POST', `/groups/${id}/archive`);
