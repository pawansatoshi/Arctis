import {
  collection, query, orderBy, limit, getDocs,
  doc, setDoc, serverTimestamp, where, type Timestamp,
} from 'firebase/firestore';
import { getDb } from '@/lib/firebase/config';
import type { TreasuryLog } from '@/types';

const SNAPSHOTS_COL = 'treasury_snapshots';
const LOGS_COL      = 'treasury_logs';

export async function getTreasuryLogs(limitCount = 50): Promise<TreasuryLog[]> {
  const db = getDb();
  const q = query(collection(db, LOGS_COL), orderBy('createdAt', 'desc'), limit(limitCount));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    createdAt: (d.data().createdAt as Timestamp)?.toDate().toISOString() ?? new Date().toISOString(),
  })) as TreasuryLog[];
}

export async function logTreasuryEvent(
  type: TreasuryLog['type'],
  amount: number,
  description: string,
  walletAddress?: string,
  txHash?: string,
  meta?: {
    explorerUrl?: string;
    networkName?: string;
    chainId?: number;
    blockNumber?: string;
    gasUsed?: string;
  }
): Promise<void> {
  const db = getDb();
  await setDoc(doc(collection(db, LOGS_COL)), {
    type, amount, description,
    walletAddress: walletAddress?.toLowerCase() ?? null,
    txHash: txHash ?? null,
    explorerUrl: txHash && meta?.explorerUrl ? meta.explorerUrl : null,
    networkName: meta?.networkName ?? 'Arc Testnet',
    chainId: meta?.chainId ?? 5042002,
    blockNumber: meta?.blockNumber ?? null,
    gasUsed: meta?.gasUsed ?? null,
    createdAt: serverTimestamp(),
  });
}

export async function aggregateTreasuryMetrics(): Promise<{
  membershipRevenue30d: number;
  creditRevenue30d: number;
  aiSpend30d: number;
  txCount30d: number;
}> {
  const db = getDb();
  const since = new Date();
  since.setDate(since.getDate() - 30);

  try {
    const q = query(
      collection(db, LOGS_COL),
      where('createdAt', '>=', since),
      orderBy('createdAt', 'desc'),
      limit(500)
    );
    const snap = await getDocs(q);
    let membershipRevenue30d = 0, creditRevenue30d = 0, aiSpend30d = 0, txCount30d = 0;
    snap.docs.forEach((d) => {
      const data = d.data();
      txCount30d++;
      if (data.type === 'membership_payment') membershipRevenue30d += data.amount ?? 0;
      if (data.type === 'credit_purchase')    creditRevenue30d    += data.amount ?? 0;
      if (data.type === 'ai_spend')           aiSpend30d          += data.amount ?? 0;
    });
    return { membershipRevenue30d, creditRevenue30d, aiSpend30d, txCount30d };
  } catch {
    return { membershipRevenue30d: 0, creditRevenue30d: 0, aiSpend30d: 0, txCount30d: 0 };
  }
}
