import type { Metadata } from 'next';
import { ActionForm } from '@/components/forms/action-form';
import { TextField } from '@/components/forms/text-field';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '../../page-header';
import { createGroupAction } from '../actions';

export const metadata: Metadata = { title: 'Nouveau groupe' };

export default function NewGroupPage() {
  return (
    <div className="max-w-lg space-y-6">
      <PageHeader title="Nouveau groupe" description="Le nom doit être unique." />
      <Card>
        <CardContent>
          <ActionForm action={createGroupAction} submitLabel="Créer le groupe">
            <TextField
              label="Nom"
              name="name"
              required
              minLength={2}
              maxLength={60}
              autoComplete="off"
            />
            <TextField
              label="Capacité (membres)"
              name="maxMembers"
              type="number"
              min={1}
              max={50}
              defaultValue={10}
              required
            />
          </ActionForm>
        </CardContent>
      </Card>
    </div>
  );
}
