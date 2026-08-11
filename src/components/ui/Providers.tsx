'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider, useTheme } from '@/lib/theme/ThemeProvider';
import { I18nProvider } from '@/lib/i18n';
import LanguageSwitcher from '@/components/i18n/LanguageSwitcher';

// ============================================================
// Providers — wallet providers render normally.
// wagmiConfig already uses ssr:true, so keep the provider tree
// available during the initial dashboard render.
// ============================================================

import WalletProviders from './WalletProviders';

interface ProvidersProps {
  children: ReactNode;
}

function ThemedToaster() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <Toaster
      position="bottom-right"
      gutter={8}
      containerStyle={{ zIndex: 9999 }}
      toastOptions={{
        duration: 4000,
        style: {
          background: isDark ? '#1c1c1f' : '#ffffff',
          color: isDark ? '#f4f4f5' : '#16171b',
          border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(15,23,42,0.08)',
          borderRadius: '12px',
          fontSize: '14px',
          fontFamily: 'var(--font-geist-sans)',
          boxShadow: isDark ? '0 4px 24px rgba(0,0,0,0.5)' : '0 4px 20px rgba(15,23,42,0.12)',
          padding: '12px 16px',
        },
        success: {
          iconTheme: { primary: '#10b981', secondary: isDark ? '#1c1c1f' : '#ffffff' },
        },
        error: {
          iconTheme: { primary: '#f43f5e', secondary: isDark ? '#1c1c1f' : '#ffffff' },
        },
      }}
    />
  );
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
    <ThemeProvider>
      <I18nProvider>
        <QueryClientProvider client={queryClient}>
          <WalletProviders>{children}</WalletProviders>
          <LanguageSwitcher />
          <ThemedToaster />
        </QueryClientProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
