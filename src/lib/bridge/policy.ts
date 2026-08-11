export type BridgeExecutionMode = 'forwarder' | 'direct_cctp';

export interface BridgeChainPolicyInput {
  chainId: number;
  enabled: boolean;
}

export interface BridgePolicy {
  mode: BridgeExecutionMode;
  destinationGasRequired: boolean;
  label: string;
  explanation: string;
}

/**
 * ARCTIS bridge execution policy.
 *
 * Circle App Kit supports the CCTP Forwarding Service through
 * `to.useForwarder`. With it enabled, Circle submits the destination mint,
 * so the end-user does not need destination-chain native gas.
 *
 * This decision is deterministic and must stay outside the LLM. The
 * Economic Agent can explain the policy, but it cannot invent it.
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
  source: BridgeChainPolicyInput,
  destination: BridgeChainPolicyInput,
): void {
  if (source.chainId === destination.chainId) {
    throw new Error('Source and destination networks must be different.');
  }

  if (!source.enabled || !destination.enabled) {
    throw new Error('This bridge route is currently unavailable.');
  }
}
