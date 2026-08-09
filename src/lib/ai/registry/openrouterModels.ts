import 'server-only';

// ============================================================
// ARCTIS Dynamic Model Registry
// ============================================================
// Discovers free, chat-capable OpenRouter models automatically.
// If a model disappears from OpenRouter's catalog (or goes paid),
// it drops out of the pool with no code change. If a new free
// model appears, it's picked up on the next refresh.
//
// IMPORTANT (verify once network access is available):
// This assumes OpenRouter's /api/v1/models response shape as of
// their public docs (July 2026): { data: [{ id, name, pricing:
// { prompt, completion }, context_length, architecture? }] }.
// A model is treated as free when pricing.prompt === "0" AND
// pricing.completion === "0" (this also naturally matches most
// ":free"-suffixed IDs, since that's how OpenRouter prices them).
// Run `curl https://openrouter.ai/api/v1/models | head -c 2000`
// once and compare against this shape before relying on it in
// production — the exact field names are the one thing that
// could not be verified from inside this sandbox.
// ============================================================

export interface RegistryModel {
  id: string;
  name: string;
  contextLength: number;
}

interface OpenRouterModelEntry {
  id: string;
  name?: string;
  pricing?: { prompt?: string; completion?: string };
  context_length?: number;
  architecture?: { modality?: string; input_modalities?: string[]; output_modalities?: string[] };
}

const REGISTRY_URL = 'https://openrouter.ai/api/v1/models';
const REFRESH_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours
const MIN_CONTEXT_LENGTH = 4000; // filter out tiny/toy context models

// Hard exclusions — model families known to be unsuitable for general
// chat even when free (embeddings, moderation, image-only, etc.)
const EXCLUDE_ID_PATTERNS = [/embed/i, /moderation/i, /rerank/i, /whisper/i, /tts/i, /vision-only/i];

let cache: { models: RegistryModel[]; fetchedAt: number } | null = null;
let refreshInFlight: Promise<RegistryModel[]> | null = null;

function isFreeModel(m: OpenRouterModelEntry): boolean {
  const promptPrice = m.pricing?.prompt;
  const completionPrice = m.pricing?.completion;
  const zeroPriced =
    (promptPrice === '0' || promptPrice === '0.0' || Number(promptPrice) === 0) &&
    (completionPrice === '0' || completionPrice === '0.0' || Number(completionPrice) === 0);
  return zeroPriced || m.id.endsWith(':free');
}

function isChatCapable(m: OpenRouterModelEntry): boolean {
  if (EXCLUDE_ID_PATTERNS.some((re) => re.test(m.id))) return false;
  if ((m.context_length ?? 0) < MIN_CONTEXT_LENGTH) return false;
  const outputs = m.architecture?.output_modalities;
  if (outputs && outputs.length > 0 && !outputs.includes('text')) return false;
  return true;
}

async function fetchLiveRegistry(): Promise<RegistryModel[]> {
  const res = await fetch(REGISTRY_URL, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) throw new Error(`OpenRouter models API returned ${res.status}`);

  const json = await res.json() as { data?: OpenRouterModelEntry[] };
  const all = json.data ?? [];

  const free = all
    .filter((m) => isFreeModel(m) && isChatCapable(m))
    .map((m) => ({
      id: m.id,
      name: m.name ?? m.id,
      contextLength: m.context_length ?? 8000,
    }));

  if (free.length === 0) {
    throw new Error('OpenRouter returned zero free chat-capable models');
  }

  return free;
}

/**
 * Returns the current free-model pool. Refreshes from OpenRouter if the
 * cache is stale; falls back to the last-known-good cache (or a hardcoded
 * safety net) if the live fetch fails.
 */
export async function getFreeModelPool(): Promise<RegistryModel[]> {
  const now = Date.now();

  if (cache && now - cache.fetchedAt < REFRESH_INTERVAL_MS) {
    return cache.models;
  }

  // Coalesce concurrent refreshes into a single in-flight request.
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const models = await fetchLiveRegistry();
      cache = { models, fetchedAt: Date.now() };
      console.log(`[ARCTIS Registry] Refreshed — ${models.length} free chat models available`);
      return models;
    } catch (err) {
      console.warn('[ARCTIS Registry] Refresh failed:', (err as Error).message);
      if (cache) {
        console.warn('[ARCTIS Registry] Serving last-known-good cache');
        return cache.models;
      }
      console.warn('[ARCTIS Registry] No cache available — using safety-net fallback list');
      return SAFETY_NET_MODELS;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

export function forceRefresh(): void {
  cache = null;
}

// Last-resort hardcoded list — used ONLY if OpenRouter has never once
// been successfully reached (e.g. very first request after a cold start
// with a transient network issue). Verify these IDs are still `:free`
// before relying on this list; it exists purely so the app never has
// zero candidate models.
const SAFETY_NET_MODELS: RegistryModel[] = [
  { id: 'openrouter/free', name: 'ARCTIS AI (auto)', contextLength: 200_000 },
];
