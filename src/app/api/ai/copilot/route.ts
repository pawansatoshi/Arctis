import { NextRequest, NextResponse } from 'next/server';
import { routeAIStream, routeAIRequest } from '@/lib/ai/router';
import { obs } from '@/lib/observability/logger';
import { buildCopilotContext, serializeCopilotContext } from '@/lib/ai/copilot/context';
import { buildCanonicalProductContext } from '@/lib/ai/copilot/product-context';

// ============================================================
// POST /api/ai/copilot — ARCTIS Copilot
// Always free. Backend model selection is automatic.
// Product facts are generated from canonical runtime config.
// ============================================================

const BASE_PROMPT = `You are the ARCTIS Copilot — an expert assistant embedded in the ARCTIS platform.

## Your role
Help users understand and navigate the actual ARCTIS product. Be precise about what is implemented versus planned.

## Knowledge OS
Current capabilities include workspace domains, saved prompts, AI sessions, and contextual access to the user's agents/reports. Do not claim full document ingestion, vector retrieval, or persistent cross-session user memory unless the supplied product context explicitly says it is available.

## AI OS
ARCTIS exposes user-facing personas/modes. Backend model/provider selection is automatic and is an implementation detail. Never invent a model name, provider guarantee, or model-specific entitlement.

## Stablecoin OS
Explain Transfer, configured ARCTIS OTC swaps, and configured CCTP V2/Forwarding bridge flows accurately. Never invent unsupported assets, routes, contract addresses, or execution capabilities.

## Economic Agent OS
Agents follow Propose → Review → Approve → Execute. Never tell a user that an agent can independently sign their wallet transaction.

## Safety and accuracy
- Use the canonical product context below as the source of truth for product facts.
- Use the user's context when available, but never reveal another user's data.
- Never execute transactions; explain the existing user-controlled signing flow.
- Distinguish implemented features from roadmap items.
- If a product fact is not in the canonical context, say that it needs verification rather than guessing.
- Never mention the backend model/provider unless the user is explicitly asking about architecture.`;

export async function POST(req: NextRequest) {
  const start = Date.now();
  try {
    const { messages, walletAddress, stream = true, languageInstruction } = await req.json() as {
      messages: Array<{ role: 'user' | 'assistant'; content: string }>;
      walletAddress?: string;
      stream?: boolean;
      languageInstruction?: string;
    };

    if (!messages?.length) return NextResponse.json({ error: 'messages required' }, { status: 400 });

    let systemPrompt = `${languageInstruction ? `${languageInstruction}\n\n` : ''}${BASE_PROMPT}\n${buildCanonicalProductContext()}`;

    if (walletAddress) {
      try {
        const ctx = await buildCopilotContext(walletAddress);
        const contextStr = serializeCopilotContext(ctx);
        if (contextStr) systemPrompt += contextStr;
      } catch {
        void obs.warn('ai', 'Copilot context build failed', {}, walletAddress);
      }
    }

    if (stream) {
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          try {
            const result = await routeAIStream(
              { messages, systemPrompt },
              (chunk) => controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk })}\n\n`)),
              req.signal,
            );
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
            void obs.info('ai', 'Copilot stream done', { ms: Date.now() - start, tokens: result.usage.totalTokens }, walletAddress);
          } catch (err) {
            const e = err as Error;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'ARCTIS Copilot is temporarily busy — please try again.' })}\n\n`));
            void obs.error('ai', 'Copilot stream error', { error: e.message }, walletAddress);
          } finally {
            controller.close();
          }
        },
      });
      return new Response(readable, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' } });
    }

    const result = await routeAIRequest({ messages, systemPrompt });
    return NextResponse.json({ content: result.content });
  } catch (err) {
    const e = err as Error;
    void obs.error('ai', 'Copilot error', { error: e.message });
    return NextResponse.json({ error: 'ARCTIS Copilot is temporarily unavailable — please try again shortly.' }, { status: 500 });
  }
}
