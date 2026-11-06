import { connection } from 'next/server';
import { Suspense } from 'react';
import { ApiStatusBadge } from '@/components/domain/api-status-badge';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getHealth } from '@/lib/api/server';

/** Page d'arrivée : accessible directement, sans connexion (ADR-0006). */
export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <Suspense fallback={<Badge variant="secondary">Vérification de l’API…</Badge>}>
          <ApiStatus />
        </Suspense>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bienvenue sur CardSim</CardTitle>
          <CardDescription>
            Le socle technique est en place. Les indicateurs et les transactions arriveront avec les
            prochains jalons.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Groupes et personnes (M1), cartes (M2), transactions (M3), simulation (M4), dashboard
          (M5).
        </CardContent>
      </Card>
    </div>
  );
}

/** Server component : l'état de l'API est lu côté serveur, à chaque requête. */
async function ApiStatus() {
  await connection();
  const health = await getHealth();
  return <ApiStatusBadge health={health} />;
}
