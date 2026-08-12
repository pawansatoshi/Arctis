import { NextRequest, NextResponse } from 'next/server';
import { getTransactionHistory } from '@/lib/firebase/transactions';
import { getCreditHistory } from '@/lib/credits/engine';
import { getUserSessions } from '@/lib/firebase/sessions';
import { getOwnerExecutions } from '@/lib/agents/service';
import { getSwapHistory } from '@/lib/swap/service';
import { getBridgeHistory } from '@/lib/bridge/service';

// ============================================================
// GET /api/activity?wallet=0x...&limit=50
// Aggregates all activity types into one unified, chronological feed.
// `meta` is internal-only and intentionally never exposes the AI model/provider.
// ============================================================

interface ActivityItem {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
  amount?: string;
  token?: string;
  status?: string;
  txHash?: string;
  explorerUrl?: string;
  credits?: number;
  meta?: Record<string, unknown>;
}

function historyStatus(status: string | undefined): string | undefined {
  if (!status) return undefined;
  if (status === 'completed' || status === 'confirmed') return status;
  if (status === 'failed' || status === 'timeout') return 'failed';
  // pending, confirming, dispatching, burning, attesting, forwarding,
  // approving and other active lifecycle states are presented consistently
  // to the History UI as pending.
  return 'pending';
}

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet');
  const limitCount = parseInt(req.nextUrl.searchParams.get('limit') ?? '50');
  if (!wallet) return NextResponse.json({ error: 'wallet required' }, { status: 400 });

  try {
    const [txHistory, creditHistory, aiSessions, agentExecs, swapHistory, bridgeHistory] = await Promise.all([
      getTransactionHistory(wallet, limitCount).catch(() => []),
      getCreditHistory(wallet, limitCount).catch(() => []),
      getUserSessions(wallet, 20).catch(() => []),
      getOwnerExecutions(wallet, 20).catch(() => []),
      getSwapHistory(wallet, Math.max(limitCount, 50)).catch(() => []),
      getBridgeHistory(wallet, Math.max(limitCount, 50)).catch(() => []),
    ]);

    const items: ActivityItem[] = [];

    for (const tx of txHistory) {
      items.push({
        id: tx.id,
        type: 'transfer',
        title: `${(tx.type ?? 'Transfer').replace('_', ' ')} — ${tx.token}`,
        description: `${tx.amountFormatted} ${tx.token} → ${tx.toAddress.slice(0, 10)}…`,
        timestamp: tx.createdAt,
        amount: tx.amountFormatted,
        token: tx.token,
        status: historyStatus(tx.status),
        txHash: tx.txHash,
        explorerUrl: tx.explorerUrl,
        meta: { blockNumber: tx.blockNumber, gasUsed: tx.gasUsed, rawStatus: tx.status },
      });
    }

    for (const cr of creditHistory) {
      items.push({
        id: cr.id,
        type: 'credit',
        title: cr.type === 'purchase' ? 'Credits Purchased' : cr.type === 'deduct' ? 'Credits Used' : 'Credits Bonus',
        description: cr.description,
        timestamp: cr.createdAt,
        credits: cr.credits,
        txHash: cr.txHash,
        meta: { sessionId: cr.sessionId },
      });
    }

    for (const session of aiSessions) {
      items.push({
        id: session.id,
        type: 'ai_session',
        title: 'ARCTIS AI Session',
        description: session.title || 'Chat session',
        timestamp: session.updatedAt || session.createdAt,
        credits: session.totalCredits,
        meta: { messageCount: session.messages.length },
      });
    }

    for (const exec of agentExecs) {
      items.push({
        id: exec.id,
        type: 'agent_execution',
        title: `${exec.agentName} — ${exec.status}`,
        description: exec.task.slice(0, 80),
        timestamp: exec.startedAt,
        credits: exec.creditsConsumed,
        status: historyStatus(exec.status),
        meta: { agentType: exec.agentType, durationMs: exec.durationMs, reportId: exec.reportId, rawStatus: exec.status },
      });
    }

    for (const swap of swapHistory) {
      items.push({
        id: swap.id,
        type: 'swap',
        title: `Swap ${swap.fromToken} → ${swap.toToken}`,
        description: `${swap.inputAmount} ${swap.fromToken} → ${swap.outputAmount} ${swap.toToken}`,
        timestamp: swap.createdAt,
        status: historyStatus(swap.status),
        txHash: swap.outboundTxHash ?? swap.inboundTxHash,
        meta: { rawStatus: swap.status, failureReason: swap.failureReason },
      });
    }

    for (const bridge of bridgeHistory) {
      items.push({
        id: bridge.burnTxHash,
        type: 'bridge',
        title: `Bridge ${bridge.sourceChain} → ${bridge.destinationChain}`,
        description: `${bridge.amount} USDC · ${bridge.status}`,
        timestamp: bridge.createdAt,
        status: historyStatus(bridge.status),
        txHash: bridge.forwardTxHash ?? bridge.burnTxHash,
        meta: { rawStatus: bridge.status, failureReason: bridge.failureReason },
      });
    }

    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({ items: items.slice(0, limitCount), total: items.length });
  } catch (err) {
    const e = err as Error;
    return NextResponse.json({ error: e.message, items: [] }, { status: 500 });
  }
}
