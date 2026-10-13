import { NextRequest, NextResponse } from 'next/server';
import { getCreditBalance, getCreditHistory, addCredits } from '@/lib/credits/engine';
import { logTreasuryEvent } from '@/lib/treasury/service';
import { obs } from '@/lib/observability/logger';
import { verifyUSDCPayment } from '@/lib/chain/verify';
import { CREDIT_PACKAGES } from '@/lib/memberships/plans';
import { MAINNET_NETWORK, TESTNET_NETWORK, type NetworkEnv } from '@/lib/contracts';
import { isValidEthAddress, verifyApiWallet } from '@/lib/auth/middleware';
import { saveTransaction } from '@/lib/firebase/transactions';
import { writeActivity } from '@/lib/firebase/activity';
import { buildCreditsMemo } from '@/lib/memo/service';

function parseNetwork(value: unknown): NetworkEnv | null {
  return value === 'testnet' || value === 'mainnet' ? value : null;
}

// POST /api/credits — network- and sender-bound on-chain payment verification
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      walletAddress?: string; packageId?: string; txHash?: string; network?: unknown;
    };
    const { walletAddress, packageId, txHash } = body;
    const network = parseNetwork(body.network);

    if (!walletAddress || !packageId || !txHash || !network) {
      return NextResponse.json({ error: 'walletAddress, packageId, txHash, and a valid network (testnet|mainnet) are required' }, { status: 400 });
    }
    if (!isValidEthAddress(walletAddress)) {
      return NextResponse.json({ error: 'Invalid wallet address format' }, { status: 400 });
    }
    if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
      return NextResponse.json({ error: 'Invalid transaction hash format' }, { status: 400 });
    }

    const auth = await verifyApiWallet(req, walletAddress, true);
    if (!auth.ok) return NextResponse.json({ error: auth.reason ?? 'Wallet signature required' }, { status: 401 });

    const pkg = CREDIT_PACKAGES.find((p) => p.id === packageId);
    if (!pkg) return NextResponse.json({ error: 'Invalid package' }, { status: 400 });

    const verification = await verifyUSDCPayment(txHash as `0x${string}`, pkg.usdcAmount, network, walletAddress);
    if (!verification.valid) {
      void obs.warn('credits', 'Payment verification failed', { txHash, network, reason: verification.reason }, walletAddress);
      return NextResponse.json({ error: `Payment verification failed: ${verification.reason}` }, { status: 400 });
    }

    const profile = network === 'mainnet' ? MAINNET_NETWORK : TESTNET_NETWORK;
    const explorerUrl = `${profile.explorer}/tx/${txHash}`;
    const totalCredits = pkg.credits + pkg.bonus;
    try {
      await addCredits(walletAddress, totalCredits, 'purchase', `Credit pack: ${pkg.label || pkg.id}`, txHash);
      await logTreasuryEvent(
        'credit_purchase', pkg.usdcAmount,
        `Credit purchase ${pkg.id} — ${walletAddress.slice(0, 8)}`, walletAddress, txHash,
        {
          explorerUrl, networkName: profile.networkName, chainId: profile.chainId,
          blockNumber: verification.blockNumber?.toString(), gasUsed: verification.gasUsed?.toString(),
        }
      );
    } catch (recordingError) {
      const message = (recordingError as Error).message;
      if (message === 'transaction_already_processed') {
        return NextResponse.json({ error: 'This transaction has already been used for another credit operation.' }, { status: 409 });
      }
      void obs.error('credits', 'Payment succeeded but credit recording failed', { error: message, txHash, packageId, network }, walletAddress);
      return NextResponse.json({
        error: 'Payment succeeded on-chain, but server-side credit recording failed. Contact support with this transaction hash.',
        paymentStatus: 'succeeded', recordingStatus: 'failed', txHash, details: message,
      }, { status: 500 });
    }

    void obs.info('credits', 'Credits purchased and verified', { packageId, totalCredits, txHash, network }, walletAddress);
    await Promise.allSettled([
      saveTransaction(walletAddress, {
        toAddress: walletAddress, amount: String(pkg.usdcAmount), amountFormatted: String(pkg.usdcAmount),
        txHash, status: 'confirmed', token: 'USDC', chainId: profile.chainId,
        networkName: profile.networkName, explorerUrl, type: 'credit_purchase',
        note: `${pkg.label || pkg.id} — ${totalCredits} credits`,
      }),
      writeActivity({
        walletAddress, type: 'credit_purchase', category: 'treasury',
        title: `Purchased ${totalCredits} credits`,
        description: `${pkg.label || pkg.id} · ${pkg.usdcAmount} USDC · ${profile.networkName}`,
        severity: 'success',
        metadata: { txHash, explorerURL: explorerUrl, amount: pkg.usdcAmount, creditsUsed: totalCredits, chainId: profile.chainId },
      }),
    ]);

    return NextResponse.json({ success: true, creditsAdded: totalCredits, memoPayload: buildCreditsMemo(packageId, txHash, totalCredits) });
  } catch (err) {
    const e = err as Error;
    void obs.error('credits', 'Purchase error', { error: e.message });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet');
  if (!wallet) return NextResponse.json({ error: 'wallet required' }, { status: 400 });
  const [balance, history] = await Promise.all([getCreditBalance(wallet), getCreditHistory(wallet, 20)]);
  return NextResponse.json({ balance, history });
}
