import { NextRequest, NextResponse } from 'next/server';
import { getRouteId, calculateSwapQuote, swapTxAlreadyProcessed, createSwapRecord, updateSwapRecord } from '@/lib/swap/service';
import { verifyTokenPayment } from '@/lib/chain/verify';
import { dispatchSwapOutput, getSwapWalletAddress } from '@/lib/swap/executor';
import { logTreasuryEvent } from '@/lib/treasury/service';
import { saveTransaction } from '@/lib/firebase/transactions';
import { writeActivity } from '@/lib/firebase/activity';
import { obs } from '@/lib/observability/logger';
import { isValidEthAddress, verifyApiWallet } from '@/lib/auth/middleware';
import { CONTRACTS, CHAIN_ID, NETWORK_NAME, txUrl } from '@/lib/contracts';
import { buildSwapMemo } from '@/lib/memo/service';
import { checkRateLimit, RATE_LIMITS } from '@/lib/security/rateLimit';
import { parseUnits } from 'viem';
import type { SwapToken } from '@/lib/swap/types';

const TOKEN_DECIMALS: Record<SwapToken, number> = { USDC: 6, tUSDC: 6, tARC: 18 };
const TOKEN_CONTRACT: Record<SwapToken, string> = { USDC: CONTRACTS.USDC, tUSDC: CONTRACTS.tUSDC, tARC: CONTRACTS.tARC };

export async function POST(req: NextRequest) {
  try {
    const { walletAddress, fromToken, toToken, amount, inboundTxHash } = await req.json() as {
      walletAddress: string; fromToken: SwapToken; toToken: SwapToken; amount: number; inboundTxHash: string;
    };

    if (!walletAddress || !fromToken || !toToken || !amount || !inboundTxHash) {
      return NextResponse.json({ error: 'walletAddress, fromToken, toToken, amount, inboundTxHash required' }, { status: 400 });
    }
    if (!isValidEthAddress(walletAddress)) {
      return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
    }
    if (!/^0x[0-9a-fA-F]{64}$/.test(inboundTxHash)) {
      return NextResponse.json({ error: 'Invalid transaction hash format' }, { status: 400 });
    }

    const rl = await checkRateLimit(`swap:${walletAddress.toLowerCase()}`, RATE_LIMITS.swap.maxCalls, RATE_LIMITS.swap.windowMs);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many swap requests — please wait before trying again', resetAt: rl.resetAt }, { status: 429 });
    }

    // ── Wallet ownership verification (strict EIP-191) ───────
    const auth = await verifyApiWallet(req, walletAddress, true);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.reason ?? 'Wallet signature required' }, { status: 401 });
    }

    // ── Idempotency — inboundTxHash is the document ID ──────
    const existing = await swapTxAlreadyProcessed(inboundTxHash);
    if (existing) {
      return NextResponse.json({ message: 'Swap already processed', swap: existing }, { status: 409 });
    }

    const routeId = getRouteId(fromToken, toToken);
    if (!routeId) return NextResponse.json({ error: 'No route available for this pair' }, { status: 400 });

    const quote = calculateSwapQuote(routeId, amount);
    if (!quote) return NextResponse.json({ error: 'Route unavailable' }, { status: 400 });

    // ── Proof requirement 1: verify the inbound payment on-chain ──
    const swapWalletAddress = getSwapWalletAddress();
    const expectedAmountRaw = parseUnits(amount.toFixed(TOKEN_DECIMALS[fromToken]), TOKEN_DECIMALS[fromToken]);
    const verification = await verifyTokenPayment(
      inboundTxHash as `0x${string}`,
      TOKEN_CONTRACT[fromToken],
      swapWalletAddress,
      expectedAmountRaw
    );
    if (!verification.valid) {
      void obs.warn('swap', 'Inbound payment verification failed', { inboundTxHash, reason: verification.reason }, walletAddress);
      return NextResponse.json({ error: `Payment verification failed: ${verification.reason}` }, { status: 400 });
    }

    // ── Create pending record ─────────────────────────────────
    await createSwapRecord({
      id: inboundTxHash,
      walletAddress, routeId, fromToken, toToken,
      inputAmount: quote.inputAmount, outputAmount: quote.outputAmount, fee: quote.fee,
      inboundTxHash, status: 'dispatching',
    });

    // ── Dispatch the outbound leg — real on-chain settlement ──
    const dispatch = await dispatchSwapOutput(walletAddress, toToken, quote.outputAmount);
    if (!dispatch.success) {
      await updateSwapRecord(inboundTxHash, { status: 'failed', failureReason: dispatch.reason });
      void obs.error('swap', 'Outbound dispatch failed', { inboundTxHash, reason: dispatch.reason }, walletAddress);
      return NextResponse.json({ error: `Swap settlement failed: ${dispatch.reason}. Your ${fromToken} deposit is safe — contact support with tx ${inboundTxHash}.` }, { status: 500 });
    }

    // ── Finalize record ───────────────────────────────────────
    await updateSwapRecord(inboundTxHash, {
      status: 'completed',
      outboundTxHash: dispatch.txHash,
      completedAt: new Date().toISOString(),
    });

    // ── Proof requirement 4: Transaction ledger record ────────
    void saveTransaction(walletAddress, {
      toAddress: walletAddress,
      amount: String(quote.inputAmount),
      amountFormatted: String(quote.inputAmount),
      txHash: inboundTxHash,
      status: 'confirmed',
      token: fromToken,
      chainId: CHAIN_ID,
      networkName: NETWORK_NAME,
      explorerUrl: txUrl(inboundTxHash),
      type: 'swap',
      note: `${fromToken} → ${toToken} (outbound: ${dispatch.txHash})`,
    });

    // ── Proof requirement 3: Activity record ──────────────────
    void writeActivity({
      walletAddress,
      type: 'swap_completed',
      category: 'wallet',
      title: `Swapped ${fromToken} → ${toToken}`,
      description: `${quote.inputAmount} ${fromToken} → ${quote.outputAmount.toFixed(4)} ${toToken} (0.3% fee)`,
      severity: 'success',
      metadata: {
        txHash: inboundTxHash, explorerURL: txUrl(inboundTxHash),
        outboundTxHash: dispatch.txHash, outboundExplorerURL: txUrl(dispatch.txHash!),
        amount: quote.inputAmount, token: fromToken, fromToken, toToken, routeId,
      },
    });

    // ── Proof requirement 5: Treasury logs (observer) ─────────
    await Promise.allSettled([
      logTreasuryEvent('swap_inflow', quote.inputAmount, `Swap inbound: ${routeId} — ${walletAddress.slice(0, 8)}`, walletAddress, inboundTxHash),
      logTreasuryEvent('swap_outflow', quote.outputAmount, `Swap outbound: ${routeId} — ${walletAddress.slice(0, 8)}`, walletAddress, dispatch.txHash),
      logTreasuryEvent('swap_fee_revenue', quote.fee, `Swap fee (0.3%): ${routeId}`, walletAddress, inboundTxHash),
    ]);

    void obs.info('swap', 'Swap completed', { routeId, inboundTxHash, outboundTxHash: dispatch.txHash }, walletAddress);

    return NextResponse.json({
      success: true,
      outputAmount: quote.outputAmount,
      outboundTxHash: dispatch.txHash,
      memoPayload: buildSwapMemo(inboundTxHash, routeId, fromToken, toToken),
    });
  } catch (err) {
    const e = err as Error;
    void obs.error('swap', 'Swap execute error', { error: e.message });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
