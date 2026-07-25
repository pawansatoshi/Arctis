'use client';

import dynamic from 'next/dynamic';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Toaster } from 'react-hot-toast';

// ============================================================
// Providers — All wallet providers dynamically imported (SSR-safe)
// ============================================================

// Dynamic import prevents SSR crashes from window/ethereum access
const WalletProviders = dynamic(() => import('./WalletProviders'), {
  ssr: false,
  loading: () => null,
});

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 10_000,
            gcTime: 60_000,
            retry: 2,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <WalletProviders>{children}</WalletProviders>
      <Toaster
        position="bottom-right"
        gutter={8}
        containerStyle={{ zIndex: 9999 }}
        toastOptions={{
          duration: 4000,
          style: {
            background: '#1c1c1f',
            color: '#f4f4f5',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '12px',
            fontSize: '14px',
            fontFamily: 'var(--font-geist-sans)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
            padding: '12px 16px',
          },
          success: {
            iconTheme: { primary: '#10b981', secondary: '#1c1c1f' },
          },
          error: {
            iconTheme: { primary: '#f43f5e', secondary: '#1c1c1f' },
          },
        }}
      />
    </QueryClientProvider>
  );
}
