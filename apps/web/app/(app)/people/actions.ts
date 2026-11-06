'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { ActionState } from '@/lib/action-state';
import { failure, field } from '@/lib/actions';
import { deactivatePerson, getPerson, registerPerson, renamePerson } from '@/lib/api/cardholders';
import { readYourWrite } from '@/lib/api/consistency';

/** US-CH-1 : enregistre la personne puis ouvre sa page, une fois projetée. */
export async function registerPersonAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let id: string;
  try {
    ({ id } = await registerPerson({
      firstName: field(formData, 'firstName'),
      lastName: field(formData, 'lastName'),
      email: field(formData, 'email'),
    }));
  } catch (error) {
    return failure(error);
  }
  await readYourWrite(
    () => getPerson(id),
    (person) => person !== null,
  );
  revalidatePath('/people');
  redirect(`/people/${id}`);
}

export async function renamePersonAction(
  personId: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const firstName = field(formData, 'firstName').trim();
  const lastName = field(formData, 'lastName').trim();
  try {
    await renamePerson(personId, { firstName, lastName });
  } catch (error) {
    return failure(error);
  }
  await readYourWrite(
    () => getPerson(personId),
    (p) => p?.firstName === firstName && p.lastName === lastName,
  );
  revalidatePath(`/people/${personId}`);
  return { status: 'success', message: 'Nom mis à jour.' };
}

/** US-CH-2 : la personne est désactivée ; son retrait du groupe suit en asynchrone. */
export async function deactivatePersonAction(personId: string): Promise<ActionState> {
  try {
    await deactivatePerson(personId);
  } catch (error) {
    return failure(error);
  }
  await readYourWrite(
    () => getPerson(personId),
    (p) => p?.status === 'DEACTIVATED' && p.group === null,
  );
  revalidatePath(`/people/${personId}`);
  return { status: 'success', message: 'Personne désactivée.' };
}
