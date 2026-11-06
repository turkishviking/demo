import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ActionState } from '@/lib/action-state';
import { ActionForm } from './action-form';
import { ConfirmAction } from './confirm-action';
import { FormFeedback } from './form-feedback';
import { TextField } from './text-field';

const groupFull: ActionState = {
  status: 'error',
  problem: { type: 't', title: 'Group full', status: 409, code: 'GROUP_FULL' },
};

describe('FormFeedback', () => {
  it('shows nothing while idle', () => {
    const { container } = render(<FormFeedback state={{ status: 'idle' }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the French message of an API error code', () => {
    render(<FormFeedback state={groupFull} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Ce groupe est complet.');
  });

  it('lists the invalid fields of a validation error', () => {
    render(
      <FormFeedback
        state={{
          status: 'error',
          problem: {
            type: 't',
            title: 'Invalid',
            status: 400,
            code: 'VALIDATION_ERROR',
            errors: [{ field: 'email', messages: ['email must be a string'] }],
          },
        }}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Champs concernés : email');
  });

  it('shows a success message', () => {
    render(<FormFeedback state={{ status: 'success', message: 'Membre ajouté.' }} />);
    expect(screen.getByRole('status')).toHaveTextContent('Membre ajouté.');
  });
});

describe('ActionForm', () => {
  it('submits the fields to the action and shows its error, keeping the input', async () => {
    const action = jest.fn(async (_state: ActionState, _data: FormData) => groupFull);
    render(
      <ActionForm action={action} submitLabel="Ajouter">
        <TextField label="Nom" name="name" />
      </ActionForm>,
    );

    await userEvent.type(screen.getByLabelText('Nom'), 'Team');
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Ce groupe est complet.');
    expect(action.mock.calls[0]![1].get('name')).toBe('Team');
    expect(screen.getByLabelText('Nom')).toHaveValue('Team');
  });

  it('resets the form after a success when asked', async () => {
    const action = jest.fn(async (): Promise<ActionState> => ({ status: 'success' }));
    render(
      <ActionForm action={action} submitLabel="Ajouter" resetOnSuccess>
        <TextField label="Nom" name="name" />
      </ActionForm>,
    );
    await userEvent.type(screen.getByLabelText('Nom'), 'Team');
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
    await waitFor(() => expect(screen.getByLabelText('Nom')).toHaveValue(''));
  });
});

describe('ConfirmAction', () => {
  it('asks for an explicit confirmation before running the action', async () => {
    const action = jest.fn(async (): Promise<ActionState> => ({
      status: 'success',
      message: 'Fait.',
    }));
    render(
      <ConfirmAction
        action={action}
        label="Désactiver"
        confirmLabel="Confirmer"
        description="Irréversible."
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Désactiver' }));
    expect(screen.getByText('Irréversible.')).toBeInTheDocument();
    expect(action).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(screen.queryByText('Irréversible.')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Désactiver' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmer' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Fait.');
    expect(action).toHaveBeenCalledTimes(1);
  });
});
