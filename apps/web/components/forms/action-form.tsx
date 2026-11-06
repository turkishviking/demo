'use client';

import { startTransition, useActionState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { type FormAction, IDLE } from '@/lib/action-state';
import { cn } from '@/lib/utils';
import { FormFeedback } from './form-feedback';

interface ActionFormProps {
  action: FormAction;
  children?: React.ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive';
  size?: 'default' | 'sm';
  /** Vide le formulaire après un succès (ex. ajout d'un membre). */
  resetOnSuccess?: boolean;
  className?: string;
}

/**
 * Formulaire branché sur une server action (`useActionState`). Fonctionne sans JS ; avec JS,
 * la saisie est conservée en cas d'erreur (pas de reset automatique de React 19).
 */
export function ActionForm({
  action,
  children,
  submitLabel,
  pendingLabel = 'Enregistrement…',
  variant = 'default',
  size = 'default',
  resetOnSuccess = false,
  className,
}: ActionFormProps) {
  const [state, formAction, pending] = useActionState(action, IDLE);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (resetOnSuccess && state.status === 'success') formRef.current?.reset();
  }, [resetOnSuccess, state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => formAction(formData));
      }}
      className={cn('space-y-3', className)}
    >
      {children}
      <Button type="submit" variant={variant} size={size} disabled={pending}>
        {pending ? pendingLabel : submitLabel}
      </Button>
      <FormFeedback state={state} />
    </form>
  );
}
