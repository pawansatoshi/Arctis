import 'server-only';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase/admin';
import type { TransactionRecord } from '@/types';

const COL = 'transactions';

export async function saveTransaction(
  walletAddress: string,
  tx: Omit<TransactionRecord, 'id' | 'createdAt' | 'walletAddress'>
): Promise<string> {
  const db = getAdminDb();
  const ref = await db.collection(COL).add({
    ...tx,
    walletAddress: walletAddress.toLowerCase(),
    createdAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

export async function updateTransactionStatus(
  docId: string,
  status: TransactionRecord['status'],
  txHash?: string
): Promise<void> {
  const db = getAdminDb();
  await db.collection(COL).doc(docId).update({
    status,
    ...(txHash && { txHash }),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function getTransactionHistory(
  walletAddress: string,
  limitCount = 50
): Promise<TransactionRecord[]> {
  const db = getAdminDb();
  const snap = await db.collection(COL)
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
  }) as TransactionRecord[];
}
