import type { GroupStatus, PersonStatus } from '@cardsim/shared';
import { Badge } from '@/components/ui/badge';

export function PersonStatusBadge({ status }: { status: PersonStatus }) {
  return status === 'ACTIVE' ? (
    <Badge variant="success">Active</Badge>
  ) : (
    <Badge variant="secondary">Désactivée</Badge>
  );
}

export function GroupStatusBadge({ status }: { status: GroupStatus }) {
  return status === 'ACTIVE' ? (
    <Badge variant="outline">Actif</Badge>
  ) : (
    <Badge variant="secondary">Archivé</Badge>
  );
}
