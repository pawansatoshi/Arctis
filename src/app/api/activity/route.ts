import { NextRequest, NextResponse } from 'next/server';
import { getTransactionHistory } from '@/lib/firebase/transactions';
import { getCreditHistory } from '@/lib/credits/engine';
import { getUserSessions } from '@/lib/firebase/sessions';
import { getOwnerExecutions } from '@/lib/agents/service';
import { getTreasuryLogs } from '@/lib/treasury/service';

// GET /api/activity?wallet=0x...&limit=50
// Aggregates all activity types into unified feed
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet');
  const limitCount = parseInt(req.nextUrl.searchParams.get('limit') ?? '50');
  if (!wallet) return NextResponse.json({ error: 'wallet required' }, { status: 400 });

  try {
    const [txHistory, creditHistory, aiSessions, agentExecs] = await Promise.all([
      getTransactionHistory(wallet, limitCount).catch(() => []),
      getCreditHistory(wallet, limitCount).catch(() => []),
      getUserSessions(wallet, 20).catch(() => []),
      getOwnerExecutions(wallet, 20).catch(() => []),
    ]);

    // Normalise into unified activity items
    const items: Array<{
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
    }> = [];

    for (const tx of txHistory) {
      items.push({
        id: tx.id,
        type: tx.type ?? 'transfer',
        title: `${(tx.type ?? 'Transfer').replace('_', ' ')} — ${tx.token}`,
        description: `${tx.amountFormatted} ${tx.token} → ${tx.toAddress.slice(0, 10)}…`,
        timestamp: tx.createdAt,
        amount: tx.amountFormatted,
        token: tx.token,
        status: tx.status,
        txHash: tx.txHash,
        explorerUrl: tx.explorerUrl,
        meta: { blockNumber: tx.blockNumber, gasUsed: tx.gasUsed },
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
        meta: { model: cr.aiModel, sessionId: cr.sessionId },
      });
    }

    for (const session of aiSessions) {
      items.push({
        id: session.id,
        type: 'ai_session',
        title: `AI Session — ${session.mode} mode`,
        description: session.title || 'Chat session',
        timestamp: session.updatedAt || session.createdAt,
        credits: session.totalCredits,
        meta: { model: session.model, messageCount: session.messages.length },
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
        status: exec.status,
        meta: { agentType: exec.agentType, durationMs: exec.durationMs, reportId: exec.reportId },
      });
    }

    // Sort by timestamp desc
    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({ items: items.slice(0, limitCount), total: items.length });
  } catch (err) {
    const e = err as Error;
    return NextResponse.json({ error: e.message, items: [] }, { status: 500 });
  }
}
