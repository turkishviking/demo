import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CardSim',
  description: 'Simulateur de transactions par carte — démo de stack',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className="min-h-dvh">
        <header className="border-b">
          <div className="mx-auto flex h-14 max-w-6xl items-center px-4 sm:px-6">
            <span className="font-semibold tracking-tight">CardSim</span>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
      </body>
    </html>
  );
}
