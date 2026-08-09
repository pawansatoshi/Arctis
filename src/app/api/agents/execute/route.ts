import { NextRequest, NextResponse } from 'next/server';
import { executeAgent } from '@/lib/agents/executor';
import { obs } from '@/lib/observability/logger';

// POST /api/agents/execute — run an agent task (non-streaming)
// ARCHITECTURE NOTE: this is called internally by approveProposal()
// after a human has explicitly approved a proposal via /api/agents/approve.
// executeAgent() itself enforces ownership whenever callerWallet is passed.
export async function POST(req: NextRequest) {
  try {
    const { agentId, task, walletAddress } = await req.json() as {
      agentId: string; task: string; walletAddress?: string;
    };

    if (!agentId || !task?.trim()) {
      return NextResponse.json({ error: 'agentId and task required' }, { status: 400 });
    }

    const result = await executeAgent({ agentId, task, callerWallet: walletAddress });
    return NextResponse.json(result);
  } catch (err) {
    const e = err as Error;
    void obs.error('ai', 'Agent execute API error', { error: e.message });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
