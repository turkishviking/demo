import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { GroupStatusBadge, PersonStatusBadge } from '@/components/domain/status-badges';
import { ActionForm } from '@/components/forms/action-form';
import { ConfirmAction } from '@/components/forms/confirm-action';
import { TextField } from '@/components/forms/text-field';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { NativeSelect } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getGroup, listPersons } from '@/lib/api/cardholders';
import { PageHeader } from '../../page-header';
import {
  addMemberAction,
  archiveGroupAction,
  changeCapacityAction,
  removeMemberAction,
  renameGroupAction,
} from '../actions';

export async function generateMetadata({ params }: PageProps<'/groups/[id]'>): Promise<Metadata> {
  const group = await getGroup((await params).id);
  return { title: group?.name ?? 'Groupe' };
}

/** Détail d'un groupe : membres, ajout et retrait, capacité, archivage (US-CH-3). */
export default async function GroupPage({ params }: PageProps<'/groups/[id]'>) {
  const { id } = await params;
  const [group, candidates] = await Promise.all([
    getGroup(id),
    listPersons({ status: 'ACTIVE', limit: 100 }),
  ]);
  if (!group) notFound();

  const active = group.status === 'ACTIVE';
  const full = group.memberCount >= group.maxMembers;
  const memberIds = new Set(group.members.map((m) => m.id));
  // Les personnes déjà dans un autre groupe restent proposées : l'API applique la règle
  // « un seul groupe par personne » et le message d'erreur l'explique.
  const options = candidates.items.filter((p) => !memberIds.has(p.id));

  return (
    <div className="space-y-6">
      <PageHeader
        title={group.name}
        description={
          <span className="flex items-center gap-2">
            {group.memberCount} / {group.maxMembers} membres{' '}
            <GroupStatusBadge status={group.status} />
          </span>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Membres</CardTitle>
          {full && active && <CardDescription>Le groupe est complet.</CardDescription>}
        </CardHeader>
        <CardContent className="space-y-6">
          <Table>
            <TableCaption>
              {group.members.length === 0
                ? 'Ce groupe n’a aucun membre.'
                : `Membres de ${group.name}.`}
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Statut</TableHead>
                {active && <TableHead className="sr-only">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {group.members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <Link href={`/people/${member.id}`} className="font-medium hover:underline">
                      {member.firstName} {member.lastName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{member.email}</TableCell>
                  <TableCell>
                    <PersonStatusBadge status={member.status} />
                  </TableCell>
                  {active && (
                    <TableCell className="text-right">
                      <ActionForm
                        action={removeMemberAction.bind(null, group.id, member.id)}
                        submitLabel={`Retirer ${member.firstName} ${member.lastName}`}
                        pendingLabel="Retrait…"
                        variant="ghost"
                        size="sm"
                      />
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {active && (
            <ActionForm
              action={addMemberAction.bind(null, group.id)}
              submitLabel="Ajouter au groupe"
              resetOnSuccess
              className="max-w-md"
            >
              <div className="grid gap-2">
                <Label htmlFor="personId">Ajouter une personne</Label>
                <NativeSelect id="personId" name="personId" required defaultValue="">
                  <option value="" disabled>
                    Choisir une personne active…
                  </option>
                  {options.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.firstName} {p.lastName}
                      {p.group ? ` — membre de ${p.group.name}` : ''}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </ActionForm>
          )}
        </CardContent>
      </Card>

      {active ? (
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Renommer</CardTitle>
            </CardHeader>
            <CardContent>
              <ActionForm action={renameGroupAction.bind(null, group.id)} submitLabel="Renommer">
                <TextField label="Nom" name="name" defaultValue={group.name} required />
              </ActionForm>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Capacité</CardTitle>
            </CardHeader>
            <CardContent>
              <ActionForm action={changeCapacityAction.bind(null, group.id)} submitLabel="Modifier">
                <TextField
                  label="Nombre maximum de membres"
                  name="maxMembers"
                  type="number"
                  min={1}
                  max={50}
                  defaultValue={group.maxMembers}
                  required
                />
              </ActionForm>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Archiver</CardTitle>
              <CardDescription>Seul un groupe sans membre peut être archivé.</CardDescription>
            </CardHeader>
            <CardContent>
              <ConfirmAction
                action={archiveGroupAction.bind(null, group.id)}
                label="Archiver le groupe"
                confirmLabel="Confirmer l’archivage"
                description="Un groupe archivé ne peut plus être modifié."
              />
            </CardContent>
          </Card>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Ce groupe est archivé : il ne peut plus être modifié.
        </p>
      )}
    </div>
  );
}
