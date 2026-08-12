import { NextRequest, NextResponse } from 'next/server';
import { getMembership, activateMembership } from '@/lib/memberships/service';
import { verifyApiWallet } from '@/lib/auth/middleware';
import { MEMBERSHIP_PLANS } from '@/lib/memberships/plans';
import { obs } from '@/lib/observability/logger';
import type { MembershipTier } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const { walletAddress } = await req.json() as { walletAddress?: string };
    if (!walletAddress) return NextResponse.json({ error: 'walletAddress required' }, { status: 400 });

    const auth = await verifyApiWallet(req, walletAddress, true);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.reason ?? 'Wallet signature required' }, { status: 401 });
    }

    const plan = MEMBERSHIP_PLANS.find((item) => item.id === 'free' as MembershipTier);
    if (!plan || plan.priceUSDC !== 0) {
      return NextResponse.json({ error: 'Free membership is not configured' }, { status: 500 });
    }

    const existing = await getMembership(walletAddress);
    if (existing?.status === 'active' && existing.tier === 'free' && existing.expiryDate && new Date(existing.expiryDate).getTime() > Date.now()) {
      return NextResponse.json({ success: true, membership: existing, alreadyActive: true });
    }

    const membership = await activateMembership(walletAddress, 'free');
    void obs.info('auth', 'Free membership activated', { tier: 'free' }, walletAddress);
    return NextResponse.json({ success: true, membership });
  } catch (err) {
    const error = err as Error;
    void obs.error('auth', 'Free membership activation error', { error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
