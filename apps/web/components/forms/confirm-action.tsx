'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/button';
import { type FormAction, IDLE } from '@/lib/action-state';
import { FormFeedback } from './form-feedback';

interface ConfirmActionProps {
  action: FormAction;
  label: string;
  confirmLabel: string;
  /** Conséquences expliquées avant la confirmation. */
  description: string;
}

/** Action destructive en deux temps : le bouton demande une confirmation explicite. */
export function ConfirmAction({ action, label, confirmLabel, description }: ConfirmActionProps) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState(action, IDLE);

  if (!confirming) {
    return (
      <div className="space-y-3">
        <Button type="button" variant="outline" onClick={() => setConfirming(true)}>
          {label}
        </Button>
        <FormFeedback state={state} />
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <p className="text-sm text-muted-foreground">{description}</p>
      <div className="flex gap-2">
        <Button type="submit" variant="destructive" disabled={pending}>
          {pending ? 'En cours…' : confirmLabel}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>
          Annuler
        </Button>
      </div>
      <FormFeedback state={state} />
    </form>
  );
}
