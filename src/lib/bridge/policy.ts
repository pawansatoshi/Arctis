import type { BridgeChain } from './types';

export type BridgeExecutionMode = 'forwarder' | 'direct_cctp';

export interface BridgePolicy {
  mode: BridgeExecutionMode;
  destinationGasRequired: boolean;
  label: string;
  explanation: string;
}

/**
 * ARCTIS bridge policy.
 *
 * Circle App Kit supports the CCTP Forwarding Service through
 * `to.useForwarder`. When enabled, Circle submits the destination mint,
 * so the end-user does not need destination-chain native gas.
 *
 * Keep this decision deterministic and outside the LLM. The Economic Agent
 * may explain the selected policy, but it must never invent it.
 */
export function getBridgePolicy(): BridgePolicy {
  return {
    mode: 'forwarder',
    destinationGasRequired: false,
    label: 'Circle Forwarding',
    explanation: 'Circle handles the destination mint, so the recipient does not need native gas on the destination chain.',
  };
}

export function validateBridgeRoute(
  source: BridgeChain,
  destination: BridgeChain,
): void {
  if (source.chainId === destination.chainId) {
    throw new Error('Source and destination networks must be different.');
  }

  if (!source.enabled || !destination.enabled) {
    throw new Error('This bridge route is currently unavailable.');
  }
}
