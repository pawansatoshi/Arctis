// ============================================================
// Bridge Types — CCTP V2 / Circle App Kit, Bidirectional
// ============================================================

export type BridgeStatus =
  | 'approving'
  | 'burning'
  | 'attesting'
  | 'forwarding'
  | 'completed'
  | 'timeout'
  | 'failed';

export interface BridgePending {
  burnTxHash: string;
  walletAddress: string;
  sourceChain: string;
  sourceChainId: number;
  sourceDomain: number;
  destinationChain: string;
  destinationChainId: number;
  destinationDomain: number;
  amount: number;
  status: BridgeStatus;
  forwardTxHash?: string;
  failureReason?: string;
  createdAt: string;
  completedAt?: string;
}

export interface BridgeQuote {
  sourceChain: string;
  sourceChainId: number;
  sourceDomain: number;
  destinationChain: string;
  destinationChainId: number;
  destinationDomain: number;
  fee: number;
  feeToken: 'USDC';
  estimatedTime: string;
  minAmount: number;
  maxAmount: number;
  feeEstimated?: boolean;
}

export interface BridgeExecuteRequest {
  burnTxHash: string;
  sourceChainId: number;
  destinationChainId: number;
  walletAddress: string;
  amount: number;
}

export interface BridgeStatusResponse {
  status: BridgeStatus | 'not_found';
  forwardTxHash?: string;
  completedAt?: string;
  failureReason?: string;
}

export const BRIDGE_MIN_AMOUNT = 0.000001;
export const BRIDGE_MAX_AMOUNT = 1000;
export const ATTESTATION_POLL_INTERVAL = 5_000;
export const ATTESTATION_MAX_WAIT = 10 * 60 * 1000;
