import { NextRequest, NextResponse } from 'next/server';
import { getMembership, activateMembership } from '@/lib/memberships/service';
import { obs } from '@/lib/observability/logger';
import { verifyUSDCPayment } from '@/lib/chain/verify';
import { MEMBERSHIP_PLANS } from '@/lib/memberships/plans';
import { logTreasuryEvent } from '@/lib/treasury/service';
import { MAINNET_NETWORK, TESTNET_NETWORK, type NetworkEnv } from '@/lib/contracts';
import { saveTransaction } from '@/lib/firebase/transactions';
import { writeActivity } from '@/lib/firebase/activity';
import { buildMembershipMemo } from '@/lib/memo/service';
import { verifyApiWallet, isValidEthAddress } from '@/lib/auth/middleware';
import type { MembershipTier } from '@/types';

function parseNetwork(value: unknown): NetworkEnv | null {
  return value === 'testnet' || value === 'mainnet' ? value : null;
}
function networkMetadata(network: NetworkEnv, txHash: string) {
  const profile = network === 'mainnet' ? MAINNET_NETWORK : TESTNET_NETWORK;
  return { profile, explorerUrl: `${profile.explorer}/tx/${txHash}` };
}

// GET /api/membership?wallet=0x...
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet');
  if (!wallet) return NextResponse.json({ error: 'wallet required' }, { status: 400 });
  const membership = await getMembership(wallet);
  return NextResponse.json({ membership: membership ?? null });
}

// POST /api/membership — activate only after network- and sender-bound payment verification
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      walletAddress?: string; tier?: MembershipTier; txHash?: string; network?: unknown;
    };
    const { walletAddress, tier, txHash } = body;
    const network = parseNetwork(body.network);

    if (!walletAddress || !tier || !txHash || !network) {
      return NextResponse.json({ error: 'walletAddress, tier, txHash, and a valid network (testnet|mainnet) are required' }, { status: 400 });
    }
    if (!isValidEthAddress(walletAddress)) {
      return NextResponse.json({ error: 'Invalid wallet address format' }, { status: 400 });
    }
    if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
      return NextResponse.json({ error: 'Invalid transaction hash format' }, { status: 400 });
    }

    const auth = await verifyApiWallet(req, walletAddress, true);
    if (!auth.ok) return NextResponse.json({ error: auth.reason ?? 'Wallet signature required' }, { status: 401 });

    const plan = MEMBERSHIP_PLANS.find((p) => p.id === tier);
    if (!plan) return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });

    if (plan.priceUSDC > 0) {
      const verification = await verifyUSDCPayment(txHash as `0x${string}`, plan.priceUSDC, network, walletAddress);
      if (!verification.valid) {
        void obs.warn('auth', 'Membership payment verification failed', { txHash, network, reason: verification.reason }, walletAddress);
        return NextResponse.json({ error: `Payment verification failed: ${verification.reason}` }, { status: 400 });
      }
    }

    await activateMembership(walletAddress, tier, txHash, network);
    void obs.info('auth', 'Membership activated', { tier, txHash, network }, walletAddress);

    const { profile, explorerUrl } = networkMetadata(network, txHash);
    await Promise.allSettled([
      saveTransaction(walletAddress, {
        toAddress: walletAddress, amount: String(plan.priceUSDC), amountFormatted: String(plan.priceUSDC),
        txHash, status: 'confirmed', token: 'USDC', chainId: profile.chainId,
        networkName: profile.networkName, explorerUrl, type: 'membership',
        note: `${plan.name} membership activation`,
      }),
      writeActivity({
        walletAddress, type: 'membership_purchase', category: 'treasury',
        title: `${plan.name} membership activated`,
        description: `${plan.priceUSDC} USDC · ${profile.networkName}`, severity: 'success',
        metadata: { txHash, explorerURL: explorerUrl, amount: plan.priceUSDC, tier, chainId: profile.chainId },
      }),
      plan.priceUSDC > 0
        ? logTreasuryEvent('membership_payment', plan.priceUSDC, `${plan.name} membership — ${walletAddress.slice(0, 8)}`, walletAddress, txHash, {
            explorerUrl, networkName: profile.networkName, chainId: profile.chainId,
          })
        : Promise.resolve(),
    ]);

    return NextResponse.json({ success: true, memoPayload: buildMembershipMemo(txHash, tier, walletAddress) });
  } catch (err) {
    const e = err as Error;
    if (e.message === 'transaction_already_processed') {
      return NextResponse.json({ error: 'This transaction has already been used for another membership activation.' }, { status: 409 });
    }
    void obs.error('auth', 'Membership activation error', { error: e.message });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
