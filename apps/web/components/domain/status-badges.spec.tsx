import { render, screen } from '@testing-library/react';
import { GroupStatusBadge, PersonStatusBadge } from './status-badges';

describe('status badges', () => {
  it.each([
    ['ACTIVE', 'Active'],
    ['DEACTIVATED', 'Désactivée'],
  ] as const)('shows person status %s', (status, label) => {
    render(<PersonStatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it.each([
    ['ACTIVE', 'Actif'],
    ['ARCHIVED', 'Archivé'],
  ] as const)('shows group status %s', (status, label) => {
    render(<GroupStatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});
