import type { HealthDto } from '@cardsim/shared';
import { Badge } from '@/components/ui/badge';

/** Composant de présentation pur : affiche l'état de l'API à partir du résultat de `/health`. */
export function ApiStatusBadge({ health }: { health: HealthDto | null }) {
  if (!health) return <Badge variant="destructive">API injoignable</Badge>;
  if (health.database === 'down')
    return <Badge variant="destructive">Base de données indisponible</Badge>;
  return <Badge variant="success">API opérationnelle</Badge>;
}
