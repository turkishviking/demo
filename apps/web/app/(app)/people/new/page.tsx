import type { Metadata } from 'next';
import { ActionForm } from '@/components/forms/action-form';
import { TextField } from '@/components/forms/text-field';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '../../page-header';
import { registerPersonAction } from '../actions';

export const metadata: Metadata = { title: 'Nouvelle personne' };

export default function NewPersonPage() {
  return (
    <div className="max-w-lg space-y-6">
      <PageHeader title="Nouvelle personne" description="L’email doit être unique." />
      <Card>
        <CardContent>
          <ActionForm action={registerPersonAction} submitLabel="Enregistrer">
            <TextField
              label="Prénom"
              name="firstName"
              required
              maxLength={100}
              autoComplete="off"
            />
            <TextField label="Nom" name="lastName" required maxLength={100} autoComplete="off" />
            <TextField label="Email" name="email" type="email" required autoComplete="off" />
          </ActionForm>
        </CardContent>
      </Card>
    </div>
  );
}
