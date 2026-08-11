import 'server-only';
import { FieldValue, type QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase/admin';
import type { SwapRoute, SwapRouteId, SwapRecord, SwapQuote, SwapToken } from './types';

const COL = 'swap_records';

// OTC route registry for ARCTIS-owned tUSDC/tARC.
// These are NOT Circle App Kit Swap assets. Circle App Kit Swap is kept for
// supported market assets; ARCTIS owns the liquidity, pricing and settlement
// policy for these custom testnet tokens.
export const DEFAULT_ROUTES: Record<SwapRouteId, SwapRoute> = {
  'usdc-tusdc': { id: 'usdc-tusdc', fromToken: 'USDC',  toToken: 'tUSDC', rate: 1, feeBps: 30, enabled: true },
  'tusdc-usdc': { id: 'tusdc-usdc', fromToken: 'tUSDC', toToken: 'USDC',  rate: 1, feeBps: 30, enabled: true },
  'usdc-tarc':  { id: 'usdc-tarc',  fromToken: 'USDC',  toToken: 'tARC',  rate: 150, feeBps: 30, enabled: true },
  'tarc-usdc':  { id: 'tarc-usdc',  fromToken: 'tARC',  toToken: 'USDC',  rate: 1 / 150, feeBps: 30, enabled: true },
  'tusdc-tarc': { id: 'tusdc-tarc', fromToken: 'tUSDC', toToken: 'tARC',  rate: 150, feeBps: 30, enabled: true },
  'tarc-tusdc': { id: 'tarc-tusdc', fromToken: 'tARC', toToken: 'tUSDC', rate: 1 / 150, feeBps: 30, enabled: true },
};

export function getRouteId(fromToken: SwapToken, toToken: SwapToken): SwapRouteId | null {
  const entry = Object.values(DEFAULT_ROUTES).find((r) => r.fromToken === fromToken && r.toToken === toToken);
  return entry?.id ?? null;
}

export function getSwapRoute(routeId: SwapRouteId): SwapRoute | null {
  return DEFAULT_ROUTES[routeId] ?? null;
}

export function calculateSwapQuote(routeId: SwapRouteId, inputAmount: number): SwapQuote | null {
  const route = getSwapRoute(routeId);
  if (!route || !route.enabled || !Number.isFinite(inputAmount) || inputAmount <= 0) return null;

  const fee = inputAmount * (route.feeBps / 10_000);
  const netInput = inputAmount - fee;
  const outputAmount = netInput * route.rate;

  return {
    routeId,
    fromToken: route.fromToken,
    toToken: route.toToken,
    inputAmount,
    outputAmount,
    fee,
    feeBps: route.feeBps,
    rate: route.rate,
  };
}

function toIso(ts: unknown): string {
  if (!ts) return new Date().toISOString();
  if (typeof ts === 'string') return ts;
  if (ts instanceof Date) return ts.toISOString();
  if (ts && typeof (ts as { toDate?: () => Date }).toDate === 'function') return (ts as { toDate: () => Date }).toDate().toISOString();
  return new Date().toISOString();
}

export async function swapTxAlreadyProcessed(inboundTxHash: string): Promise<SwapRecord | null> {
  try {
    const db = getAdminDb();
    const snap = await db.collection(COL).doc(inboundTxHash).get();
    if (!snap.exists) return null;
    const d = snap.data()!;
    return { ...d, id: inboundTxHash, createdAt: toIso(d.createdAt), completedAt: d.completedAt ? toIso(d.completedAt) : undefined } as SwapRecord;
  } catch { return null; }
}

export async function createSwapRecord(data: Omit<SwapRecord, 'createdAt' | 'completedAt'>): Promise<void> {
  const db = getAdminDb();
  await db.collection(COL).doc(data.id).set({
    ...data,
    walletAddress: data.walletAddress.toLowerCase(),
    createdAt: FieldValue.serverTimestamp(),
  });
}

export async function updateSwapRecord(
  id: string,
  updates: Partial<Pick<SwapRecord, 'status' | 'outboundTxHash' | 'failureReason' | 'completedAt'>>
): Promise<void> {
  try {
    const db = getAdminDb();
    await db.collection(COL).doc(id).update({ ...updates, updatedAt: FieldValue.serverTimestamp() });
  } catch { /* non-critical */ }
}

export async function getSwapHistory(walletAddress: string, max = 50): Promise<SwapRecord[]> {
  try {
    const db = getAdminDb();
    const snap = await db.collection(COL)
      .where('walletAddress', '==', walletAddress.toLowerCase())
      .orderBy('createdAt', 'desc')
      .limit(max)
      .get();
    return snap.docs.map((d: QueryDocumentSnapshot) => {
      const data = d.data();
      return { ...data, id: d.id, createdAt: toIso(data.createdAt), completedAt: data.completedAt ? toIso(data.completedAt) : undefined } as SwapRecord;
    });
  } catch { return []; }
}
