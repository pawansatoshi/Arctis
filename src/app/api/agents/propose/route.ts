import { NextRequest, NextResponse } from 'next/server';
import { proposeAgent } from '@/lib/agents/executor';
import { obs } from '@/lib/observability/logger';
import { checkRateLimit, RATE_LIMITS } from '@/lib/security/rateLimit';

export async function POST(req: NextRequest) {
  try {
    const { agentId, task, walletAddress } = await req.json() as { agentId: string; task: string; walletAddress: string };

    if (!agentId || !task?.trim()) return NextResponse.json({ error: 'agentId and task required' }, { status: 400 });
    if (!walletAddress) return NextResponse.json({ error: 'walletAddress required' }, { status: 400 });

    const rl = await checkRateLimit(`propose:${walletAddress.toLowerCase()}`, RATE_LIMITS.agentAction.maxCalls, RATE_LIMITS.agentAction.windowMs);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many proposals — please wait before trying again', resetAt: rl.resetAt }, { status: 429 });
    }

    const proposal = await proposeAgent({ agentId, task: task.trim(), callerWallet: walletAddress });
    return NextResponse.json(proposal);
  } catch (err) {
    const e = err as Error;
    void obs.error('ai', 'Agent propose error', { error: e.message });
    const status = e.message.startsWith('Unauthorized') ? 403 : e.message.startsWith('Insufficient') ? 402 : 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}
