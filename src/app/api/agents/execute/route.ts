import { NextRequest, NextResponse } from 'next/server';
import { executeAgent } from '@/lib/agents/executor';
import { obs } from '@/lib/observability/logger';
import { verifyApiWallet } from '@/lib/auth/middleware';

// POST /api/agents/execute — run an agent task (non-streaming).
// The approval path calls executeAgent() directly after an explicit human approval.
// This HTTP endpoint is independently authenticated so it cannot be used as an
// unauthenticated execution backdoor.
export async function POST(req: NextRequest) {
  try {
    const { agentId, task, walletAddress } = await req.json() as {
      agentId: string; task: string; walletAddress?: string;
    };

    if (!agentId || !task?.trim() || !walletAddress) {
      return NextResponse.json({ error: 'agentId, task and walletAddress required' }, { status: 400 });
    }

    const auth = await verifyApiWallet(req, walletAddress, true);
    if (!auth.ok) return NextResponse.json({ error: auth.reason ?? 'Wallet signature required' }, { status: 401 });

    const result = await executeAgent({ agentId, task, callerWallet: walletAddress });
    return NextResponse.json(result);
  } catch (err) {
    const e = err as Error;
    void obs.error('ai', 'Agent execute API error', { error: e.message });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
