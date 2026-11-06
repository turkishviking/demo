import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold tracking-tight">Page introuvable</h1>
      <Link href="/" className="text-sm underline underline-offset-4">
        Retour au dashboard
      </Link>
    </div>
  );
}
