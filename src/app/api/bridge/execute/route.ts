import { NextRequest, NextResponse } from 'next/server';
import { CCTP_SOURCE_CHAINS, ARC_CCTP, txUrl, CHAIN_ID, NETWORK_NAME } from '@/lib/contracts';
import { createBridgePending, updateBridgePending, bridgeTxAlreadyProcessed } from '@/lib/bridge/service';
import { pollAttestation } from '@/lib/bridge/attestation';
import { BRIDGE_MIN_AMOUNT, BRIDGE_MAX_AMOUNT } from '@/lib/bridge/types';
import { saveTransaction } from '@/lib/firebase/transactions';
import { writeActivity, buildBridgeActivity } from '@/lib/firebase/activity';
import { logTreasuryEvent } from '@/lib/treasury/service';
import { isValidEthAddress, verifyApiWallet } from '@/lib/auth/middleware';
import { obs } from '@/lib/observability/logger';
import { checkRateLimit, RATE_LIMITS } from '@/lib/security/rateLimit';

// ============================================================
// POST /api/bridge/execute
// Returns immediately with status 'attesting' — attestation
// polling runs as fire-and-forget async after response is sent,
// avoiding serverless function timeout (CCTP can take ~30-60s).
// Client polls GET /api/bridge/status to observe progress.
// ============================================================

async function pollAndFinalize(
  burnTxHash: string, srcDomain: number, sourceChainName: string,
  walletAddress: string, amount: number
): Promise<void> {
  try {
    const { forwardTxHash } = await pollAttestation(srcDomain, burnTxHash);

    await updateBridgePending(burnTxHash, {
      status: 'completed', forwardTxHash, completedAt: new Date().toISOString(),
    });

    // ── Proof chain: requirements 3, 4, 5 ──────────────────
    await Promise.allSettled([
      saveTransaction(walletAddress, {
        toAddress: walletAddress,
        amount: String(amount),
        amountFormatted: String(amount),
        txHash: forwardTxHash,
        status: 'confirmed',
        token: 'USDC',
        chainId: CHAIN_ID,
        networkName: NETWORK_NAME,
        explorerUrl: txUrl(forwardTxHash),
        type: 'bridge',
        note: `Bridged from ${sourceChainName} via CCTP V2 · Burn: ${burnTxHash}`,
      }),
      writeActivity(buildBridgeActivity(walletAddress, amount, sourceChainName, burnTxHash, forwardTxHash)),
      logTreasuryEvent('bridge_inbound_activity', amount, `USDC bridged from ${sourceChainName} via CCTP V2`, walletAddress, forwardTxHash),
    ]);

    void obs.info('bridge', 'Bridge completed', { burnTxHash, forwardTxHash, amount }, walletAddress);
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === 'TIMEOUT') {
      await updateBridgePending(burnTxHash, { status: 'timeout' });
      void obs.warn('bridge', 'Attestation timeout — funds in transit, not lost', { burnTxHash }, walletAddress);
    } else {
      await updateBridgePending(burnTxHash, { status: 'failed', failureReason: msg });
      void obs.error('bridge', 'Attestation polling failed', { burnTxHash, error: msg }, walletAddress);
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const { burnTxHash, sourceChainId, walletAddress, amount } = await req.json() as {
      burnTxHash: string; sourceChainId: number; walletAddress: string; amount: number;
    };

    if (!burnTxHash || !sourceChainId || !walletAddress || !amount) {
      return NextResponse.json({ error: 'burnTxHash, sourceChainId, walletAddress, amount required' }, { status: 400 });
    }
    if (!/^0x[0-9a-fA-F]{64}$/.test(burnTxHash)) {
      return NextResponse.json({ error: 'Invalid burnTxHash format' }, { status: 400 });
    }
    if (!isValidEthAddress(walletAddress)) {
      return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
    }
    if (amount < BRIDGE_MIN_AMOUNT || amount > BRIDGE_MAX_AMOUNT) {
      return NextResponse.json({ error: `Amount must be between ${BRIDGE_MIN_AMOUNT} and ${BRIDGE_MAX_AMOUNT} USDC` }, { status: 422 });
    }

    const rl = await checkRateLimit(`bridge:${walletAddress.toLowerCase()}`, RATE_LIMITS.bridge.maxCalls, RATE_LIMITS.bridge.windowMs);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many bridge requests — please wait before trying again', resetAt: rl.resetAt }, { status: 429 });
    }

    // ── Wallet ownership verification (strict EIP-191) ───────
    const auth = await verifyApiWallet(req, walletAddress, true);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.reason ?? 'Wallet signature required' }, { status: 401 });
    }

    const chain = CCTP_SOURCE_CHAINS[String(sourceChainId) as keyof typeof CCTP_SOURCE_CHAINS];
    if (!chain) return NextResponse.json({ error: 'Unsupported source chain' }, { status: 400 });

    // ── Idempotency ─────────────────────────────────────────
    const existing = await bridgeTxAlreadyProcessed(burnTxHash);
    if (existing) {
      return NextResponse.json({ message: 'Bridge already submitted', bridge: existing }, { status: 409 });
    }

    await createBridgePending({
      burnTxHash, walletAddress,
      sourceChain: chain.name, sourceChainId, sourceDomain: chain.domain,
      destinationChain: 'Arc Testnet', destinationDomain: ARC_CCTP.domain,
      amount, status: 'attesting',
    });

    void pollAndFinalize(burnTxHash, chain.domain, chain.name, walletAddress, amount);

    return NextResponse.json({ bridgeId: burnTxHash, status: 'attesting' });
  } catch (err) {
    const msg = (err as Error).message;
    void obs.error('bridge', 'Bridge execute error', { error: msg });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
