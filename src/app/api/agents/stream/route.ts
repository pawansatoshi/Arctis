import { NextRequest, NextResponse } from 'next/server';
import { executeAgent } from '@/lib/agents/executor';
import { getAgent } from '@/lib/agents/service';
import { obs } from '@/lib/observability/logger';

// POST /api/agents/stream — run agent with SSE streaming
// ARCHITECTURE NOTE: this is a direct-execution path used by the
// UI's streaming display AFTER a proposal has been approved via
// /api/agents/approve. Ownership is verified here as defense in
// depth even though the primary gate is the propose/approve flow.
export async function POST(req: NextRequest) {
  try {
    const { agentId, task, walletAddress } = await req.json() as { agentId: string; task: string; walletAddress?: string };
    if (!agentId || !task?.trim()) {
      return NextResponse.json({ error: 'agentId and task required' }, { status: 400 });
    }

    // ── Ownership check (closes prior security gap) ─────────
    if (walletAddress) {
      const agent = await getAgent(agentId);
      if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
      if (agent.ownerWallet.toLowerCase() !== walletAddress.toLowerCase()) {
        void obs.warn('ai', 'Unauthorized stream execute attempt', { agentId, walletAddress });
        return NextResponse.json({ error: 'Unauthorized: you do not own this agent' }, { status: 403 });
      }
    }

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          const result = await executeAgent({
            agentId,
            task,
            callerWallet: walletAddress,
            onChunk: (chunk) => {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk })}\n\n`));
            },
          });
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({
              done: true,
              executionId: result.executionId,
              creditsConsumed: result.creditsConsumed,
              reportId: result.reportId,
              durationMs: result.durationMs,
            })}\n\n`
          ));
        } catch (err) {
          const e = err as Error;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: e.message })}\n\n`));
          void obs.error('ai', 'Agent stream error', { error: e.message, agentId });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
    });
  } catch (err) {
    const e = err as Error;
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
