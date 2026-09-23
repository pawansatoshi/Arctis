import { defineChain, fallback, http } from 'viem';
import { CHAIN_ID, RPC_FALLBACK_URLS, EXPLORER_URL, NETWORK_NAME } from '@/lib/contracts';

// Kept under the existing export name for compatibility with current imports.
// Its values always come from exactly one selected network profile.
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

export const arcTransport = fallback(RPC_FALLBACK_URLS.map((url) => http(url)));
