import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { Providers } from '@/components/ui/Providers';
import { assertEnvOrThrow } from '@/lib/security/env';
import './globals.css';

// Phase 18: validate required environment variables at startup.
// Runs server-side once per cold start. Never logs actual values.
assertEnvOrThrow();

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-geist-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'ARCTIS — The Web3 Operating System',
    template: '%s | ARCTIS',
  },
  description:
    'AI, Stablecoin, Knowledge, and Economic Agent operating systems in one platform. Built on Arc.',
  keywords: ['ARCTIS', 'Arc', 'stablecoin', 'AI agents', 'USDC', 'Web3', 'operating system'],
  authors: [{ name: 'ARCTIS' }],
  creator: 'ARCTIS',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: '/',
    title: 'ARCTIS — The Web3 Operating System',
    description: 'AI OS · Stablecoin OS · Knowledge OS · Economic Agent OS. Built on Arc.',
    siteName: 'ARCTIS',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ARCTIS — The Web3 Operating System',
    description: 'AI OS · Stablecoin OS · Knowledge OS · Economic Agent OS. Built on Arc.',
  },
  icons: {
    icon: [
      { url: '/icons/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: '/icons/icon-192.svg',
    shortcut: '/icons/favicon.svg',
  },
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} font-sans bg-surface-50 text-surface-950 antialiased`}
        suppressHydrationWarning
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
