import { NextRequest, NextResponse } from 'next/server';
import { getCreditBalance, getCreditHistory, addCredits } from '@/lib/credits/engine';
import { logTreasuryEvent } from '@/lib/treasury/service';
import { obs } from '@/lib/observability/logger';
import { verifyUSDCPayment } from '@/lib/chain/verify';
import { CREDIT_PACKAGES } from '@/lib/memberships/plans';
import { txUrl, NETWORK_NAME, CHAIN_ID } from '@/lib/contracts';
import { isValidEthAddress, verifyApiWallet } from '@/lib/auth/middleware';
import { saveTransaction } from '@/lib/firebase/transactions';
import { writeActivity } from '@/lib/firebase/activity';
import { buildCreditsMemo } from '@/lib/memo/service';

// ============================================================
// POST /api/credits — Purchase credits with real tx verification
// ============================================================
export async function POST(req: NextRequest) {
  try {
    const { walletAddress, packageId, txHash } = await req.json() as {
      walletAddress: string; packageId: string; txHash: string;
    };

    if (!walletAddress || !packageId || !txHash) {
      return NextResponse.json({ error: 'walletAddress, packageId, txHash required' }, { status: 400 });
    }

    // Validate wallet address format
    if (!isValidEthAddress(walletAddress)) {
      return NextResponse.json({ error: 'Invalid wallet address format' }, { status: 400 });
    }

    // Validate txHash format
    if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
      return NextResponse.json({ error: 'Invalid transaction hash format' }, { status: 400 });
    }

    // ── Wallet ownership verification (strict EIP-191) ───────
    const auth = await verifyApiWallet(req, walletAddress, true);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.reason ?? 'Wallet signature required' }, { status: 401 });
    }

    const pkg = CREDIT_PACKAGES.find((p) => p.id === packageId);
    if (!pkg) return NextResponse.json({ error: 'Invalid package' }, { status: 400 });

    // ── Real on-chain verification ──────────────────────────
    const verification = await verifyUSDCPayment(txHash as `0x${string}`, pkg.usdcAmount);
    if (!verification.valid) {
      void obs.warn('credits', 'Payment verification failed', { txHash, reason: verification.reason }, walletAddress);
      return NextResponse.json({ error: `Payment verification failed: ${verification.reason}` }, { status: 400 });
    }

    const totalCredits = pkg.credits + pkg.bonus;
    await addCredits(walletAddress, totalCredits, 'purchase', `Credit pack: ${pkg.label || pkg.id}`, txHash);

    await logTreasuryEvent(
      'credit_purchase',
      pkg.usdcAmount,
      `Credit purchase ${pkg.id} — ${walletAddress.slice(0, 8)}`,
      walletAddress,
      txHash,
      {
        explorerUrl: txUrl(txHash),
        networkName: NETWORK_NAME,
        chainId: CHAIN_ID,
        blockNumber: verification.blockNumber?.toString(),
        gasUsed: verification.gasUsed?.toString(),
      }
    );

    void obs.info('credits', 'Credits purchased and verified', { packageId, totalCredits, txHash }, walletAddress);

    // ── Proof requirements 3 + 4 (previously missing) ───────
    await Promise.allSettled([
      saveTransaction(walletAddress, {
        toAddress: walletAddress,
        amount: String(pkg.usdcAmount),
        amountFormatted: String(pkg.usdcAmount),
        txHash,
        status: 'confirmed',
        token: 'USDC',
        chainId: CHAIN_ID,
        networkName: NETWORK_NAME,
        explorerUrl: txUrl(txHash),
        type: 'credit_purchase',
        note: `${pkg.label || pkg.id} — ${totalCredits} credits`,
      }),
      writeActivity({
        walletAddress,
        type: 'credit_purchase',
        category: 'treasury',
        title: `Purchased ${totalCredits} credits`,
        description: `${pkg.label || pkg.id} · ${pkg.usdcAmount} USDC`,
        severity: 'success',
        metadata: { txHash, explorerURL: txUrl(txHash), amount: pkg.usdcAmount, creditsUsed: totalCredits },
      }),
    ]);

    return NextResponse.json({
      success: true,
      creditsAdded: totalCredits,
      memoPayload: buildCreditsMemo(packageId, txHash, totalCredits),
    });
  } catch (err) {
    const e = err as Error;
    void obs.error('credits', 'Purchase error', { error: e.message });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// GET /api/credits?wallet=0x...
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet');
  if (!wallet) return NextResponse.json({ error: 'wallet required' }, { status: 400 });
  const [balance, history] = await Promise.all([
    getCreditBalance(wallet),
    getCreditHistory(wallet, 20),
  ]);
  return NextResponse.json({ balance, history });
}
