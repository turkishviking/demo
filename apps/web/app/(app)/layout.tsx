import Link from 'next/link';
import { AppNav } from '@/components/layout/app-nav';

/** Shell de l'application : accessible directement, sans connexion (ADR-0006). */
export default function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Link href="/" className="font-semibold tracking-tight">
            CardSim
          </Link>
          <AppNav />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </>
  );
}
