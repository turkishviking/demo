import type { Metadata } from 'next';
import Link from 'next/link';
import { PaginationLinks } from '@/components/domain/pagination-links';
import { PersonStatusBadge } from '@/components/domain/status-badges';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect } from '@/components/ui/input';
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
import { listPersons } from '@/lib/api/cardholders';
import { formatDateTime } from '@/lib/format';
import { oneOf, param } from '@/lib/search-params';
import { PageHeader } from '../page-header';

export const metadata: Metadata = { title: 'Personnes' };

const STATUSES = ['ACTIVE', 'DEACTIVATED'] as const;

/** Liste des personnes : filtres et pagination dans l'URL, rendu serveur (US-RE-2 CA3). */
export default async function PeoplePage({ searchParams }: PageProps<'/people'>) {
  const params = await searchParams;
  const filters = {
    q: param(params, 'q'),
    status: oneOf(params, 'status', STATUSES),
    cursor: param(params, 'cursor'),
  };
  const page = await listPersons(filters);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Personnes"
        description="Titulaires de cartes. Une personne fait partie d’au plus un groupe."
        actions={
          <Button asChild>
            <Link href="/people/new">Nouvelle personne</Link>
          </Button>
        }
      />

      {/* GET natif : les filtres fonctionnent sans JS et restent dans l'URL */}
      <form className="flex flex-wrap items-end gap-3" role="search">
        <div className="grid gap-2">
          <Label htmlFor="q">Recherche</Label>
          <Input
            id="q"
            name="q"
            defaultValue={filters.q}
            placeholder="Nom ou email"
            className="w-64"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="status">Statut</Label>
          <NativeSelect id="status" name="status" defaultValue={filters.status ?? ''}>
            <option value="">Tous</option>
            <option value="ACTIVE">Actives</option>
            <option value="DEACTIVATED">Désactivées</option>
          </NativeSelect>
        </div>
        <Button type="submit" variant="secondary">
          Filtrer
        </Button>
      </form>

      <Table>
        <TableCaption>
          {page.items.length === 0
            ? 'Aucune personne trouvée.'
            : 'Personnes, les plus récentes d’abord.'}
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Nom</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Groupe</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead>Inscrite le</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {page.items.map((person) => (
            <TableRow key={person.id}>
              <TableCell>
                <Link href={`/people/${person.id}`} className="font-medium hover:underline">
                  {person.firstName} {person.lastName}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">{person.email}</TableCell>
              <TableCell>
                {person.group ? (
                  <Link href={`/groups/${person.group.id}`} className="hover:underline">
                    {person.group.name}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                <PersonStatusBadge status={person.status} />
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDateTime(person.registeredAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <PaginationLinks basePath="/people" params={filters} nextCursor={page.nextCursor} />
    </div>
  );
}
