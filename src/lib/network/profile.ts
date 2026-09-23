import { MAINNET_NETWORK, NETWORK_PROFILES, TESTNET_NETWORK, type NetworkEnv } from '@/lib/contracts';

export type { NetworkEnv };

export const DEFAULT_NETWORK_ENV: NetworkEnv = 'testnet';

export function normalizeNetworkEnv(value: string | null | undefined): NetworkEnv {
  return value === 'mainnet' ? 'mainnet' : 'testnet';
}

export function getNetworkProfile(env: NetworkEnv) {
  return NETWORK_PROFILES[env];
}

export function getSelectedNetworkEnv(): NetworkEnv {
  if (typeof window === 'undefined') return normalizeNetworkEnv(process.env.NEXT_PUBLIC_NETWORK_ENV);
  try {
    return normalizeNetworkEnv(window.localStorage.getItem('arctis-network-env'));
  } catch {
    return DEFAULT_NETWORK_ENV;
  }
}

export function getSelectedNetworkProfile() {
  return getNetworkProfile(getSelectedNetworkEnv());
}

export const NETWORK_CHAINS = {
  testnet: { chainId: TESTNET_NETWORK.chainId, name: TESTNET_NETWORK.networkName },
  mainnet: { chainId: MAINNET_NETWORK.chainId, name: MAINNET_NETWORK.networkName },
} as const;
