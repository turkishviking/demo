import { render, screen } from '@testing-library/react';
import { AppNav, isActive } from './app-nav';

const pathname = jest.fn(() => '/groups/123');
jest.mock('next/navigation', () => ({ usePathname: () => pathname() }));

describe('AppNav', () => {
  it('marks the current section', () => {
    render(<AppNav />);
    expect(screen.getByRole('link', { name: 'Groupes' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current');
  });

  it('matches the dashboard only on /', () => {
    expect(isActive('/', '/')).toBe(true);
    expect(isActive('/people', '/')).toBe(false);
    expect(isActive('/people', '/people')).toBe(true);
    expect(isActive('/peoples', '/people')).toBe(false);
  });
});
