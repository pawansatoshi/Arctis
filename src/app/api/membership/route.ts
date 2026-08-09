import { NextRequest, NextResponse } from 'next/server';
import { getMembership, activateMembership } from '@/lib/memberships/service';
import { obs } from '@/lib/observability/logger';
import { verifyUSDCPayment } from '@/lib/chain/verify';
import { MEMBERSHIP_PLANS } from '@/lib/memberships/plans';
import { logTreasuryEvent } from '@/lib/treasury/service';
import { txUrl, NETWORK_NAME, CHAIN_ID } from '@/lib/contracts';
import { saveTransaction } from '@/lib/firebase/transactions';
import { writeActivity } from '@/lib/firebase/activity';
import { buildMembershipMemo } from '@/lib/memo/service';
import { verifyApiWallet } from '@/lib/auth/middleware';
import type { MembershipTier } from '@/types';

// GET /api/membership?wallet=0x...
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet');
  if (!wallet) return NextResponse.json({ error: 'wallet required' }, { status: 400 });
  const membership = await getMembership(wallet);
  return NextResponse.json({ membership: membership ?? null });
}

// POST /api/membership — activate after verified on-chain payment
export async function POST(req: NextRequest) {
  try {
    const { walletAddress, tier, txHash } = await req.json() as {
      walletAddress: string; tier: MembershipTier; txHash: string;
    };

    if (!walletAddress || !tier || !txHash) {
      return NextResponse.json({ error: 'walletAddress, tier, txHash required' }, { status: 400 });
    }
    if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
      return NextResponse.json({ error: 'Invalid transaction hash format' }, { status: 400 });
    }

    // ── Wallet ownership verification (strict EIP-191) ───────
    const auth = await verifyApiWallet(req, walletAddress, true);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.reason ?? 'Wallet signature required' }, { status: 401 });
    }

    const plan = MEMBERSHIP_PLANS.find((p) => p.id === tier);
    if (!plan) return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });

    if (plan.priceUSDC > 0) {
      const verification = await verifyUSDCPayment(txHash as `0x${string}`, plan.priceUSDC);
      if (!verification.valid) {
        void obs.warn('auth', 'Membership payment verification failed', { txHash, reason: verification.reason }, walletAddress);
        return NextResponse.json({ error: `Payment verification failed: ${verification.reason}` }, { status: 400 });
      }
    }

    await activateMembership(walletAddress, tier, txHash);
    void obs.info('auth', 'Membership activated', { tier, txHash }, walletAddress);

    // ── Full proof chain (requirements 3, 4, 5 — previously entirely missing) ──
    await Promise.allSettled([
      saveTransaction(walletAddress, {
        toAddress: walletAddress,
        amount: String(plan.priceUSDC),
        amountFormatted: String(plan.priceUSDC),
        txHash,
        status: 'confirmed',
        token: 'USDC',
        chainId: CHAIN_ID,
        networkName: NETWORK_NAME,
        explorerUrl: txUrl(txHash),
        type: 'membership',
        note: `${plan.name} membership activation`,
      }),
      writeActivity({
        walletAddress,
        type: 'membership_purchase',
        category: 'treasury',
        title: `${plan.name} membership activated`,
        description: `${plan.priceUSDC} USDC · Arc Testnet`,
        severity: 'success',
        metadata: { txHash, explorerURL: txUrl(txHash), amount: plan.priceUSDC, tier },
      }),
      plan.priceUSDC > 0
        ? logTreasuryEvent('membership_payment', plan.priceUSDC, `${plan.name} membership — ${walletAddress.slice(0, 8)}`, walletAddress, txHash, {
            explorerUrl: txUrl(txHash), networkName: NETWORK_NAME, chainId: CHAIN_ID,
          })
        : Promise.resolve(),
    ]);

    return NextResponse.json({
      success: true,
      memoPayload: buildMembershipMemo(txHash, tier, walletAddress),
    });
  } catch (err) {
    const e = err as Error;
    void obs.error('auth', 'Membership activation error', { error: e.message });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
