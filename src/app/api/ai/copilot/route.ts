import { NextRequest, NextResponse } from 'next/server';
import { routeAIStream, routeAIRequest } from '@/lib/ai/router';
import { deductCredits, getCreditBalance } from '@/lib/credits/engine';
import { getMembership } from '@/lib/memberships/service';
import { MEMBERSHIP_PLANS } from '@/lib/memberships/plans';
import { logTreasuryEvent } from '@/lib/treasury/service';
import { obs } from '@/lib/observability/logger';
import { buildCopilotContext, serializeCopilotContext } from '@/lib/ai/copilot/context';

// ============================================================
// POST /api/ai/copilot — Phase 12: AI Copilot with dynamic context
//
// Extends /api/ai/chat with:
// - Sessions, prompts, agents, and reports injected into system prompt
// - Same credit pre-check and tier enforcement as /api/ai/chat
// - Streaming and non-streaming modes
// ============================================================

const COPILOT_MODEL = 'moonshot/kimi-k1-5-32k';
const MIN_CREDITS   = 2;

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
- Be concise, direct, and practical`;

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

    // ── Credit pre-check ──────────────────────────────────────
    if (walletAddress) {
      const balance = await getCreditBalance(walletAddress);
      if (balance.remaining < MIN_CREDITS) {
        return NextResponse.json({
          error: 'Insufficient credits. Purchase more credits to continue.',
          creditsRemaining: balance.remaining,
        }, { status: 402 });
      }

      const membership = await getMembership(walletAddress);
      const tier = membership?.tier ?? 'free';
      const plan = MEMBERSHIP_PLANS.find((p) => p.id === tier);
      if (plan && !plan.aiModels.includes('all')) {
        const modelShort = COPILOT_MODEL.split('/').pop()?.split(':')[0] ?? '';
        const allowed = plan.aiModels.some((m) => COPILOT_MODEL.includes(m) || m.includes(modelShort));
        if (!allowed) {
          return NextResponse.json({ error: 'Upgrade your membership to use the Copilot.' }, { status: 403 });
        }
      }
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

    const deductAndLog = async (creditsUsed: number) => {
      if (!walletAddress || creditsUsed <= 0) return;
      await deductCredits(walletAddress, creditsUsed, 'AI: Copilot', COPILOT_MODEL, sessionId);
      void logTreasuryEvent(
        'ai_spend',
        parseFloat((creditsUsed * 0.001).toFixed(6)),
        `AI Copilot — ${creditsUsed} credits`,
        walletAddress,
      );
    };

    // ── Streaming ─────────────────────────────────────────────
    if (stream) {
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          try {
            const result = await routeAIStream(
              { messages, model: COPILOT_MODEL, systemPrompt },
              (chunk) => {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk })}\n\n`));
              },
              req.signal
            );
            await deductAndLog(result.creditsUsed);
            controller.enqueue(encoder.encode(
              `data: ${JSON.stringify({ done: true, creditsUsed: result.creditsUsed })}\n\n`
            ));
            void obs.info('ai', 'Copilot stream done',
              { ms: Date.now() - start, credits: result.creditsUsed }, walletAddress);
          } catch (err) {
            const e = err as Error;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: e.message })}\n\n`));
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
    const result = await routeAIRequest({ messages, model: COPILOT_MODEL, systemPrompt });
    await deductAndLog(result.creditsUsed);
    return NextResponse.json({ content: result.content, creditsUsed: result.creditsUsed });
  } catch (err) {
    const e = err as Error;
    void obs.error('ai', 'Copilot error', { error: e.message });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
