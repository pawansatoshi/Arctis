'use client';

import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import {
  metaMaskWallet, okxWallet, bitgetWallet, trustWallet,
  braveWallet, walletConnectWallet, injectedWallet, coinbaseWallet,
} from '@rainbow-me/rainbowkit/wallets';
import { defineChain, fallback, http } from 'viem';
import { CHAIN_ID, RPC_FALLBACK_URLS, EXPLORER_URL } from '@/lib/contracts';

export const arcTestnet = defineChain({
  id: CHAIN_ID,
  name: 'Arc Testnet',
  nativeCurrency: { decimals: 18, name: 'Arc', symbol: 'ARC' },
  rpcUrls: {
    default: { http: RPC_FALLBACK_URLS },
    public:  { http: RPC_FALLBACK_URLS },
  },
  blockExplorers: {
    default: { name: 'ArcScan', url: EXPLORER_URL },
  },
  testnet: true,
});

// Fallback transport (Phase 18) — tries each RPC in order, moving to
// the next only on failure. Used by server-side viem clients
// (bridge attestation polling, swap executor, chain verification)
// that create their own clients rather than going through wagmi.
export const arcTransport = fallback(RPC_FALLBACK_URLS.map((url) => http(url)));

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? '';

export const wagmiConfig = getDefaultConfig({
  appName: 'ARCTIS',
  projectId,
  chains: [arcTestnet],
  wallets: [
    {
      groupName: 'Recommended',
      wallets: [metaMaskWallet, okxWallet, bitgetWallet, coinbaseWallet, braveWallet, trustWallet],
    },
    {
      groupName: 'Other',
      wallets: [injectedWallet, walletConnectWallet],
    },
  ],
  ssr: true,
});
