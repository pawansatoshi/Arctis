import 'server-only';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase/admin';
import type { UserMembership, MembershipTier } from '@/types';
import { addCredits } from '@/lib/credits/engine';
import { MEMBERSHIP_PLANS } from '@/lib/memberships/plans';

const MEMBERSHIPS_COL = 'memberships';
const TREASURY_COL = 'treasury_logs';

function addOneCalendarMonth(date: Date): Date {
  const result = new Date(date);
  const originalDay = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + 1);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(originalDay, lastDay));
  return result;
}

function normalizeMembership(data: Record<string, unknown>, walletAddress: string): UserMembership {
  const startDate = String(data.activationDate ?? data.startDate ?? new Date().toISOString());
  const expiryDate = String(data.expiryDate ?? data.renewalDate ?? startDate);
  const storedStatus = (data.status as UserMembership['status']) ?? 'active';
  const expired = storedStatus === 'active' && Number.isFinite(new Date(expiryDate).getTime()) && new Date(expiryDate).getTime() <= Date.now();
  return {
    ...(data as Partial<UserMembership>),
    walletAddress,
    tier: data.tier as MembershipTier,
    status: expired ? 'expired' : storedStatus,
    startDate,
    renewalDate: expiryDate,
    activationDate: startDate,
    expiryDate,
    priceUSDC: typeof data.priceUSDC === 'number' ? data.priceUSDC : undefined,
    monthlyCredits: typeof data.monthlyCredits === 'number' ? data.monthlyCredits : undefined,
    autoRenew: data.autoRenew === true,
  };
}

export async function getMembership(walletAddress: string): Promise<UserMembership | null> {
  const db = getAdminDb();
  const addr = walletAddress.toLowerCase();
  const ref = db.collection(MEMBERSHIPS_COL).doc(addr);
  const snap = await ref.get();
  if (!snap.exists) return null;
  return normalizeMembership(snap.data()!, addr);
}

export async function activateMembership(
  walletAddress: string,
  tier: MembershipTier,
  txHash?: string,
): Promise<UserMembership> {
  const db = getAdminDb();
  const addr = walletAddress.toLowerCase();
  const plan = MEMBERSHIP_PLANS.find((p) => p.id === tier);
  if (!plan) throw new Error('Invalid membership tier');

  const ref = db.collection(MEMBERSHIPS_COL).doc(addr);
  const existingSnap = await ref.get();
  const existing = existingSnap.exists ? existingSnap.data() : null;

  // Never grant the same on-chain payment twice, even if the client retries.
  if (txHash && existing?.txHash === txHash) {
    return normalizeMembership(existing, addr);
  }

  const now = new Date();
  const expiry = addOneCalendarMonth(now);
  const membership: UserMembership = {
    walletAddress: addr,
    tier,
    status: 'active',
    startDate: now.toISOString(),
    renewalDate: expiry.toISOString(),
    activationDate: now.toISOString(),
    expiryDate: expiry.toISOString(),
    priceUSDC: plan.priceUSDC,
    monthlyCredits: plan.credits,
    txHash,
    autoRenew: false,
  };

  await ref.set({
    ...membership,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  // Monthly membership allocation is granted exactly once per activation.
  await addCredits(addr, plan.credits, 'bonus', `${plan.name} membership credits`, txHash);

  if (plan.priceUSDC > 0 && txHash) {
    await db.collection(TREASURY_COL).doc().set({
      type: 'membership_payment',
      amount: plan.priceUSDC,
      description: `${plan.name} subscription — ${addr.slice(0, 8)}`,
      walletAddress: addr,
      txHash,
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  return membership;
}

export async function getRecentMemberships(limitCount = 20) {
  const db = getAdminDb();
  const snap = await db.collection(MEMBERSHIPS_COL).orderBy('updatedAt', 'desc').limit(limitCount).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
