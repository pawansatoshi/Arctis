'use client';

import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, darkTheme, lightTheme } from '@rainbow-me/rainbowkit';
import { type ReactNode } from 'react';
import { wagmiConfig } from '@/lib/chain/wagmi';
import { useTheme } from '@/lib/theme/ThemeProvider';
import '@rainbow-me/rainbowkit/styles.css';

// ============================================================
// WalletProviders — Client-only, dynamically imported
// RainbowKit's own theme now follows the app's light/dark state.
// ============================================================

interface WalletProvidersProps {
  children: ReactNode;
}

const darkBase = darkTheme({
  accentColor: '#3b82f6',
  accentColorForeground: 'white',
  borderRadius: 'medium',
  fontStack: 'system',
  overlayBlur: 'small',
});

const darkRainbowTheme = {
  ...darkBase,
  colors: {
    ...darkBase.colors,
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

const lightBase = lightTheme({
  accentColor: '#3b82f6',
  accentColorForeground: 'white',
  borderRadius: 'medium',
  fontStack: 'system',
  overlayBlur: 'small',
});

const lightRainbowTheme = {
  ...lightBase,
  colors: {
    ...lightBase.colors,
    modalBackground: '#ffffff',
    modalBorder: 'rgba(15,23,42,0.08)',
    menuItemBackground: 'rgba(15,23,42,0.03)',
    profileForeground: '#f7f8fa',
    profileAction: '#f0f1f4',
    profileActionHover: '#e4e6eb',
    selectedOptionBorder: 'rgba(59, 130, 246, 0.35)',
    connectButtonBackground: '#ffffff',
    connectButtonInnerBackground: 'rgba(59,130,246,0.08)',
    downloadBottomCardBackground: '#f7f8fa',
    downloadTopCardBackground: '#f0f1f4',
    generalBorder: 'rgba(15,23,42,0.08)',
    generalBorderDim: 'rgba(15,23,42,0.04)',
    connectionIndicator: '#10b981',
  },
};

export default function WalletProviders({ children }: WalletProvidersProps) {
  const { theme } = useTheme();

  return (
    <WagmiProvider config={wagmiConfig}>
      <RainbowKitProvider theme={theme === 'dark' ? darkRainbowTheme : lightRainbowTheme} modalSize="compact">
        {children}
      </RainbowKitProvider>
    </WagmiProvider>
  );
}
