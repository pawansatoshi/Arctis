import { defineChain, fallback, http } from 'viem';
import { CHAIN_ID, RPC_FALLBACK_URLS, EXPLORER_URL } from '@/lib/contracts';

/**
 * Arc Testnet uses USDC as its native gas asset.
 * The native RPC representation uses 18 decimals; the ERC-20 USDC
 * interface uses 6 decimals. They are one underlying balance, not two assets.
 */
export const arcTestnet = defineChain({
  id: CHAIN_ID,
  name: 'Arc Testnet',
  nativeCurrency: { decimals: 18, name: 'USDC', symbol: 'USDC' },
  rpcUrls: {
    default: { http: RPC_FALLBACK_URLS },
    public: { http: RPC_FALLBACK_URLS },
  },
  blockExplorers: {
    default: { name: 'ArcScan', url: EXPLORER_URL },
  },
  testnet: true,
});

export const arcTransport = fallback(RPC_FALLBACK_URLS.map((url) => http(url)));
