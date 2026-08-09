import { NextRequest, NextResponse } from 'next/server';
import { approveProposal, rejectProposal } from '@/lib/agents/executor';
import { obs } from '@/lib/observability/logger';
import { checkRateLimit, RATE_LIMITS } from '@/lib/security/rateLimit';

export async function POST(req: NextRequest) {
  try {
    const { proposalId, walletAddress, action, reason } = await req.json() as {
      proposalId: string; walletAddress: string; action: 'approve' | 'reject'; reason?: string;
    };

    if (!proposalId || !walletAddress) return NextResponse.json({ error: 'proposalId and walletAddress required' }, { status: 400 });
    if (action !== 'approve' && action !== 'reject') return NextResponse.json({ error: 'action must be "approve" or "reject"' }, { status: 400 });

    const rl = await checkRateLimit(`approve:${walletAddress.toLowerCase()}`, RATE_LIMITS.agentAction.maxCalls, RATE_LIMITS.agentAction.windowMs);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many requests — please wait before trying again', resetAt: rl.resetAt }, { status: 429 });
    }

    if (action === 'reject') {
      await rejectProposal(proposalId, walletAddress, reason);
      return NextResponse.json({ success: true, status: 'rejected' });
    }

    const result = await approveProposal(proposalId, walletAddress);
    return NextResponse.json(result);
  } catch (err) {
    const e = err as Error;
    void obs.error('ai', 'Agent approve/reject error', { error: e.message });
    const status = e.message.startsWith('Unauthorized') ? 403 : e.message.startsWith('Cannot') ? 409 : 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}
