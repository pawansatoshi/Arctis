import { NextRequest, NextResponse } from 'next/server';
import { getMembership, activateMembership } from '@/lib/memberships/service';
import { verifyApiWallet, isValidEthAddress } from '@/lib/auth/middleware';
import { MEMBERSHIP_PLANS } from '@/lib/memberships/plans';
import { obs } from '@/lib/observability/logger';
import { checkRateLimit, RATE_LIMITS } from '@/lib/security/rateLimit';
import type { MembershipTier } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const { walletAddress } = await req.json() as { walletAddress?: string };
    if (!walletAddress) return NextResponse.json({ error: 'walletAddress required' }, { status: 400 });
    if (!isValidEthAddress(walletAddress)) {
      return NextResponse.json({ error: 'Invalid wallet address format' }, { status: 400 });
    }

    const auth = await verifyApiWallet(req, walletAddress, true);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.reason ?? 'Wallet signature required' }, { status: 401 });
    }

    // Rate-limit free-tier activations: max 3 per 10 minutes prevents farming loops.
    const rl = await checkRateLimit(`membership:${walletAddress.toLowerCase()}`, RATE_LIMITS.membership.maxCalls, RATE_LIMITS.membership.windowMs);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many membership activation attempts — please wait before trying again', resetAt: rl.resetAt }, { status: 429 });
    }

    const plan = MEMBERSHIP_PLANS.find((item) => item.id === 'free' as MembershipTier);
    if (!plan || plan.priceUSDC !== 0) {
      return NextResponse.json({ error: 'Free membership is not configured' }, { status: 500 });
    }

    const existing = await getMembership(walletAddress);
    // Hard guard: if a valid free tier is still active, return 200 without re-granting credits.
    if (existing?.status === 'active' && existing.tier === 'free' && existing.expiryDate && new Date(existing.expiryDate).getTime() > Date.now()) {
      return NextResponse.json({ success: true, membership: existing, alreadyActive: true });
    }

    const membership = await activateMembership(walletAddress, 'free');
    void obs.info('auth', 'Free membership activated', { tier: 'free' }, walletAddress);
    return NextResponse.json({ success: true, membership });
  } catch (err) {
    const error = err as Error;
    if (error.message === 'transaction_already_processed') {
      return NextResponse.json({ error: 'Free membership already activated for this wallet.' }, { status: 409 });
    }
    void obs.error('auth', 'Free membership activation error', { error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
