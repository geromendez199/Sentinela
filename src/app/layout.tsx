import type { Metadata } from 'next';
import './globals.css';
import { ToastProvider } from '@/components/ui/toast-provider';

export const metadata: Metadata = {
  title: 'Sentinela ML',
  description:
    'Motor predictivo de proteccion de reputacion y resolucion proactiva de reclamos para vendedores de MercadoLibre.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen antialiased"><ToastProvider>{children}</ToastProvider></body>
    </html>
  );
}
