import {
  doc, getDoc, setDoc, updateDoc, collection,
  query, where, orderBy, limit, getDocs, serverTimestamp,
  type Timestamp, type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { getDb } from '@/lib/firebase/config';
import type { SwapRoute, SwapRouteId, SwapRecord, SwapQuote, SwapToken } from './types';

const COL = 'swap_records';

// ── Route registry (locked scope: USDC ↔ tUSDC ↔ tARC) ──────
// Rates are OTC — set by the swap wallet's liquidity pricing.
// tUSDC and tARC have no external market; this is intentional
// per the locked "real liquidity, no fake settlement" rule —
// the swap wallet itself is the counterparty, holding real
// on-chain reserves it settles from.
export const DEFAULT_ROUTES: Record<SwapRouteId, SwapRoute> = {
  'usdc-tusdc': { id: 'usdc-tusdc', fromToken: 'USDC',  toToken: 'tUSDC', rate: 1,        feeBps: 30, enabled: true },
  'tusdc-usdc': { id: 'tusdc-usdc', fromToken: 'tUSDC', toToken: 'USDC',  rate: 1,        feeBps: 30, enabled: true },
  'usdc-tarc':  { id: 'usdc-tarc',  fromToken: 'USDC',  toToken: 'tARC',  rate: 150,      feeBps: 30, enabled: true },
  'tarc-usdc':  { id: 'tarc-usdc',  fromToken: 'tARC',  toToken: 'USDC',  rate: 0.006667, feeBps: 30, enabled: true },
  'tusdc-tarc': { id: 'tusdc-tarc', fromToken: 'tUSDC', toToken: 'tARC',  rate: 150,      feeBps: 30, enabled: true },
  'tarc-tusdc': { id: 'tarc-tusdc', fromToken: 'tARC',  toToken: 'tUSDC', rate: 0.006667, feeBps: 30, enabled: true },
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
  if (!route || !route.enabled) return null;
  const fee = inputAmount * (route.feeBps / 10_000);
  const netInput = inputAmount - fee;
  const outputAmount = netInput * route.rate;
  return {
    routeId, fromToken: route.fromToken, toToken: route.toToken,
    inputAmount, outputAmount, fee, feeBps: route.feeBps, rate: route.rate,
  };
}

function toIso(ts: unknown): string {
  if (!ts) return new Date().toISOString();
  if (typeof ts === 'string') return ts;
  if (ts instanceof Date) return ts.toISOString();
  if (ts && typeof (ts as Timestamp).toDate === 'function') return (ts as Timestamp).toDate().toISOString();
  return new Date().toISOString();
}

/** Idempotency: inboundTxHash is the document ID. */
export async function swapTxAlreadyProcessed(inboundTxHash: string): Promise<SwapRecord | null> {
  try {
    const db = getDb();
    const snap = await getDoc(doc(db, COL, inboundTxHash));
    if (!snap.exists()) return null;
    const d = snap.data();
    return { ...d, id: inboundTxHash, createdAt: toIso(d.createdAt), completedAt: d.completedAt ? toIso(d.completedAt) : undefined } as SwapRecord;
  } catch { return null; }
}

export async function createSwapRecord(data: Omit<SwapRecord, 'createdAt' | 'completedAt'>): Promise<void> {
  const db = getDb();
  await setDoc(doc(db, COL, data.id), {
    ...data,
    walletAddress: data.walletAddress.toLowerCase(),
    createdAt: serverTimestamp(),
  });
}

export async function updateSwapRecord(
  id: string,
  updates: Partial<Pick<SwapRecord, 'status' | 'outboundTxHash' | 'failureReason' | 'completedAt'>>
): Promise<void> {
  try {
    const db = getDb();
    await updateDoc(doc(db, COL, id), { ...updates, updatedAt: serverTimestamp() });
  } catch { /* non-critical */ }
}

export async function getSwapHistory(walletAddress: string, max = 50): Promise<SwapRecord[]> {
  try {
    const db = getDb();
    const q = query(
      collection(db, COL),
      where('walletAddress', '==', walletAddress.toLowerCase()),
      orderBy('createdAt', 'desc'),
      limit(max)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d: QueryDocumentSnapshot) => {
      const data = d.data();
      return { ...data, id: d.id, createdAt: toIso(data.createdAt), completedAt: data.completedAt ? toIso(data.completedAt) : undefined } as SwapRecord;
    });
  } catch { return []; }
}
