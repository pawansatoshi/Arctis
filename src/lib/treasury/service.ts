import 'server-only';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase/admin';
import type { TreasuryLog } from '@/types';

const SNAPSHOTS_COL = 'treasury_snapshots';
const LOGS_COL      = 'treasury_logs';

export async function getTreasuryLogs(limitCount = 50): Promise<TreasuryLog[]> {
  const db = getAdminDb();
  const snap = await db.collection(LOGS_COL).orderBy('createdAt', 'desc').limit(limitCount).get();
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      createdAt: data.createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    };
  }) as TreasuryLog[];
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
  const db = getAdminDb();
  await db.collection(LOGS_COL).doc().set({
    type, amount, description,
    walletAddress: walletAddress?.toLowerCase() ?? null,
    txHash: txHash ?? null,
    explorerUrl: txHash && meta?.explorerUrl ? meta.explorerUrl : null,
    networkName: meta?.networkName ?? 'Arc Testnet',
    chainId: meta?.chainId ?? 5042002,
    blockNumber: meta?.blockNumber ?? null,
    gasUsed: meta?.gasUsed ?? null,
    createdAt: FieldValue.serverTimestamp(),
  });
}

export async function aggregateTreasuryMetrics(): Promise<{
  membershipRevenue30d: number;
  creditRevenue30d: number;
  aiSpend30d: number;
  txCount30d: number;
}> {
  const db = getAdminDb();
  const since = new Date();
  since.setDate(since.getDate() - 30);

  try {
    const snap = await db.collection(LOGS_COL)
      .where('createdAt', '>=', since)
      .orderBy('createdAt', 'desc')
      .limit(500)
      .get();
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
