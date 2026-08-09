import { NextRequest, NextResponse } from 'next/server';
import { CCTP_SOURCE_CHAINS, ARC_CCTP } from '@/lib/contracts';
import { fetchBridgeFee } from '@/lib/bridge/attestation';
import { BRIDGE_MIN_AMOUNT, BRIDGE_MAX_AMOUNT } from '@/lib/bridge/types';

export async function GET(req: NextRequest) {
  const sourceChainParam = req.nextUrl.searchParams.get('sourceChain');
  const amountParam = req.nextUrl.searchParams.get('amount');

  if (!sourceChainParam || !amountParam) {
    return NextResponse.json({ error: 'sourceChain and amount required' }, { status: 400 });
  }

  const chain = CCTP_SOURCE_CHAINS[sourceChainParam as keyof typeof CCTP_SOURCE_CHAINS];
  if (!chain) return NextResponse.json({ error: 'Unsupported source chain' }, { status: 400 });

  const amount = parseFloat(amountParam);
  if (isNaN(amount) || amount <= 0) {
    return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 });
  }
  if (amount < BRIDGE_MIN_AMOUNT) {
    return NextResponse.json({ error: `Minimum bridge amount is ${BRIDGE_MIN_AMOUNT} USDC` }, { status: 422 });
  }
  if (amount > BRIDGE_MAX_AMOUNT) {
    return NextResponse.json({ error: `Maximum bridge amount is ${BRIDGE_MAX_AMOUNT} USDC (testnet cap)` }, { status: 422 });
  }

  try {
    const feeData = await fetchBridgeFee(chain.domain, ARC_CCTP.domain);
    const fee = (amount * feeData.minimumFee) / 10_000;
    return NextResponse.json({
      sourceChain: chain.name, sourceChainId: Number(sourceChainParam), sourceDomain: chain.domain,
      destinationChain: 'Arc Testnet', destinationDomain: ARC_CCTP.domain,
      fee: parseFloat(fee.toFixed(6)), feeToken: 'USDC', estimatedTime: '~30 seconds',
      minAmount: BRIDGE_MIN_AMOUNT, maxAmount: BRIDGE_MAX_AMOUNT,
    });
  } catch {
    return NextResponse.json({
      sourceChain: chain.name, sourceChainId: Number(sourceChainParam), sourceDomain: chain.domain,
      destinationChain: 'Arc Testnet', destinationDomain: ARC_CCTP.domain,
      fee: 0.1, feeToken: 'USDC', estimatedTime: '~30 seconds',
      minAmount: BRIDGE_MIN_AMOUNT, maxAmount: BRIDGE_MAX_AMOUNT,
      feeEstimated: true, note: 'Live fee quote unavailable, showing estimated fee',
    });
  }
}
