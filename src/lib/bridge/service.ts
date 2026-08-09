import 'server-only';
import { FieldValue, type QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase/admin';
import type { BridgePending, BridgeStatus } from './types';

const COL = 'bridge_pending';

function toIso(ts: unknown): string {
  if (!ts) return new Date().toISOString();
  if (typeof ts === 'string') return ts;
  if (ts instanceof Date) return ts.toISOString();
  if (ts && typeof (ts as { toDate?: () => Date }).toDate === 'function') return (ts as { toDate: () => Date }).toDate().toISOString();
  return new Date().toISOString();
}

export async function createBridgePending(
  data: Omit<BridgePending, 'createdAt' | 'completedAt'>
): Promise<void> {
  const db = getAdminDb();
  await db.collection(COL).doc(data.burnTxHash).set({
    ...data,
    walletAddress: data.walletAddress.toLowerCase(),
    createdAt: FieldValue.serverTimestamp(),
  });
}

export async function updateBridgePending(
  burnTxHash: string,
  updates: Partial<Pick<BridgePending, 'status' | 'forwardTxHash' | 'failureReason' | 'completedAt'>>
): Promise<void> {
  try {
    const db = getAdminDb();
    await db.collection(COL).doc(burnTxHash).update({ ...updates, updatedAt: FieldValue.serverTimestamp() });
  } catch { /* non-critical */ }
}

export async function getBridgePending(burnTxHash: string): Promise<BridgePending | null> {
  try {
    const db = getAdminDb();
    const snap = await db.collection(COL).doc(burnTxHash).get();
    if (!snap.exists) return null;
    const d = snap.data()!;
    return { ...d, burnTxHash, createdAt: toIso(d.createdAt), completedAt: d.completedAt ? toIso(d.completedAt) : undefined } as BridgePending;
  } catch { return null; }
}

export async function bridgeTxAlreadyProcessed(burnTxHash: string): Promise<BridgePending | null> {
  return getBridgePending(burnTxHash);
}

export async function getBridgeHistory(walletAddress: string, max = 50): Promise<BridgePending[]> {
  try {
    const db = getAdminDb();
    const snap = await db.collection(COL)
      .where('walletAddress', '==', walletAddress.toLowerCase())
      .orderBy('createdAt', 'desc')
      .limit(max)
      .get();
    return snap.docs.map((d: QueryDocumentSnapshot) => {
      const data = d.data();
      return { ...data, burnTxHash: d.id, createdAt: toIso(data.createdAt), completedAt: data.completedAt ? toIso(data.completedAt) : undefined } as BridgePending;
    });
  } catch { return []; }
}

export function isActiveBridgeStatus(status: BridgeStatus): boolean {
  return ['approving', 'burning', 'attesting', 'forwarding'].includes(status);
}
