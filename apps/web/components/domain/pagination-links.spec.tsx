import { render, screen } from '@testing-library/react';
import { pageHref, PaginationLinks } from './pagination-links';

describe('pageHref', () => {
  it('keeps filters, replaces the cursor', () => {
    expect(pageHref('/people', { q: 'ada', status: undefined, cursor: 'old' }, 'next')).toBe(
      '/people?q=ada&cursor=next',
    );
    expect(pageHref('/people', { cursor: 'old' })).toBe('/people');
  });
});

describe('PaginationLinks', () => {
  it('renders nothing on a single page', () => {
    const { container } = render(
      <PaginationLinks basePath="/people" params={{}} nextCursor={null} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('links to the next page and back to the first one', () => {
    render(
      <PaginationLinks
        basePath="/groups"
        params={{ status: 'ACTIVE', cursor: 'c1' }}
        nextCursor="c2"
      />,
    );
    expect(screen.getByRole('link', { name: 'Page suivante' })).toHaveAttribute(
      'href',
      '/groups?status=ACTIVE&cursor=c2',
    );
    expect(screen.getByRole('link', { name: 'Première page' })).toHaveAttribute(
      'href',
      '/groups?status=ACTIVE',
    );
  });
});
