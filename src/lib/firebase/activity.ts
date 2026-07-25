import { doc, setDoc, collection, serverTimestamp } from 'firebase/firestore';
import { getDb } from '@/lib/firebase/config';
import { txUrl } from '@/lib/contracts';

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
  };
}

const COL = 'activity';

export async function writeActivity(event: ActivityEvent): Promise<void> {
  try {
    const db = getDb();
    const ref = doc(collection(db, COL));
    await setDoc(ref, { ...event, createdAt: serverTimestamp() });
  } catch { /* non-critical, never block primary operation */ }
}

export function buildTransferActivity(
  walletAddress: string, toAddress: string, amount: string, token: string, txHash: string
): ActivityEvent {
  return {
    walletAddress,
    type: 'transfer_completed',
    category: 'wallet',
    title: `Sent ${amount} ${token}`,
    description: `To ${toAddress.slice(0, 10)}…`,
    severity: 'success',
    metadata: { txHash, explorerURL: txUrl(txHash), amount: parseFloat(amount), token, toAddress },
  };
}

export function buildSwapActivity(
  walletAddress: string, routeId: string, fromToken: string, toToken: string,
  inputAmount: number, outputAmount: number, inboundTxHash: string, outboundTxHash: string
): ActivityEvent {
  return {
    walletAddress,
    type: 'swap_completed',
    category: 'wallet',
    title: `Swapped ${fromToken} → ${toToken}`,
    description: `${inputAmount} ${fromToken} → ${outputAmount.toFixed(4)} ${toToken}`,
    severity: 'success',
    metadata: {
      txHash: inboundTxHash, explorerURL: txUrl(inboundTxHash),
      outboundTxHash, outboundExplorerURL: txUrl(outboundTxHash),
      amount: inputAmount, token: fromToken, fromToken, toToken, routeId,
    },
  };
}

export function buildBridgeActivity(
  walletAddress: string, amount: number, sourceChain: string,
  burnTxHash: string, forwardTxHash: string
): ActivityEvent {
  return {
    walletAddress,
    type: 'bridge_completed',
    category: 'wallet',
    title: `Bridged ${amount} USDC to Arc Testnet`,
    description: `From ${sourceChain} via Circle CCTP V2`,
    severity: 'success',
    metadata: {
      txHash: burnTxHash, amount, token: 'USDC', sourceChain,
      outboundTxHash: forwardTxHash, outboundExplorerURL: txUrl(forwardTxHash),
    },
  };
}
