'use client';

import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import {
  metaMaskWallet, okxWallet, bitgetWallet, trustWallet,
  braveWallet, walletConnectWallet, injectedWallet, coinbaseWallet,
} from '@rainbow-me/rainbowkit/wallets';
import { defineChain, fallback, http } from 'viem';
import { CHAIN_ID, RPC_FALLBACK_URLS, EXPLORER_URL, NETWORK_NAME } from '@/lib/contracts';

export const arcTestnet = defineChain({
  id: CHAIN_ID,
  name: NETWORK_NAME,
  nativeCurrency: { decimals: 18, name: 'USDC', symbol: 'USDC' },
  rpcUrls: {
    default: { http: RPC_FALLBACK_URLS },
    public:  { http: RPC_FALLBACK_URLS },
  },
  blockExplorers: {
    default: { name: 'Arc Explorer', url: EXPLORER_URL },
  },
  testnet: CHAIN_ID === 5042002,
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
  rpcUrls: { default: { http: ['https://sepolia-rollup.arbitrum.io/rpc'] }, public: { http: ['https://sepolia.arbiscan.io'] } },
  blockExplorers: { default: { name: 'Arbiscan', url: 'https://sepolia.arbiscan.io' } },
  testnet: true,
});

export const arcTransport = fallback(RPC_FALLBACK_URLS.map((url) => http(url)));

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? '';

export const wagmiConfig = getDefaultConfig({
  appName: 'ARCTIS',
  projectId,
  chains: [arcTestnet, ethereumSepolia, baseSepolia, arbitrumSepolia],
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
