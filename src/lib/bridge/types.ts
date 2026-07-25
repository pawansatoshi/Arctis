// ============================================================
// Bridge Types — CCTP V2, Inbound Only, Testnet
// ============================================================

export type BridgeStatus =
  | 'approving'   // user signing ERC-20 approve on source chain
  | 'burning'     // user signing depositForBurn on source chain
  | 'attesting'   // server polling Circle Iris for attestation
  | 'forwarding'  // attestation complete, Forwarding Service minting on Arc
  | 'completed'   // forwardTxHash confirmed, proof records written
  | 'timeout'     // attestation did not complete in 10 min (funds safe, in transit)
  | 'failed';     // burn tx reverted before hash confirmed

export interface BridgePending {
  burnTxHash:        string;   // document ID — enforces idempotency
  walletAddress:     string;
  sourceChain:       string;
  sourceChainId:     number;
  sourceDomain:      number;
  destinationChain:  'Arc Testnet';
  destinationDomain: 26;
  amount:            number;   // human-readable USDC
  status:            BridgeStatus;
  forwardTxHash?:    string;
  failureReason?:    string;
  createdAt:         string;
  completedAt?:      string;
}

export interface BridgeQuote {
  sourceChain:       string;
  sourceChainId:     number;
  sourceDomain:      number;
  destinationChain:  'Arc Testnet';
  destinationDomain: 26;
  fee:               number;
  feeToken:          'USDC';
  estimatedTime:     string;
  minAmount:         number;
  maxAmount:         number;
  feeEstimated?:     boolean;
}

export interface AttestationMessage {
  status:         'pending_confirmations' | 'complete' | 'failed';
  attestation?:   string;
  message?:       string;
  forwardTxHash?: string;   // present when Forwarding Service has minted on Arc
}

export interface AttestationResponse {
  messages: AttestationMessage[];
}

export interface BridgeFeeResponse {
  finalityThreshold: number;
  minimumFee:        number;  // basis points of transfer amount
}

export interface BridgeExecuteRequest {
  burnTxHash:    string;
  sourceChainId: number;
  walletAddress: string;
  amount:        number;
}

export interface BridgeStatusResponse {
  status:         BridgeStatus | 'not_found';
  forwardTxHash?: string;
  completedAt?:   string;
  failureReason?: string;
}

export const BRIDGE_MIN_AMOUNT           = 1;
export const BRIDGE_MAX_AMOUNT           = 1000;
export const ATTESTATION_POLL_INTERVAL   = 5_000;
export const ATTESTATION_MAX_WAIT        = 10 * 60 * 1000;
