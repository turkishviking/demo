import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto max-w-6xl space-y-3 px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Page introuvable</h1>
      <Link href="/" className="text-sm underline underline-offset-4">
        Retour au dashboard
      </Link>
    </main>
  );
}
