import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { CCTP_BRIDGE_CHAINS } from '@/lib/contracts';
import { createBridgePending, bridgeTxAlreadyProcessed } from '@/lib/bridge/service';
import { saveTransaction } from '@/lib/firebase/transactions';
import { writeActivity, buildBridgeActivity } from '@/lib/firebase/activity';
import { logTreasuryEvent } from '@/lib/treasury/service';
import { isValidEthAddress } from '@/lib/auth/middleware';
import { checkRateLimit, RATE_LIMITS } from '@/lib/security/rateLimit';
import { BRIDGE_MAX_AMOUNT, BRIDGE_MIN_AMOUNT } from '@/lib/bridge/types';

const SOURCE_RPC: Record<number, string> = {
  5042002: 'https://rpc.testnet.arc.network',
  11155111: 'https://ethereum-sepolia-rpc.publicnode.com',
  84532: 'https://sepolia.base.org',
  421614: 'https://sepolia-rollup.arbitrum.io/rpc',
};

/**
 * Records a successful Circle App Kit bridge after independently checking
 * the source transaction. This endpoint never executes CCTP and never
 * accepts an arbitrary wallet claim as proof of execution.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      burnTxHash?: string;
      forwardTxHash?: string;
      sourceChainId?: number;
      destinationChainId?: number;
      walletAddress?: string;
      amount?: number;
    };

    const {
      burnTxHash,
      forwardTxHash,
      sourceChainId,
      destinationChainId,
      walletAddress,
      amount,
    } = body;

    if (!burnTxHash || !sourceChainId || !destinationChainId || !walletAddress || !amount) {
      return NextResponse.json(
        { error: 'burnTxHash, sourceChainId, destinationChainId, walletAddress, amount required' },
        { status: 400 },
      );
    }

    if (
      !/^0x[0-9a-fA-F]{64}$/.test(burnTxHash) ||
      (forwardTxHash && !/^0x[0-9a-fA-F]{64}$/.test(forwardTxHash))
    ) {
      return NextResponse.json({ error: 'Invalid transaction hash format' }, { status: 400 });
    }

    if (!isValidEthAddress(walletAddress)) {
      return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
    }

    if (amount < BRIDGE_MIN_AMOUNT || amount > BRIDGE_MAX_AMOUNT) {
      return NextResponse.json({ error: 'Bridge amount outside configured limits' }, { status: 422 });
    }

    if (sourceChainId === destinationChainId) {
      return NextResponse.json({ error: 'Source and destination chains must differ' }, { status: 400 });
    }

    const source = CCTP_BRIDGE_CHAINS[String(sourceChainId) as keyof typeof CCTP_BRIDGE_CHAINS];
    const destination = CCTP_BRIDGE_CHAINS[String(destinationChainId) as keyof typeof CCTP_BRIDGE_CHAINS];
    const rpc = SOURCE_RPC[sourceChainId];

    if (!source || !destination || !rpc) {
      return NextResponse.json({ error: 'Unsupported bridge route' }, { status: 400 });
    }

    const rl = await checkRateLimit(
      `bridge-record:${walletAddress.toLowerCase()}`,
      RATE_LIMITS.bridge.maxCalls,
      RATE_LIMITS.bridge.windowMs,
    );
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many bridge record requests' }, { status: 429 });
    }

    const existing = await bridgeTxAlreadyProcessed(burnTxHash);
    if (existing) {
      return NextResponse.json({ bridge: existing, alreadyRecorded: true });
    }

    const client = createPublicClient({ transport: http(rpc) });
    const tx = await client.getTransaction({ hash: burnTxHash as `0x${string}` });

    if (tx.from.toLowerCase() !== walletAddress.toLowerCase()) {
      return NextResponse.json(
        { error: 'Source transaction does not belong to the supplied wallet' },
        { status: 403 },
      );
    }

    const receipt = await client.getTransactionReceipt({ hash: burnTxHash as `0x${string}` });
    if (receipt.status !== 'success') {
      return NextResponse.json({ error: 'Source bridge transaction did not succeed' }, { status: 422 });
    }

    const now = new Date().toISOString();

    await createBridgePending({
      burnTxHash,
      walletAddress,
      sourceChain: source.name,
      sourceChainId,
      sourceDomain: source.domain,
      destinationChain: destination.name,
      destinationChainId,
      destinationDomain: destination.domain,
      amount,
      status: 'completed',
      forwardTxHash,
    });

    const recordedHash = forwardTxHash ?? burnTxHash;
    const recordedExplorer = forwardTxHash ? destination.explorer : source.explorer;

    await Promise.allSettled([
      saveTransaction(walletAddress, {
        toAddress: walletAddress,
        amount: String(amount),
        amountFormatted: String(amount),
        txHash: recordedHash,
        status: 'confirmed',
        token: 'USDC',
        chainId: destinationChainId,
        networkName: destination.name,
        explorerUrl: `${recordedExplorer}/tx/${recordedHash}`,
        type: 'bridge',
        note: `Bridged from ${source.name} to ${destination.name} via Circle App Kit / CCTP V2`,
      }),
      writeActivity(
        buildBridgeActivity(
          walletAddress,
          amount,
          `${source.name} → ${destination.name}`,
          burnTxHash,
          recordedHash,
        ),
      ),
      logTreasuryEvent(
        'bridge_activity',
        amount,
        `USDC bridged from ${source.name} to ${destination.name} via Circle App Kit`,
        walletAddress,
        recordedHash,
      ),
    ]);

    return NextResponse.json({
      bridgeId: burnTxHash,
      status: 'completed',
      burnTxHash,
      forwardTxHash: forwardTxHash ?? null,
      sourceChain: source.name,
      destinationChain: destination.name,
      completedAt: now,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unable to record bridge' },
      { status: 500 },
    );
  }
}
