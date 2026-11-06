'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const LINKS: Array<{ href: Route; label: string }> = [
  { href: '/', label: 'Dashboard' },
  { href: '/people', label: 'Personnes' },
  { href: '/groups', label: 'Groupes' },
];

export function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

/** Navigation principale. Les entrées Cartes, Transactions et Simulation arrivent avec M2 à M4. */
export function AppNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Navigation principale" className="flex gap-1">
      {LINKS.map(({ href, label }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-accent',
              active ? 'bg-accent font-medium text-accent-foreground' : 'text-muted-foreground',
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
