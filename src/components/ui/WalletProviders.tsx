'use client';

import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { type ReactNode } from 'react';
import { wagmiConfig } from '@/lib/chain/wagmi';
import '@rainbow-me/rainbowkit/styles.css';

// ============================================================
// WalletProviders — Client-only, dynamically imported
// ============================================================

interface WalletProvidersProps {
  children: ReactNode;
}

const rainbowTheme = darkTheme({
  accentColor: '#3b82f6',
  accentColorForeground: 'white',
  borderRadius: 'medium',
  fontStack: 'system',
  overlayBlur: 'small',
});

// Customize RainbowKit theme tokens
const customTheme = {
  ...rainbowTheme,
  colors: {
    ...rainbowTheme.colors,
    modalBackground: '#111113',
    modalBorder: 'rgba(255,255,255,0.08)',
    menuItemBackground: 'rgba(255,255,255,0.04)',
    profileForeground: '#1c1c1f',
    profileAction: '#232326',
    profileActionHover: '#2c2c30',
    selectedOptionBorder: 'rgba(59, 130, 246, 0.4)',
    connectButtonBackground: '#111113',
    connectButtonInnerBackground: 'rgba(59,130,246,0.1)',
    downloadBottomCardBackground: '#1c1c1f',
    downloadTopCardBackground: '#232326',
    generalBorder: 'rgba(255,255,255,0.08)',
    generalBorderDim: 'rgba(255,255,255,0.04)',
    connectionIndicator: '#10b981',
  },
};

export default function WalletProviders({ children }: WalletProvidersProps) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <RainbowKitProvider theme={customTheme} modalSize="compact">
        {children}
      </RainbowKitProvider>
    </WagmiProvider>
  );
}
