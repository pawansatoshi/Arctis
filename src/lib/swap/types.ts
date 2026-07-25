export type SwapToken = 'USDC' | 'tUSDC' | 'tARC';
export type SwapRouteId = 'usdc-tusdc' | 'tusdc-usdc' | 'usdc-tarc' | 'tarc-usdc' | 'tusdc-tarc' | 'tarc-tusdc';

export interface SwapRoute {
  id: SwapRouteId;
  fromToken: SwapToken;
  toToken: SwapToken;
  rate: number;       // units of toToken per 1 unit of fromToken
  feeBps: number;      // fee in basis points (30 = 0.3%)
  enabled: boolean;
}

export type SwapStatus = 'pending' | 'confirming' | 'dispatching' | 'completed' | 'failed';

export interface SwapRecord {
  id: string;              // document ID, also used as idempotency key = inboundTxHash
  walletAddress: string;
  routeId: SwapRouteId;
  fromToken: SwapToken;
  toToken: SwapToken;
  inputAmount: number;
  outputAmount: number;
  fee: number;
  inboundTxHash: string;
  outboundTxHash?: string;
  status: SwapStatus;
  failureReason?: string;
  createdAt: string;
  completedAt?: string;
}

export interface SwapQuote {
  routeId: SwapRouteId;
  fromToken: SwapToken;
  toToken: SwapToken;
  inputAmount: number;
  outputAmount: number;
  fee: number;
  feeBps: number;
  rate: number;
}

export const SWAP_MIN_AMOUNT = 0.01;
export const SWAP_MAX_AMOUNT = 100000;
