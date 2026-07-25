import {
  collection, addDoc, query, where, orderBy,
  getDocs, updateDoc, doc, serverTimestamp, limit,
  type Timestamp,
} from 'firebase/firestore';
import { getDb } from './config';
import type { TransactionRecord } from '@/types';

const COL = 'transactions';

export async function saveTransaction(
  walletAddress: string,
  tx: Omit<TransactionRecord, 'id' | 'createdAt' | 'walletAddress'>
): Promise<string> {
  const db = getDb();
  const ref = await addDoc(collection(db, COL), {
    ...tx,
    walletAddress: walletAddress.toLowerCase(),
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateTransactionStatus(
  docId: string,
  status: TransactionRecord['status'],
  txHash?: string
): Promise<void> {
  const db = getDb();
  await updateDoc(doc(db, COL, docId), {
    status,
    ...(txHash && { txHash }),
    updatedAt: serverTimestamp(),
  });
}

export async function getTransactionHistory(
  walletAddress: string,
  limitCount = 50
): Promise<TransactionRecord[]> {
  const db = getDb();
  const q = query(
    collection(db, COL),
    where('walletAddress', '==', walletAddress.toLowerCase()),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    createdAt: (d.data().createdAt as Timestamp)?.toDate().toISOString() ?? new Date().toISOString(),
  })) as TransactionRecord[];
}
