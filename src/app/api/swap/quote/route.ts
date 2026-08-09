import { NextRequest, NextResponse } from 'next/server';
import { getRouteId, calculateSwapQuote } from '@/lib/swap/service';
import { getSwapWalletReserve } from '@/lib/swap/executor';
import { SWAP_MIN_AMOUNT, SWAP_MAX_AMOUNT, type SwapToken } from '@/lib/swap/types';

const VALID_TOKENS: SwapToken[] = ['USDC', 'tUSDC', 'tARC'];

export async function GET(req: NextRequest) {
  const fromToken = req.nextUrl.searchParams.get('from') as SwapToken | null;
  const toToken = req.nextUrl.searchParams.get('to') as SwapToken | null;
  const amountParam = req.nextUrl.searchParams.get('amount');

  if (!fromToken || !toToken || !amountParam) {
    return NextResponse.json({ error: 'from, to, and amount required' }, { status: 400 });
  }
  if (!VALID_TOKENS.includes(fromToken) || !VALID_TOKENS.includes(toToken)) {
    return NextResponse.json({ error: 'Unsupported token' }, { status: 400 });
  }
  if (fromToken === toToken) {
    return NextResponse.json({ error: 'fromToken and toToken must differ' }, { status: 400 });
  }

  const amount = parseFloat(amountParam);
  if (isNaN(amount) || amount <= 0) {
    return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 });
  }
  if (amount < SWAP_MIN_AMOUNT || amount > SWAP_MAX_AMOUNT) {
    return NextResponse.json({ error: `Amount must be between ${SWAP_MIN_AMOUNT} and ${SWAP_MAX_AMOUNT}` }, { status: 422 });
  }

  const routeId = getRouteId(fromToken, toToken);
  if (!routeId) return NextResponse.json({ error: 'No route available for this pair' }, { status: 400 });

  const quote = calculateSwapQuote(routeId, amount);
  if (!quote) return NextResponse.json({ error: 'Route unavailable' }, { status: 400 });

  // ── Reserve check — production-grade correctness fix ──────
  // Warn the user before they sign the inbound transfer if the
  // swap wallet cannot fulfil the output amount. Never fails silently.
  try {
    const reserve = await getSwapWalletReserve(quote.toToken);
    if (reserve < quote.outputAmount) {
      return NextResponse.json({
        ...quote,
        routeAvailable: false,
        reserveAvailable: reserve,
        error: `Insufficient ${quote.toToken} liquidity in the swap wallet right now. Available: ${reserve.toFixed(4)}, needed: ${quote.outputAmount.toFixed(4)}.`,
      }, { status: 503 });
    }
  } catch {
    // If the reserve check itself fails (RPC issue), do not block the quote —
    // the execute route will still fail safely if reserves are actually insufficient.
  }

  return NextResponse.json({ ...quote, routeAvailable: true });
}
