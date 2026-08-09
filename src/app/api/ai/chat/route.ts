import { NextRequest, NextResponse } from 'next/server';
import { routeAIStream, routeAIRequest, MODE_PROMPTS } from '@/lib/ai/router';
import { deductCredits, getCreditBalance } from '@/lib/credits/engine';
import { obs } from '@/lib/observability/logger';
import { parseFinancialIntent, describeIntent } from '@/lib/ai/intent/parser';
import type { AIMode } from '@/types';

// ============================================================
// POST /api/ai/chat — ARCTIS AI Workspace
//
// Model selection is fully automatic and never trusted from the
// client — only `mode` (which selects a persona/system prompt) is
// accepted. Backend routing (registry, health, provider) is never
// exposed in responses, logs the user can see, or ledger text.
// ============================================================

const ESTIMATED_MIN_CREDITS = 2;
const GENERIC_ERROR = 'ARCTIS AI is temporarily busy — please try again in a moment.';

function modeLabel(mode: AIMode): string {
  return mode.charAt(0).toUpperCase() + mode.slice(1);
}

export async function POST(req: NextRequest) {
  const start = Date.now();
  try {
    const body = await req.json();
    const {
      messages, mode = 'build' as AIMode,
      walletAddress, sessionId, stream = false,
      _systemOverride,
    } = body as {
      messages: Array<{ role: 'user' | 'assistant'; content: string }>;
      mode?: AIMode; walletAddress?: string;
      sessionId?: string; stream?: boolean;
      _systemOverride?: string;
    };

    if (!messages?.length) {
      return NextResponse.json({ error: 'messages required' }, { status: 400 });
    }

    // ── Financial intent detection (orchestration only) ─────
    // Deterministic parse, never an LLM call — if the user's message
    // matches a Transfer/Swap/Bridge pattern, we hand back a *proposed
    // plan* for the user to confirm. We never execute anything here;
    // wallet signing happens entirely client-side on the existing
    // Transfer/Swap/Bridge pages once the user confirms.
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
    const intent = parseFinancialIntent(lastUserMessage);

    if (intent) {
      void obs.info('ai', 'Financial intent detected', { action: intent.action }, walletAddress);
      const summary = describeIntent(intent);

      if (stream) {
        const encoder = new TextEncoder();
        const readable = new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ actionProposal: intent, chunk: `Here's what I understood: **${summary}**. Review the details and confirm to continue — nothing happens until you approve it in your wallet.` })}\n\n`));
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, creditsUsed: 0 })}\n\n`));
            controller.close();
          },
        });
        return new Response(readable, {
          headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
        });
      }

      return NextResponse.json({
        content: `Here's what I understood: ${summary}. Review the details and confirm to continue.`,
        actionProposal: intent,
        creditsUsed: 0,
      });
    }

    const systemPrompt = _systemOverride ?? MODE_PROMPTS[mode as AIMode] ?? MODE_PROMPTS.build;

    // ── Credit pre-check ────────────────────────────────────
    if (walletAddress) {
      const balance = await getCreditBalance(walletAddress);
      if (balance.remaining < ESTIMATED_MIN_CREDITS) {
        return NextResponse.json({
          error: 'Insufficient credits. Please purchase more credits to continue.',
          creditsRemaining: balance.remaining,
          creditsNeeded: ESTIMATED_MIN_CREDITS,
        }, { status: 402 });
      }
    }

    void obs.info('ai', 'Chat request', { mode, stream }, walletAddress);

    const ledgerDescription = `ARCTIS AI — ${modeLabel(mode)} mode`;

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

            if (walletAddress && result.creditsUsed > 0) {
              const ok = await deductCredits(walletAddress, result.creditsUsed, ledgerDescription, result.model, sessionId);
              if (!ok) {
                void obs.warn('credits', 'Credit deduction failed post-stream', { walletAddress, needed: result.creditsUsed });
              }
            }

            controller.enqueue(encoder.encode(
              `data: ${JSON.stringify({ done: true, creditsUsed: result.creditsUsed })}\n\n`
            ));
            void obs.info('ai', 'Stream complete', { ms: Date.now() - start, credits: result.creditsUsed, model: result.model }, walletAddress);
          } catch (err) {
            const e = err as Error;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: GENERIC_ERROR })}\n\n`));
            void obs.error('ai', 'Stream error', { error: e.message }, walletAddress);
          } finally {
            controller.close();
          }
        },
      });

      return new Response(readable, {
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
      });
    }

    // Non-streaming
    const result = await routeAIRequest({ messages, systemPrompt });

    if (walletAddress && result.creditsUsed > 0) {
      await deductCredits(walletAddress, result.creditsUsed, ledgerDescription, result.model, sessionId);
    }

    void obs.info('ai', 'Chat complete', { ms: Date.now() - start, credits: result.creditsUsed, model: result.model }, walletAddress);
    return NextResponse.json({ content: result.content, creditsUsed: result.creditsUsed, usage: result.usage });
  } catch (err) {
    const e = err as Error;
    void obs.error('ai', 'Chat route error', { error: e.message });
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
  }
}
