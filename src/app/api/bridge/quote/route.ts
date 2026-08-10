import { NextRequest, NextResponse } from 'next/server';
import { CCTP_BRIDGE_CHAINS } from '@/lib/contracts';
import { BRIDGE_MIN_AMOUNT, BRIDGE_MAX_AMOUNT } from '@/lib/bridge/types';

export async function GET(req: NextRequest) {
  const sourceChainParam = req.nextUrl.searchParams.get('sourceChain');
  const destinationChainParam = req.nextUrl.searchParams.get('destinationChain');
  const amountParam = req.nextUrl.searchParams.get('amount');

  if (!sourceChainParam || !destinationChainParam || !amountParam) {
    return NextResponse.json(
      { error: 'sourceChain, destinationChain and amount required' },
      { status: 400 },
    );
  }

  if (sourceChainParam === destinationChainParam) {
    return NextResponse.json({ error: 'Source and destination chains must differ' }, { status: 400 });
  }

  const source = CCTP_BRIDGE_CHAINS[sourceChainParam as keyof typeof CCTP_BRIDGE_CHAINS];
  const destination = CCTP_BRIDGE_CHAINS[destinationChainParam as keyof typeof CCTP_BRIDGE_CHAINS];

  if (!source || !destination) {
    return NextResponse.json({ error: 'Unsupported bridge route' }, { status: 400 });
  }

  const amount = Number(amountParam);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 });
  }

  if (amount < BRIDGE_MIN_AMOUNT || amount > BRIDGE_MAX_AMOUNT) {
    return NextResponse.json(
      { error: `Amount must be between ${BRIDGE_MIN_AMOUNT} and ${BRIDGE_MAX_AMOUNT} USDC` },
      { status: 422 },
    );
  }

  return NextResponse.json({
    sourceChain: source.name,
    sourceChainId: Number(sourceChainParam),
    sourceDomain: source.domain,
    destinationChain: destination.name,
    destinationChainId: Number(destinationChainParam),
    destinationDomain: destination.domain,
    fee: 0,
    feeToken: 'USDC',
    estimatedTime: '~30 seconds',
    minAmount: BRIDGE_MIN_AMOUNT,
    maxAmount: BRIDGE_MAX_AMOUNT,
    feeEstimated: true,
    note: 'Live bridge fee is calculated by Circle App Kit in the connected wallet flow.',
  });
}
