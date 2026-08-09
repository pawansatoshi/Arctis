import 'server-only';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase/admin';
import type { UserMembership, MembershipTier } from '@/types';
import { addCredits } from '@/lib/credits/engine';
import { MEMBERSHIP_PLANS } from '@/lib/memberships/plans';

const MEMBERSHIPS_COL = 'memberships';
const TREASURY_COL    = 'treasury_logs';

// ============================================================
// Membership Service (Admin SDK, server-only)
// ============================================================

export async function getMembership(walletAddress: string): Promise<UserMembership | null> {
  const db = getAdminDb();
  const ref = db.collection(MEMBERSHIPS_COL).doc(walletAddress.toLowerCase());
  const snap = await ref.get();
  if (!snap.exists) return null;
  const d = snap.data()!;
  return {
    ...d,
    createdAt: d.createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    startDate: d.startDate ?? new Date().toISOString(),
    renewalDate: d.renewalDate ?? new Date().toISOString(),
  } as unknown as UserMembership;
}

export async function activateMembership(
  walletAddress: string,
  tier: MembershipTier,
  txHash: string
): Promise<void> {
  const db = getAdminDb();
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

  await db.collection(MEMBERSHIPS_COL).doc(addr).set({
    ...membership,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  // Grant monthly credits
  await addCredits(addr, plan.credits, 'bonus', `${plan.name} membership credits`, txHash);

  // Log treasury event
  if (plan.priceUSDC > 0) {
    await db.collection(TREASURY_COL).doc().set({
      type: 'membership_payment',
      amount: plan.priceUSDC,
      description: `${plan.name} subscription — ${addr.slice(0, 8)}`,
      walletAddress: addr,
      txHash,
      createdAt: FieldValue.serverTimestamp(),
    });
  }
}

export async function getRecentMemberships(limitCount = 20) {
  const db = getAdminDb();
  const snap = await db.collection(MEMBERSHIPS_COL).orderBy('updatedAt', 'desc').limit(limitCount).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
