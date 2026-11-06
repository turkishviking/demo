import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'CardSim', template: '%s · CardSim' },
  description: 'Simulateur de transactions par carte — démo de stack',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className="min-h-dvh bg-background text-foreground">{children}</body>
    </html>
  );
}
