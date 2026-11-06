import type { Metadata } from 'next';
import Link from 'next/link';
import { PaginationLinks } from '@/components/domain/pagination-links';
import { GroupStatusBadge } from '@/components/domain/status-badges';
import { Button } from '@/components/ui/button';
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
import { listGroups } from '@/lib/api/cardholders';
import { oneOf, param } from '@/lib/search-params';
import { PageHeader } from '../page-header';

export const metadata: Metadata = { title: 'Groupes' };

const STATUSES = ['ACTIVE', 'ARCHIVED'] as const;

export default async function GroupsPage({ searchParams }: PageProps<'/groups'>) {
  const params = await searchParams;
  const filters = { status: oneOf(params, 'status', STATUSES), cursor: param(params, 'cursor') };
  const page = await listGroups(filters);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Groupes"
        description="Familles, équipes ou entreprises : de 1 à 50 membres."
        actions={
          <Button asChild>
            <Link href="/groups/new">Nouveau groupe</Link>
          </Button>
        }
      />

      <form className="flex flex-wrap items-end gap-3">
        <div className="grid gap-2">
          <Label htmlFor="status">Statut</Label>
          <NativeSelect id="status" name="status" defaultValue={filters.status ?? ''}>
            <option value="">Tous</option>
            <option value="ACTIVE">Actifs</option>
            <option value="ARCHIVED">Archivés</option>
          </NativeSelect>
        </div>
        <Button type="submit" variant="secondary">
          Filtrer
        </Button>
      </form>

      <Table>
        <TableCaption>
          {page.items.length === 0 ? 'Aucun groupe trouvé.' : 'Groupes, les plus récents d’abord.'}
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Nom</TableHead>
            <TableHead className="text-right">Membres</TableHead>
            <TableHead>Statut</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {page.items.map((group) => (
            <TableRow key={group.id}>
              <TableCell>
                <Link href={`/groups/${group.id}`} className="font-medium hover:underline">
                  {group.name}
                </Link>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {group.memberCount} / {group.maxMembers}
              </TableCell>
              <TableCell>
                <GroupStatusBadge status={group.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <PaginationLinks basePath="/groups" params={filters} nextCursor={page.nextCursor} />
    </div>
  );
}
