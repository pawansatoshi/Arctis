import 'server-only';
import { callOpenRouter, streamOpenRouter, type AIRequest, type AIResponse } from '@/lib/ai/providers/openrouter';
import { getFreeModelPool } from '@/lib/ai/registry/openrouterModels';
import { rankByHealth } from '@/lib/ai/registry/health';
import { AI_MODE_DEFINITIONS } from '@/config/ai';
import type { AIMode } from '@/types';

// Model selection and persona behavior are intentionally separate.
export type RouterRequest = Omit<AIRequest, 'model'> & { model?: string };

/** Backwards-compatible export consumed by API routes. */
export const MODE_PROMPTS: Record<AIMode, string> = Object.fromEntries(
  Object.entries(AI_MODE_DEFINITIONS).map(([id, definition]) => [id, definition.systemPrompt])
) as Record<AIMode, string>;

async function buildAttemptOrder(hint?: string): Promise<string[]> {
  const pool = await getFreeModelPool();
  const ranked = rankByHealth(pool.map((model) => model.id));
  const validHint = hint && hint.includes('/') ? hint : undefined;
  if (validHint && !ranked.includes(validHint)) return [validHint, ...ranked];
  if (validHint) return [validHint, ...ranked.filter((id) => id !== validHint)];
  return ranked;
}

export async function routeAIRequest(req: RouterRequest): Promise<AIResponse> {
  const attemptOrder = await buildAttemptOrder(req.model);
  let lastError: Error | null = null;
  for (const model of attemptOrder) {
    try { return await callOpenRouter({ ...req, model }); }
    catch (err) { lastError = err as Error; console.warn(`[ARCTIS Router] ${model} failed, trying next available model`); }
  }
  throw lastError ?? new Error('All AI providers are currently unavailable');
}

export async function routeAIStream(req: RouterRequest, onChunk: (chunk: string) => void, signal?: AbortSignal): Promise<AIResponse> {
  const attemptOrder = await buildAttemptOrder(req.model);
  let lastError: Error | null = null;
  for (const model of attemptOrder) {
    let emittedAnything = false;
    try {
      return await streamOpenRouter({ ...req, model }, (chunk) => { emittedAnything = true; onChunk(chunk); }, signal);
    } catch (err) {
      lastError = err as Error;
      if (emittedAnything) throw lastError;
      console.warn(`[ARCTIS Router] ${model} (stream) failed, trying next available model`);
    }
  }
  throw lastError ?? new Error('All AI providers are currently unavailable');
}
