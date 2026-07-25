import {
  doc, getDoc, setDoc, serverTimestamp, collection,
  query, where, getDocs, orderBy, limit, type Timestamp,
} from 'firebase/firestore';
import { getDb } from '@/lib/firebase/config';
import type { UserMembership, MembershipTier } from '@/types';
import { addCredits } from '@/lib/credits/engine';
import { MEMBERSHIP_PLANS } from '@/lib/memberships/plans';

const MEMBERSHIPS_COL = 'memberships';
const TREASURY_COL    = 'treasury_logs';

// ============================================================
// Membership Service
// ============================================================

export async function getMembership(walletAddress: string): Promise<UserMembership | null> {
  const db = getDb();
  const ref = doc(db, MEMBERSHIPS_COL, walletAddress.toLowerCase());
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const d = snap.data();
  return {
    ...d,
    createdAt: (d.createdAt as Timestamp)?.toDate().toISOString() ?? new Date().toISOString(),
    startDate: d.startDate ?? new Date().toISOString(),
    renewalDate: d.renewalDate ?? new Date().toISOString(),
  } as unknown as UserMembership;
}

export async function activateMembership(
  walletAddress: string,
  tier: MembershipTier,
  txHash: string
): Promise<void> {
  const db = getDb();
  const addr = walletAddress.toLowerCase();
  const plan = MEMBERSHIP_PLANS.find((p) => p.id === tier)!;
  const now = new Date();
  const renewal = new Date(now);
  renewal.setMonth(renewal.getMonth() + 1);

  const membership: Omit<UserMembership, 'userId'> = {
    walletAddress: addr,
    tier,
    status: 'active',
    startDate: now.toISOString(),
    renewalDate: renewal.toISOString(),
    txHash,
    autoRenew: false,
  };

  await setDoc(doc(db, MEMBERSHIPS_COL, addr), {
    ...membership,
    updatedAt: serverTimestamp(),
  }, { merge: true });

  // Grant monthly credits
  await addCredits(addr, plan.credits, 'bonus', `${plan.name} membership credits`, txHash);

  // Log treasury event
  if (plan.priceUSDC > 0) {
    await setDoc(doc(collection(db, TREASURY_COL)), {
      type: 'membership_payment',
      amount: plan.priceUSDC,
      description: `${plan.name} subscription — ${addr.slice(0, 8)}`,
      walletAddress: addr,
      txHash,
      createdAt: serverTimestamp(),
    });
  }
}

export async function getRecentMemberships(limitCount = 20) {
  const db = getDb();
  const q = query(
    collection(db, MEMBERSHIPS_COL),
    orderBy('updatedAt', 'desc'),
    limit(limitCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
