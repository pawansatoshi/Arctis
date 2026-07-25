import {
  doc, getDoc, setDoc, updateDoc, collection,
  query, where, orderBy, limit, getDocs, serverTimestamp,
  type Timestamp, type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { getDb } from '@/lib/firebase/config';
import type { BridgePending, BridgeStatus } from './types';

const COL = 'bridge_pending';

function toIso(ts: unknown): string {
  if (!ts) return new Date().toISOString();
  if (typeof ts === 'string') return ts;
  if (ts instanceof Date) return ts.toISOString();
  if (ts && typeof (ts as Timestamp).toDate === 'function') return (ts as Timestamp).toDate().toISOString();
  return new Date().toISOString();
}

export async function createBridgePending(
  data: Omit<BridgePending, 'createdAt' | 'completedAt'>
): Promise<void> {
  const db = getDb();
  await setDoc(doc(db, COL, data.burnTxHash), {
    ...data,
    walletAddress: data.walletAddress.toLowerCase(),
    createdAt: serverTimestamp(),
  });
}

export async function updateBridgePending(
  burnTxHash: string,
  updates: Partial<Pick<BridgePending, 'status' | 'forwardTxHash' | 'failureReason' | 'completedAt'>>
): Promise<void> {
  try {
    const db = getDb();
    await updateDoc(doc(db, COL, burnTxHash), { ...updates, updatedAt: serverTimestamp() });
  } catch { /* non-critical */ }
}

export async function getBridgePending(burnTxHash: string): Promise<BridgePending | null> {
  try {
    const db = getDb();
    const snap = await getDoc(doc(db, COL, burnTxHash));
    if (!snap.exists()) return null;
    const d = snap.data();
    return { ...d, burnTxHash, createdAt: toIso(d.createdAt), completedAt: d.completedAt ? toIso(d.completedAt) : undefined } as BridgePending;
  } catch { return null; }
}

export async function bridgeTxAlreadyProcessed(burnTxHash: string): Promise<BridgePending | null> {
  return getBridgePending(burnTxHash);
}

export async function getBridgeHistory(walletAddress: string, max = 50): Promise<BridgePending[]> {
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
      return { ...data, burnTxHash: d.id, createdAt: toIso(data.createdAt), completedAt: data.completedAt ? toIso(data.completedAt) : undefined } as BridgePending;
    });
  } catch { return []; }
}

export function isActiveBridgeStatus(status: BridgeStatus): boolean {
  return ['approving', 'burning', 'attesting', 'forwarding'].includes(status);
}
