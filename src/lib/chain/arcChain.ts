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

export const arcTransport = fallback(RPC_FALLBACK_URLS.map((url) => http(url)));
