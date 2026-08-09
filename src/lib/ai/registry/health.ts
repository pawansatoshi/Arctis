import 'server-only';

// ============================================================
// ARCTIS Model Health Tracker
// ============================================================
// In-memory only — resets on server restart. This is a deliberate
// trade-off for the current single-process deployment: it keeps
// the routing decision fast (no extra Firestore round-trip on the
// hot path of every AI request). If ARCTIS later runs across
// multiple server instances, this should move to a shared store
// (e.g. Firestore or Redis) so health state is consistent across
// instances — the function signatures below are designed so that
// swap can happen without touching call sites.
// ============================================================

interface ModelHealth {
  consecutiveFailures: number;
  cooldownUntil: number;   // epoch ms; 0 = not in cooldown
  avgLatencyMs: number;
  samples: number;
}

const health = new Map<string, ModelHealth>();

const COOLDOWN_MS_BY_FAILURE_COUNT = [0, 15_000, 60_000, 5 * 60_000]; // 0, 15s, 1m, 5m
const RATE_LIMIT_COOLDOWN_MS = 30_000; // 429s get a fixed short cooldown

function getOrInit(modelId: string): ModelHealth {
  let h = health.get(modelId);
  if (!h) {
    h = { consecutiveFailures: 0, cooldownUntil: 0, avgLatencyMs: 0, samples: 0 };
    health.set(modelId, h);
  }
  return h;
}

export function isAvailable(modelId: string): boolean {
  const h = health.get(modelId);
  if (!h) return true;
  return Date.now() >= h.cooldownUntil;
}

export function recordSuccess(modelId: string, latencyMs: number): void {
  const h = getOrInit(modelId);
  h.consecutiveFailures = 0;
  h.cooldownUntil = 0;
  // Simple moving average, capped sample weight so it adapts to
  // recent conditions rather than being dragged down by history.
  const weight = Math.min(h.samples, 20);
  h.avgLatencyMs = (h.avgLatencyMs * weight + latencyMs) / (weight + 1);
  h.samples += 1;
}

export function recordFailure(modelId: string, opts?: { rateLimited?: boolean }): void {
  const h = getOrInit(modelId);
  h.consecutiveFailures += 1;

  if (opts?.rateLimited) {
    h.cooldownUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
    return;
  }

  const idx = Math.min(h.consecutiveFailures, COOLDOWN_MS_BY_FAILURE_COUNT.length - 1);
  h.cooldownUntil = Date.now() + COOLDOWN_MS_BY_FAILURE_COUNT[idx];
}

/**
 * Ranks candidate model IDs by health — available first, then by lowest
 * average latency, then by fewest recent failures. Unknown models (never
 * tried yet) rank as "available, latency 0" so they get a fair first try.
 */
export function rankByHealth(modelIds: string[]): string[] {
  return [...modelIds].sort((a, b) => {
    const aAvail = isAvailable(a);
    const bAvail = isAvailable(b);
    if (aAvail !== bAvail) return aAvail ? -1 : 1;

    const ha = health.get(a);
    const hb = health.get(b);
    const aLatency = ha?.avgLatencyMs ?? 0;
    const bLatency = hb?.avgLatencyMs ?? 0;
    if (aLatency !== bLatency) return aLatency - bLatency;

    const aFail = ha?.consecutiveFailures ?? 0;
    const bFail = hb?.consecutiveFailures ?? 0;
    return aFail - bFail;
  });
}

export function getHealthSnapshot(): Record<string, ModelHealth & { available: boolean }> {
  const out: Record<string, ModelHealth & { available: boolean }> = {};
  for (const [id, h] of health.entries()) {
    out[id] = { ...h, available: isAvailable(id) };
  }
  return out;
}
