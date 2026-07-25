import {
  collection, addDoc, query, where, orderBy,
  getDocs, doc, getDoc, setDoc, increment,
  serverTimestamp, limit, runTransaction,
  type Timestamp,
} from 'firebase/firestore';
import { getDb } from '@/lib/firebase/config';
import type { CreditLedgerEntry, CreditBalance } from '@/types';

const LEDGER_COL  = 'credit_ledger';
const BALANCE_COL = 'credit_balances';

// ============================================================
// Credit Engine — Firebase backed
// ============================================================

export async function getCreditBalance(walletAddress: string): Promise<CreditBalance> {
  const db = getDb();
  const ref = doc(db, BALANCE_COL, walletAddress.toLowerCase());
  const snap = await getDoc(ref);
  if (!snap.exists()) return { total: 0, used: 0, remaining: 0 };
  const d = snap.data();
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
  const db = getDb();
  const addr = walletAddress.toLowerCase();

  await runTransaction(db, async (tx) => {
    const balRef = doc(db, BALANCE_COL, addr);
    const balSnap = await tx.get(balRef);
    const current = balSnap.exists() ? (balSnap.data().total ?? 0) : 0;
    const used     = balSnap.exists() ? (balSnap.data().used ?? 0) : 0;

    tx.set(balRef, { total: current + credits, used, updatedAt: serverTimestamp() }, { merge: true });

    const ledgerRef = doc(collection(db, LEDGER_COL));
    tx.set(ledgerRef, {
      walletAddress: addr,
      type,
      credits,
      balanceBefore: current,
      balanceAfter: current + credits,
      description,
      txHash: txHash ?? null,
      createdAt: serverTimestamp(),
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
  const db = getDb();
  const addr = walletAddress.toLowerCase();
  const balRef = doc(db, BALANCE_COL, addr);

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(balRef);
      const total = snap.exists() ? (snap.data().total ?? 0) : 0;
      const used  = snap.exists() ? (snap.data().used ?? 0) : 0;
      const remaining = total - used;

      if (remaining < credits) throw new Error('insufficient_credits');

      tx.set(balRef, { used: used + credits, updatedAt: serverTimestamp() }, { merge: true });

      const ledgerRef = doc(collection(db, LEDGER_COL));
      tx.set(ledgerRef, {
        walletAddress: addr,
        type: 'deduct',
        credits: -credits,
        balanceBefore: remaining,
        balanceAfter: remaining - credits,
        description,
        aiModel: aiModel ?? null,
        sessionId: sessionId ?? null,
        createdAt: serverTimestamp(),
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
  const db = getDb();
  const q = query(
    collection(db, LEDGER_COL),
    where('walletAddress', '==', walletAddress.toLowerCase()),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    createdAt: (d.data().createdAt as Timestamp)?.toDate().toISOString() ?? new Date().toISOString(),
  })) as CreditLedgerEntry[];
}
