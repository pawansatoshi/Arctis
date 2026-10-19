import 'server-only';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase/admin';
import { TESTNET_NETWORK, MAINNET_NETWORK } from '@/lib/contracts';
import type { NetworkEnv } from '@/lib/contracts';

export type ActivityType =
  | 'transfer_completed'
  | 'swap_completed'
  | 'bridge_completed'
  | 'bridge_failed'
  | 'credit_purchase'
  | 'membership_purchase';

export type ActivityCategory = 'wallet' | 'ai' | 'agent' | 'treasury' | 'system';

export interface ActivityEvent {
  walletAddress: string;
  type: ActivityType;
  category: ActivityCategory;
  title: string;
  description: string;
  severity: 'info' | 'success' | 'warning' | 'error';
  metadata: {
    txHash?: string;
    explorerURL?: string;
    amount?: number;
    token?: string;
    toAddress?: string;
    fromAddress?: string;
    routeId?: string;
    fromToken?: string;
    toToken?: string;
    outboundTxHash?: string;
    outboundExplorerURL?: string;
    sourceChain?: string;
    tier?: string;
    creditsUsed?: number;
    chainId?: number;
    networkName?: string;
  };
}

const COL = 'activity';

export async function writeActivity(event: ActivityEvent): Promise<void> {
  try {
    const db = getAdminDb();
    const ref = db.collection(COL).doc();
    await ref.set({ ...event, createdAt: FieldValue.serverTimestamp() });
  } catch (err) {
    // Non-critical, never block the primary operation — but log it so a
    // real failure (e.g. Admin SDK misconfigured) isn't silently invisible.
    console.error('[writeActivity] failed:', (err as Error).message);
  }
}

// ─── Network-aware explorer URL builder (server-side) ───────────────────────
// Always use this instead of the build-time txUrl() from contracts.ts. The
// activity events written to Firestore must carry the correct explorer URL for
// the network the transaction was submitted on — not the build-time default.

function explorerTxUrl(txHash: string, network: NetworkEnv): string {
  const profile = network === 'mainnet' ? MAINNET_NETWORK : TESTNET_NETWORK;
  return `${profile.explorer}/tx/${txHash}`;
}

// ─── Activity builders ───────────────────────────────────────────────────────
// Each builder accepts the network that the underlying transaction belongs to.
// This stamps the correct explorer URL and chain ID into Firestore at write
// time, making history reads reliable regardless of the server's build-time
// NEXT_PUBLIC_NETWORK_ENV configuration.

export function buildTransferActivity(
  walletAddress: string,
  toAddress: string,
  amount: string,
  token: string,
  txHash: string,
  network: NetworkEnv = 'testnet',
  chainId?: number,
): ActivityEvent {
  const profile = network === 'mainnet' ? MAINNET_NETWORK : TESTNET_NETWORK;
  return {
    walletAddress,
    type: 'transfer_completed',
    category: 'wallet',
    title: `Sent ${amount} ${token}`,
    description: `To ${toAddress.slice(0, 10)}…`,
    severity: 'success',
    metadata: {
      txHash,
      explorerURL: explorerTxUrl(txHash, network),
      amount: parseFloat(amount),
      token,
      toAddress,
      chainId: chainId ?? profile.chainId,
      networkName: profile.networkName,
    },
  };
}

export function buildSwapActivity(
  walletAddress: string,
  routeId: string,
  fromToken: string,
  toToken: string,
  inputAmount: number,
  outputAmount: number,
  inboundTxHash: string,
  outboundTxHash: string,
  network: NetworkEnv = 'testnet',
  chainId?: number,
): ActivityEvent {
  const profile = network === 'mainnet' ? MAINNET_NETWORK : TESTNET_NETWORK;
  return {
    walletAddress,
    type: 'swap_completed',
    category: 'wallet',
    title: `Swapped ${fromToken} → ${toToken}`,
    description: `${inputAmount} ${fromToken} → ${outputAmount.toFixed(4)} ${toToken}`,
    severity: 'success',
    metadata: {
      txHash: inboundTxHash,
      explorerURL: explorerTxUrl(inboundTxHash, network),
      outboundTxHash,
      outboundExplorerURL: explorerTxUrl(outboundTxHash, network),
      amount: inputAmount,
      token: fromToken,
      fromToken,
      toToken,
      routeId,
      chainId: chainId ?? profile.chainId,
      networkName: profile.networkName,
    },
  };
}

export function buildBridgeActivity(
  walletAddress: string,
  amount: number,
  sourceChain: string,
  burnTxHash: string,
  forwardTxHash: string,
  network: NetworkEnv = 'testnet',
  destinationChainId?: number,
): ActivityEvent {
  const profile = network === 'mainnet' ? MAINNET_NETWORK : TESTNET_NETWORK;
  const destinationLabel = network === 'mainnet' ? 'Arc Mainnet' : 'Arc Testnet';
  return {
    walletAddress,
    type: 'bridge_completed',
    category: 'wallet',
    title: `Bridged ${amount} USDC to ${destinationLabel}`,
    description: `From ${sourceChain} via Circle CCTP V2`,
    severity: 'success',
    metadata: {
      txHash: burnTxHash,
      explorerURL: explorerTxUrl(burnTxHash, network),
      amount,
      token: 'USDC',
      sourceChain,
      outboundTxHash: forwardTxHash,
      outboundExplorerURL: explorerTxUrl(forwardTxHash, network),
      chainId: destinationChainId ?? profile.chainId,
      networkName: profile.networkName,
    },
  };
}
