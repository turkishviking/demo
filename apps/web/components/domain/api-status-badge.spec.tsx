import { render, screen } from '@testing-library/react';
import { ApiStatusBadge } from './api-status-badge';

describe('ApiStatusBadge', () => {
  it('shows the API as operational', () => {
    render(<ApiStatusBadge health={{ status: 'ok', database: 'up' }} />);
    expect(screen.getByText('API opérationnelle')).toBeInTheDocument();
  });

  it('shows a database outage', () => {
    render(<ApiStatusBadge health={{ status: 'degraded', database: 'down' }} />);
    expect(screen.getByText('Base de données indisponible')).toBeInTheDocument();
  });

  it('shows an unreachable API', () => {
    render(<ApiStatusBadge health={null} />);
    expect(screen.getByText('API injoignable')).toBeInTheDocument();
  });
});
