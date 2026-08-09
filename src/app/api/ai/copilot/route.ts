import { NextRequest, NextResponse } from 'next/server';
import { routeAIStream, routeAIRequest } from '@/lib/ai/router';
import { obs } from '@/lib/observability/logger';
import { buildCopilotContext, serializeCopilotContext } from '@/lib/ai/copilot/context';

// ============================================================
// POST /api/ai/copilot — ARCTIS Copilot
//
// Always free — never deducts credits, never enforces membership
// tier. Its only job is to help users understand and navigate the
// platform. Model selection is fully automatic (see @/lib/ai/router)
// — Copilot never chooses or exposes a specific backend model.
// ============================================================

const BASE_PROMPT = `You are the ARCTIS Copilot — an expert assistant embedded in the ARCTIS platform.

## Your Role
Help users get the most from all four ARCTIS pillars:
1. Knowledge OS — sessions, prompt library, document management
2. AI OS — 12 AI modes, streaming chat, vision
3. Stablecoin OS — Transfer (wallet-to-wallet), Swap (USDC↔tUSDC↔tARC), Bridge (CCTP V2 to Arc Testnet)
4. Economic Agent OS — 7 agent types with memory, budgets, reports, human-approval gate

## Key Facts
- Arc Testnet: Chain ID 5042002 · Explorer testnet.arcscan.app
- Arc Native USDC: 0x3600000000000000000000000000000000000000
- Treasury: 0xb467F683764593316fAEbB0709127E90791Fe47F
- All agent tasks require: Propose → Review → Approve → Execute (no autonomous spending)

## Memberships
Free: 100 cr/mo · Student: 1,000 cr/mo, 9 USDC · Pro: 5,000 cr/mo, 29 USDC · Enterprise: 25,000 cr/mo, 99 USDC

## Behaviour
- Use the Your Context section when available to give personalised, specific answers
- Reference the user's own agents, prompts, and sessions by name when helpful
- Never reveal another user's data
- Never execute transactions — explain how to do them
- Be concise, direct, and practical
- Never mention which AI model or provider is answering — you are simply "ARCTIS Copilot"`;

export async function POST(req: NextRequest) {
  const start = Date.now();
  try {
    const { messages, walletAddress, sessionId, stream = true, languageInstruction } = await req.json() as {
      messages: Array<{ role: 'user' | 'assistant'; content: string }>;
      walletAddress?: string;
      sessionId?: string;
      stream?: boolean;
      languageInstruction?: string;
    };

    if (!messages?.length) {
      return NextResponse.json({ error: 'messages required' }, { status: 400 });
    }

    // ── Build dynamic context ─────────────────────────────────
    // Prepend language instruction so it takes effect before the knowledge base
    let systemPrompt = languageInstruction
      ? `${languageInstruction}\n\n${BASE_PROMPT}`
      : BASE_PROMPT;
    if (walletAddress) {
      try {
        const ctx = await buildCopilotContext(walletAddress);
        const contextStr = serializeCopilotContext(ctx);
        if (contextStr) systemPrompt += contextStr;
      } catch {
        void obs.warn('ai', 'Copilot context build failed', {}, walletAddress);
      }
    }

    // ── Streaming ─────────────────────────────────────────────
    if (stream) {
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          try {
            const result = await routeAIStream(
              { messages, systemPrompt },
              (chunk) => {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk })}\n\n`));
              },
              req.signal
            );
            controller.enqueue(encoder.encode(
              `data: ${JSON.stringify({ done: true })}\n\n`
            ));
            void obs.info('ai', 'Copilot stream done',
              { ms: Date.now() - start, tokens: result.usage.totalTokens }, walletAddress);
          } catch (err) {
            const e = err as Error;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'ARCTIS Copilot is temporarily busy — please try again.' })}\n\n`));
            void obs.error('ai', 'Copilot stream error', { error: e.message }, walletAddress);
          } finally {
            controller.close();
          }
        },
      });

      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // ── Non-streaming ─────────────────────────────────────────
    const result = await routeAIRequest({ messages, systemPrompt });
    return NextResponse.json({ content: result.content });
  } catch (err) {
    const e = err as Error;
    void obs.error('ai', 'Copilot error', { error: e.message });
    return NextResponse.json({ error: 'ARCTIS Copilot is temporarily unavailable — please try again shortly.' }, { status: 500 });
  }
}
