import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PersonStatusBadge } from '@/components/domain/status-badges';
import { ActionForm } from '@/components/forms/action-form';
import { ConfirmAction } from '@/components/forms/confirm-action';
import { TextField } from '@/components/forms/text-field';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getPerson } from '@/lib/api/cardholders';
import { formatDateTime } from '@/lib/format';
import { PageHeader } from '../../page-header';
import { deactivatePersonAction, renamePersonAction } from '../actions';

export async function generateMetadata({ params }: PageProps<'/people/[id]'>): Promise<Metadata> {
  const person = await getPerson((await params).id);
  return { title: person ? `${person.firstName} ${person.lastName}` : 'Personne' };
}

/** Détail d'une personne (US-RE-3 CA3) ; cartes et total dépensé arrivent avec M2 et M3. */
export default async function PersonPage({ params }: PageProps<'/people/[id]'>) {
  const { id } = await params;
  const person = await getPerson(id);
  if (!person) notFound();
  const active = person.status === 'ACTIVE';

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${person.firstName} ${person.lastName}`}
        description={
          <span className="flex items-center gap-2">
            {person.email} <PersonStatusBadge status={person.status} />
          </span>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Informations</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 text-sm sm:grid-cols-[10rem_1fr]">
            <dt className="text-muted-foreground">Groupe</dt>
            <dd>
              {person.group ? (
                <Link href={`/groups/${person.group.id}`} className="underline underline-offset-4">
                  {person.group.name}
                </Link>
              ) : (
                'Aucun groupe'
              )}
            </dd>
            <dt className="text-muted-foreground">Inscrite le</dt>
            <dd>{formatDateTime(person.registeredAt)}</dd>
          </dl>
        </CardContent>
      </Card>

      {active ? (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Renommer</CardTitle>
            </CardHeader>
            <CardContent>
              <ActionForm action={renamePersonAction.bind(null, person.id)} submitLabel="Renommer">
                <TextField
                  label="Prénom"
                  name="firstName"
                  defaultValue={person.firstName}
                  required
                />
                <TextField label="Nom" name="lastName" defaultValue={person.lastName} required />
              </ActionForm>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Désactiver</CardTitle>
            </CardHeader>
            <CardContent>
              <ConfirmAction
                action={deactivatePersonAction.bind(null, person.id)}
                label="Désactiver la personne"
                confirmLabel="Confirmer la désactivation"
                description="La personne sera retirée de son groupe et ne pourra plus être modifiée ni réactivée."
              />
            </CardContent>
          </Card>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Cette personne est désactivée : elle ne peut plus être modifiée.
        </p>
      )}
    </div>
  );
}
