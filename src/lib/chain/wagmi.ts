'use client';

import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import {
  metaMaskWallet, okxWallet, bitgetWallet, trustWallet,
  walletConnectWallet, injectedWallet, coinbaseWallet, rabbyWallet,
} from '@rainbow-me/rainbowkit/wallets';
import { defineChain, fallback, http } from 'viem';

// ---------------------------------------------------------------------------
// Chain definitions
// ---------------------------------------------------------------------------

export const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { decimals: 18, name: 'USDC', symbol: 'USDC' },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.arc.io'] },
    public:  { http: ['https://rpc.testnet.arc.io'] },
  },
  blockExplorers: {
    default: { name: 'ArcScan', url: 'https://testnet.arcscan.app' },
  },
  testnet: true,
});

export const arcMainnet = defineChain({
  id: 5042,
  name: 'Arc Mainnet',
  nativeCurrency: { decimals: 18, name: 'USDC', symbol: 'USDC' },
  rpcUrls: {
    default: { http: ['https://rpc.mainnet.arc.io'] },
    public:  { http: ['https://rpc.mainnet.arc.io'] },
  },
  blockExplorers: {
    default: { name: 'Arc Explorer', url: 'https://explorer.arc.io' },
  },
});

export const ethereumSepolia = defineChain({
  id: 11155111,
  name: 'Ethereum Sepolia',
  nativeCurrency: { decimals: 18, name: 'Sepolia Ether', symbol: 'ETH' },
  rpcUrls: { default: { http: ['https://ethereum-sepolia-rpc.publicnode.com'] }, public: { http: ['https://ethereum-sepolia-rpc.publicnode.com'] } },
  blockExplorers: { default: { name: 'Etherscan', url: 'https://sepolia.etherscan.io' } },
  testnet: true,
});

export const baseSepolia = defineChain({
  id: 84532,
  name: 'Base Sepolia',
  nativeCurrency: { decimals: 18, name: 'Sepolia Ether', symbol: 'ETH' },
  rpcUrls: { default: { http: ['https://sepolia.base.org'] }, public: { http: ['https://sepolia.base.org'] } },
  blockExplorers: { default: { name: 'BaseScan', url: 'https://sepolia.basescan.org' } },
  testnet: true,
});

export const arbitrumSepolia = defineChain({
  id: 421614,
  name: 'Arbitrum Sepolia',
  nativeCurrency: { decimals: 18, name: 'Sepolia Ether', symbol: 'ETH' },
  rpcUrls: { default: { http: ['https://sepolia-rollup.arbitrum.io/rpc'] }, public: { http: ['https://sepolia-rollup.arbitrum.io/rpc'] } },
  blockExplorers: { default: { name: 'Arbiscan', url: 'https://sepolia.arbiscan.io' } },
  testnet: true,
});

// Wagmi must contain both network RPC definitions independently of build-time env.
export const arcTransport = fallback([http('https://rpc.testnet.arc.io')]);

// ---------------------------------------------------------------------------
// WalletConnect project ID — required for mobile WalletConnect fallback.
// Without this, walletConnectWallet silently fails on all mobile wallets.
// ---------------------------------------------------------------------------
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? '';

// ---------------------------------------------------------------------------
// Wallet list strategy for Brave Android mobile
//
// ROOT CAUSE: RainbowKit's braveWallet connector uses:
//   installed: hasInjectedProvider({ flag: 'isBraveWallet' })
//   createConnector: getInjectedConnector({ flag: 'isBraveWallet' })
//
// On Brave Android, window.ethereum.isBraveWallet is often undefined until
// after the user has already interacted with the provider — so `installed`
// evaluates to false at render time. When installed=false, RainbowKit shows
// the "Opening Brave Wallet… Confirm connection in the extension" screen,
// which deep-links to a browser extension that does not exist on Android.
// The connection gets permanently stuck.
//
// FIX STRATEGY:
//   1. Remove braveWallet from the explicit wallet list entirely.
//      On Brave (desktop or mobile), window.ethereum.isBraveWallet=true,
//      so the EIP-6963 auto-discovery in wagmi v2 + RainbowKit 2 WILL detect
//      Brave Wallet automatically via the RDNS "com.brave.wallet" and show it
//      as an injected provider — without the stuck extension-open flow.
//
//   2. Put injectedWallet FIRST in Recommended so any already-connected
//      window.ethereum provider (including Brave mobile) is immediately
//      available as "Browser Wallet" with no extension-check gate.
//
//   3. walletConnectWallet is kept as the explicit mobile fallback for wallets
//      that prefer WalletConnect scanning over injected provider.
//      Requires NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID to be set.
//
//   4. The WalletConnectionGuard component (see
//      src/components/ui/WalletConnectionGuard.tsx) adds a direct
//      eth_requestAccounts fallback button specifically for Brave mobile users
//      who see a stuck state, bypassing RainbowKit's modal entirely.
// ---------------------------------------------------------------------------
export const wagmiConfig = getDefaultConfig({
  appName: 'ARCTIS',
  projectId,
  chains: [arcTestnet, arcMainnet, ethereumSepolia, baseSepolia, arbitrumSepolia],
  transports: {
    // Testnet keeps a resilient read path so balance/gas queries do not depend
    // on a single public RPC endpoint. All fallbacks target Arc Testnet only.
    [arcTestnet.id]: fallback([
      http('https://rpc.testnet.arc.io'),
      http('https://rpc.testnet.arc.network'),
      http('https://rpc.drpc.testnet.arc.network'),
      http('https://rpc.quicknode.testnet.arc.network'),
    ]),
    // Mainnet remains explicitly isolated and never inherits Testnet RPCs.
    [arcMainnet.id]: http('https://rpc.mainnet.arc.io'),
    [ethereumSepolia.id]: http('https://ethereum-sepolia-rpc.publicnode.com'),
    [baseSepolia.id]: http('https://sepolia.base.org'),
    [arbitrumSepolia.id]: http('https://sepolia-rollup.arbitrum.io/rpc'),
  },
  wallets: [
    {
      // injectedWallet first so any window.ethereum (Brave mobile, Opera,
      // Samsung Internet built-in wallet, etc.) appears immediately without
      // an installation check gate.
      groupName: 'Recommended',
      wallets: [injectedWallet, metaMaskWallet, coinbaseWallet, okxWallet, bitgetWallet, trustWallet, rabbyWallet],
    },
    {
      groupName: 'Other',
      wallets: [walletConnectWallet],
    },
  ],
  ssr: true,
});
