import { MEMO_CONTRACT, MEMO_ABI } from '@/lib/contracts';

export interface TransferMemoPayload { type: 'transfer'; transferId: string; toPassport?: string; note?: string; }
export interface SwapMemoPayload { type: 'swap'; swapId: string; routeId: string; fromToken: string; toToken: string; }
export interface BridgeMemoPayload { type: 'bridge'; bridgeId: string; sourceDomain: number; destinationDomain: number; sourceChain: string; }
export interface CreditsMemoPayload { type: 'credits'; packageId: string; purchaseId: string; credits: number; }
export interface MembershipMemoPayload { type: 'membership'; membershipId: string; tier: string; walletAddress: string; }

export type MemoPayload = TransferMemoPayload | SwapMemoPayload | BridgeMemoPayload | CreditsMemoPayload | MembershipMemoPayload;

export function encodeMemoPayload(payload: MemoPayload): `0x${string}` {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `0x${hex}`;
}

export function buildTransferMemo(transferId: string, toPassport?: string, note?: string): `0x${string}` {
  return encodeMemoPayload({ type: 'transfer', transferId, toPassport, note });
}
export function buildSwapMemo(swapId: string, routeId: string, fromToken: string, toToken: string): `0x${string}` {
  return encodeMemoPayload({ type: 'swap', swapId, routeId, fromToken, toToken });
}
export function buildBridgeMemo(bridgeId: string, sourceDomain: number, destinationDomain: number, sourceChain: string): `0x${string}` {
  return encodeMemoPayload({ type: 'bridge', bridgeId, sourceDomain, destinationDomain, sourceChain });
}
export function buildCreditsMemo(packageId: string, purchaseId: string, credits: number): `0x${string}` {
  return encodeMemoPayload({ type: 'credits', packageId, purchaseId, credits });
}
export function buildMembershipMemo(membershipId: string, tier: string, walletAddress: string): `0x${string}` {
  return encodeMemoPayload({ type: 'membership', membershipId, tier, walletAddress });
}

export function getMemoCallConfig(memoData: `0x${string}`) {
  return { address: MEMO_CONTRACT as `0x${string}`, abi: MEMO_ABI, functionName: 'memo' as const, args: [memoData] as readonly [`0x${string}`] };
}

export const MEMO_ENABLED_KEY = 'arctis:memos:enabled';
export function isMemoEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  const stored = localStorage.getItem(MEMO_ENABLED_KEY);
  return stored === null ? true : stored === 'true';
}
export function setMemoEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(MEMO_ENABLED_KEY, String(enabled));
}
