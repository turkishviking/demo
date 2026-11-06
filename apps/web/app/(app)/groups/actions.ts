'use server';

import type { GroupDetails } from '@cardsim/shared';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { ActionState } from '@/lib/action-state';
import { failure, field } from '@/lib/actions';
import {
  addMember,
  archiveGroup,
  changeGroupCapacity,
  createGroup,
  getGroup,
  removeMember,
  renameGroup,
} from '@/lib/api/cardholders';
import { readYourWrite } from '@/lib/api/consistency';

/**
 * Exécute la commande, attend que le read model du groupe reflète l'effet attendu
 * (cohérence éventuelle), puis rafraîchit la page du groupe.
 */
async function onGroup(
  groupId: string,
  command: () => Promise<void>,
  isApplied: (group: GroupDetails | null) => boolean,
  message: string,
): Promise<ActionState> {
  try {
    await command();
  } catch (error) {
    return failure(error);
  }
  await readYourWrite(() => getGroup(groupId), isApplied);
  revalidatePath(`/groups/${groupId}`);
  return { status: 'success', message };
}

export async function createGroupAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const capacity = field(formData, 'maxMembers');
  let id: string;
  try {
    ({ id } = await createGroup({
      name: field(formData, 'name'),
      ...(capacity === '' ? {} : { maxMembers: Number(capacity) }),
    }));
  } catch (error) {
    return failure(error);
  }
  await readYourWrite(
    () => getGroup(id),
    (group) => group !== null,
  );
  revalidatePath('/groups');
  redirect(`/groups/${id}`);
}

export async function renameGroupAction(groupId: string, _state: ActionState, formData: FormData) {
  const name = field(formData, 'name').trim();
  return onGroup(
    groupId,
    () => renameGroup(groupId, { name }),
    (g) => g?.name === name.replace(/\s+/g, ' '),
    'Groupe renommé.',
  );
}

export async function addMemberAction(groupId: string, _state: ActionState, formData: FormData) {
  const personId = field(formData, 'personId');
  return onGroup(
    groupId,
    () => addMember(groupId, personId),
    (g) => g?.members.some((m) => m.id === personId) ?? false,
    'Membre ajouté.',
  );
}

export async function removeMemberAction(groupId: string, personId: string) {
  return onGroup(
    groupId,
    () => removeMember(groupId, personId),
    (g) => !g?.members.some((m) => m.id === personId),
    'Membre retiré.',
  );
}

export async function changeCapacityAction(
  groupId: string,
  _state: ActionState,
  formData: FormData,
) {
  const maxMembers = Number(field(formData, 'maxMembers'));
  return onGroup(
    groupId,
    () => changeGroupCapacity(groupId, maxMembers),
    (g) => g?.maxMembers === maxMembers,
    'Capacité mise à jour.',
  );
}

export async function archiveGroupAction(groupId: string) {
  return onGroup(
    groupId,
    () => archiveGroup(groupId),
    (g) => g?.status === 'ARCHIVED',
    'Groupe archivé.',
  );
}
