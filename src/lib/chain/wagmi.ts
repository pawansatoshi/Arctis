'use client';

import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import {
  metaMaskWallet, okxWallet, bitgetWallet, trustWallet,
  braveWallet, walletConnectWallet, injectedWallet, coinbaseWallet,
} from '@rainbow-me/rainbowkit/wallets';
import { defineChain, fallback, http } from 'viem';
import { RPC_FALLBACK_URLS } from '@/lib/contracts';

export const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { decimals: 18, name: 'USDC', symbol: 'USDC' },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.arc.network', ...RPC_FALLBACK_URLS.filter((u) => u !== 'https://rpc.testnet.arc.network')] },
    public:  { http: ['https://rpc.testnet.arc.network', ...RPC_FALLBACK_URLS.filter((u) => u !== 'https://rpc.testnet.arc.network')] },
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

export const arcTransport = fallback(RPC_FALLBACK_URLS.map((url) => http(url)));

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? '';

export const wagmiConfig = getDefaultConfig({
  appName: 'ARCTIS',
  projectId,
  chains: [arcTestnet, arcMainnet, ethereumSepolia, baseSepolia, arbitrumSepolia],
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
