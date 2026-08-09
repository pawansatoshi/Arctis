import 'server-only';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase/admin';
import type { CreditLedgerEntry, CreditBalance } from '@/types';

const LEDGER_COL  = 'credit_ledger';
const BALANCE_COL = 'credit_balances';

// ============================================================
// Credit Engine — Firebase Admin backed (server-only)
// ============================================================

export async function getCreditBalance(walletAddress: string): Promise<CreditBalance> {
  const db = getAdminDb();
  const ref = db.collection(BALANCE_COL).doc(walletAddress.toLowerCase());
  const snap = await ref.get();
  if (!snap.exists) return { total: 0, used: 0, remaining: 0 };
  const d = snap.data()!;
  return {
    total: d.total ?? 0,
    used: d.used ?? 0,
    remaining: Math.max(0, (d.total ?? 0) - (d.used ?? 0)),
  };
}

export async function addCredits(
  walletAddress: string,
  credits: number,
  type: CreditLedgerEntry['type'],
  description: string,
  txHash?: string
): Promise<void> {
  const db = getAdminDb();
  const addr = walletAddress.toLowerCase();
  const balRef = db.collection(BALANCE_COL).doc(addr);

  await db.runTransaction(async (tx) => {
    const balSnap = await tx.get(balRef);
    const current = balSnap.exists ? (balSnap.data()!.total ?? 0) : 0;
    const used     = balSnap.exists ? (balSnap.data()!.used ?? 0) : 0;

    tx.set(balRef, { total: current + credits, used, updatedAt: FieldValue.serverTimestamp() }, { merge: true });

    const ledgerRef = db.collection(LEDGER_COL).doc();
    tx.set(ledgerRef, {
      walletAddress: addr,
      type,
      credits,
      balanceBefore: current,
      balanceAfter: current + credits,
      description,
      txHash: txHash ?? null,
      createdAt: FieldValue.serverTimestamp(),
    });
  });
}

export async function deductCredits(
  walletAddress: string,
  credits: number,
  description: string,
  aiModel?: string,
  sessionId?: string
): Promise<boolean> {
  const db = getAdminDb();
  const addr = walletAddress.toLowerCase();
  const balRef = db.collection(BALANCE_COL).doc(addr);

  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(balRef);
      const total = snap.exists ? (snap.data()!.total ?? 0) : 0;
      const used  = snap.exists ? (snap.data()!.used ?? 0) : 0;
      const remaining = total - used;

      if (remaining < credits) throw new Error('insufficient_credits');

      tx.set(balRef, { used: used + credits, updatedAt: FieldValue.serverTimestamp() }, { merge: true });

      const ledgerRef = db.collection(LEDGER_COL).doc();
      tx.set(ledgerRef, {
        walletAddress: addr,
        type: 'deduct',
        credits: -credits,
        balanceBefore: remaining,
        balanceAfter: remaining - credits,
        description,
        aiModel: aiModel ?? null,
        sessionId: sessionId ?? null,
        createdAt: FieldValue.serverTimestamp(),
      });
    });
    return true;
  } catch {
    return false;
  }
}

export async function getCreditHistory(
  walletAddress: string,
  limitCount = 50
): Promise<CreditLedgerEntry[]> {
  const db = getAdminDb();
  const snap = await db.collection(LEDGER_COL)
    .where('walletAddress', '==', walletAddress.toLowerCase())
    .orderBy('createdAt', 'desc')
    .limit(limitCount)
    .get();

  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      createdAt: data.createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    };
  }) as CreditLedgerEntry[];
}
