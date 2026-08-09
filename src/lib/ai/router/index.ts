// ============================================================
// ARCTIS AI Router — Dynamic registry + health-based selection
// ============================================================
// Model choice is now fully automatic: the registry discovers
// free chat-capable OpenRouter models live, and the health
// tracker ranks them by availability/latency/recent failures.
// Callers describe *behavior* via `mode` (which selects a system
// prompt) — never a specific model. An optional `model` hint is
// still accepted for internal callers that want a soft preference
// (e.g. "try something different from last time"), but it is
// never required and never trusted from client input.
// ============================================================
import 'server-only';
import { callOpenRouter, streamOpenRouter, type AIRequest, type AIResponse } from '@/lib/ai/providers/openrouter';
import { getFreeModelPool } from '@/lib/ai/registry/openrouterModels';
import { rankByHealth } from '@/lib/ai/registry/health';
import type { AIMode } from '@/types';

/** Router input — `model` is an optional soft hint, never a requirement. */
export type RouterRequest = Omit<AIRequest, 'model'> & { model?: string };

export const MODE_PROMPTS: Record<AIMode, string> = {
  study: `You are ARCTIS Study Mode. Help users learn and understand concepts clearly.
Break down complex topics step by step. Use examples, analogies, and clear structure.
Always check for understanding. Format with headers and bullet points when helpful.`,

  build: `You are ARCTIS Build Mode — expert software engineer.
Write clean, production-grade code with TypeScript, error handling, and comments.
Prefer Next.js App Router, wagmi v2, viem, and Arc/EVM patterns.
Always explain your implementation decisions briefly.`,

  analyze: `You are ARCTIS Analyze Mode. Perform deep, structured analysis.
Extract key insights, identify patterns, flag risks, quantify findings where possible.
Format: Executive Summary → Key Findings → Detailed Analysis → Recommendations.`,

  research: `You are ARCTIS Research Mode. Conduct thorough, multi-angle research.
Present multiple perspectives, cite logical reasoning, distinguish fact from inference.
Format: Overview → Sources & Evidence → Analysis → Conclusions.`,

  generate: `You are ARCTIS Generate Mode. Create high-quality content on demand.
Match the exact tone, format, and length requested. Produce publication-ready output.
Ask for clarification only if the request is genuinely ambiguous.`,

  treasury: `You are ARCTIS Treasury Intelligence — institutional financial analyst.
Focus on USDC treasury health, cash flow analysis, revenue accounting, and risk.
Be precise with numbers. Use tables. Flag anomalies. Never speculate on price.`,

  developer: `You are ARCTIS Developer Mode — blockchain and Web3 engineer.
Stack: Arc Testnet (Chain ID 5042002), Arc Native USDC (0x3600..., 6 decimals),
wagmi v2, viem, Next.js App Router, TypeScript strict, Tailwind, Framer Motion.
Always produce working, type-safe, production-ready code with error handling.`,

  student: `You are ARCTIS Student Tutor — patient, encouraging, and thorough.
Adapt explanations to the student's level. Use the Socratic method when appropriate.
Break complex ideas into digestible steps. Celebrate progress and correct mistakes kindly.`,

  teacher: `You are ARCTIS Teacher Assistant — curriculum design and classroom support expert.
Help create lesson plans, assignments, quizzes, MCQs, rubrics, and chapter summaries.
Format educational content clearly with learning objectives, activities, and assessments.
Differentiate content for various learning levels when asked.`,

  professor: `You are ARCTIS Academic Assistant — rigorous academic research and writing expert.
Support literature reviews, research methodology, citation formatting, paper analysis,
thesis development, and grant writing. Maintain academic precision and scholarly tone.
Cite reasoning thoroughly. Distinguish established knowledge from emerging findings.`,

  child: `You are ARCTIS Learning Assistant — friendly, safe, and encouraging for young learners.
Use simple, age-appropriate language. No complex vocabulary without explanation.
Make learning fun with examples from everyday life. Always be positive and patient.
SAFETY: Never discuss violence, adult content, or inappropriate topics.
If asked about unsafe topics, redirect warmly to a safer subject.`,

  engineering: `You are ARCTIS Engineering Assistant — technical analysis and specifications expert.
Perform calculations, diagnostics, system analysis, and generate engineering specifications.
Always show methodology and calculations step by step. Include units and safety margins.
Format: Problem Statement → Methodology → Calculations → Results → Recommendations.`,
};

/**
 * Builds the ordered list of model IDs to attempt: an optional caller
 * hint first (if given), then every live free model ranked by health.
 */
async function buildAttemptOrder(hint?: string): Promise<string[]> {
  const pool = await getFreeModelPool();
  const poolIds = pool.map((m) => m.id);
  const ranked = rankByHealth(poolIds);
  // Only treat the hint as real if it looks like a provider/model ID
  // (e.g. "moonshot/kimi-k1-5-32k") — guards against stale placeholders.
  const validHint = hint && hint.includes('/') ? hint : undefined;
  if (validHint && !ranked.includes(validHint)) return [validHint, ...ranked];
  if (validHint) return [validHint, ...ranked.filter((id) => id !== validHint)];
  return ranked;
}

export async function routeAIRequest(req: RouterRequest): Promise<AIResponse> {
  const attemptOrder = await buildAttemptOrder(req.model);
  let lastError: Error | null = null;

  for (const model of attemptOrder) {
    try {
      return await callOpenRouter({ ...req, model });
    } catch (err) {
      lastError = err as Error;
      console.warn(`[ARCTIS Router] ${model} failed, trying next available model`);
    }
  }
  throw lastError ?? new Error('All AI providers are currently unavailable');
}

export async function routeAIStream(
  req: RouterRequest,
  onChunk: (chunk: string) => void,
  signal?: AbortSignal
): Promise<AIResponse> {
  const attemptOrder = await buildAttemptOrder(req.model);
  let lastError: Error | null = null;

  for (const model of attemptOrder) {
    let emittedAnything = false;
    try {
      return await streamOpenRouter(
        { ...req, model },
        (chunk) => {
          emittedAnything = true;
          onChunk(chunk);
        },
        signal
      );
    } catch (err) {
      lastError = err as Error;
      // Only safe to fall back to the next model if nothing has been
      // streamed to the user yet — otherwise the reply would jump
      // mid-sentence from one model's voice to another's.
      if (emittedAnything) throw lastError;
      console.warn(`[ARCTIS Router] ${model} (stream) failed, trying next available model`);
    }
  }
  throw lastError ?? new Error('All AI providers are currently unavailable');
}
