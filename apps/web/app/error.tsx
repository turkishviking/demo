'use client';

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold tracking-tight">Une erreur est survenue</h1>
      <button type="button" onClick={reset} className="text-sm underline underline-offset-4">
        Réessayer
      </button>
    </div>
  );
}
