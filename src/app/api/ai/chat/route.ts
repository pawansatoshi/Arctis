import { NextRequest, NextResponse } from 'next/server';
import { routeAIStream, routeAIRequest, MODE_PROMPTS, MODE_DEFAULTS, AI_MODELS } from '@/lib/ai/router';
import { deductCredits, getCreditBalance } from '@/lib/credits/engine';
import { getMembership } from '@/lib/memberships/service';
import { MEMBERSHIP_PLANS } from '@/lib/memberships/plans';
import { obs } from '@/lib/observability/logger';
import type { AIMode } from '@/types';

// ============================================================
// POST /api/ai/chat — with credit pre-check + tier enforcement
// ============================================================

// Estimate credits needed before the call (conservative: 2k tokens)
const ESTIMATED_MIN_CREDITS = 2;

export async function POST(req: NextRequest) {
  const start = Date.now();
  try {
    const body = await req.json();
    const {
      messages, model, mode = 'build' as AIMode,
      walletAddress, sessionId, stream = false,
      _systemOverride,
    } = body as {
      messages: Array<{ role: 'user' | 'assistant'; content: string }>;
      model?: string; mode?: AIMode; walletAddress?: string;
      sessionId?: string; stream?: boolean;
      _systemOverride?: string;
    };

    if (!messages?.length) {
      return NextResponse.json({ error: 'messages required' }, { status: 400 });
    }

    const resolvedModel = model ?? MODE_DEFAULTS[mode as AIMode] ?? 'moonshot/kimi-k1-5-32k';
    const systemPrompt  = _systemOverride ?? MODE_PROMPTS[mode as AIMode] ?? MODE_PROMPTS.build;

    // ── P1-1: Credit pre-check ─────────────────────────────
    if (walletAddress) {
      const balance = await getCreditBalance(walletAddress);
      if (balance.remaining < ESTIMATED_MIN_CREDITS) {
        return NextResponse.json({
          error: 'Insufficient credits. Please purchase more credits to continue.',
          creditsRemaining: balance.remaining,
          creditsNeeded: ESTIMATED_MIN_CREDITS,
        }, { status: 402 });
      }

      // ── P1-6: Membership tier enforcement ─────────────────
      const membership = await getMembership(walletAddress);
      const tier = membership?.tier ?? 'free';
      const plan = MEMBERSHIP_PLANS.find((p) => p.id === tier);

      if (plan && !plan.aiModels.includes('all')) {
        // Map model IDs to short names for comparison
        const modelShortId = resolvedModel.split('/').pop()?.split(':')[0] ?? '';
        const allowed = plan.aiModels.some(
          (m) => resolvedModel.includes(m) || m.includes(modelShortId)
        );
        if (!allowed) {
          return NextResponse.json({
            error: `Model ${resolvedModel} requires a higher membership tier.`,
            requiredUpgrade: 'pro',
            currentTier: tier,
          }, { status: 403 });
        }
      }
    }

    void obs.info('ai', 'Chat request', { model: resolvedModel, mode, stream }, walletAddress);

    if (stream) {
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          try {
            const result = await routeAIStream(
              { messages, model: resolvedModel, systemPrompt },
              (chunk) => {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk })}\n\n`));
              },
              req.signal
            );

            // Deduct actual credits used
            if (walletAddress && result.creditsUsed > 0) {
              const ok = await deductCredits(
                walletAddress, result.creditsUsed,
                `AI: ${resolvedModel.split('/').pop()} (${mode})`,
                resolvedModel, sessionId
              );
              if (!ok) {
                void obs.warn('credits', 'Credit deduction failed post-stream', { walletAddress, needed: result.creditsUsed });
              }
            }

            controller.enqueue(encoder.encode(
              `data: ${JSON.stringify({ done: true, creditsUsed: result.creditsUsed, model: result.model })}\n\n`
            ));
            void obs.info('ai', 'Stream complete', { ms: Date.now() - start, credits: result.creditsUsed }, walletAddress);
          } catch (err) {
            const e = err as Error;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: e.message })}\n\n`));
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
    const result = await routeAIRequest({ messages, model: resolvedModel, systemPrompt });

    if (walletAddress && result.creditsUsed > 0) {
      await deductCredits(
        walletAddress, result.creditsUsed,
        `AI: ${resolvedModel.split('/').pop()} (${mode})`,
        resolvedModel, sessionId
      );
    }

    void obs.info('ai', 'Chat complete', { ms: Date.now() - start, credits: result.creditsUsed }, walletAddress);
    return NextResponse.json({ content: result.content, model: result.model, creditsUsed: result.creditsUsed, usage: result.usage });
  } catch (err) {
    const e = err as Error;
    void obs.error('ai', 'Chat route error', { error: e.message });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
