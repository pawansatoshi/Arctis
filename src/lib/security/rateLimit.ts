// ============================================================
// Rate Limiting — Phase 18: Production Hardening
// Firestore-backed sliding window. Works correctly across
// serverless instances (in-memory counters do not, since each
// cold start gets a fresh process).
// ============================================================

import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getDb } from '@/lib/firebase/config';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: string;
}

/**
 * Checks and increments a sliding-window rate limit counter.
 * @param key       Unique identifier — typically `${route}:${walletOrIp}`
 * @param maxCalls  Max calls allowed within the window
 * @param windowMs  Window duration in milliseconds
 */
export async function checkRateLimit(
  key: string,
  maxCalls: number,
  windowMs: number
): Promise<RateLimitResult> {
  const db = getDb();
  const ref = doc(db, 'rate_limits', key);

  try {
    const snap = await getDoc(ref);
    const now = Date.now();

    if (!snap.exists()) {
      await setDoc(ref, { count: 1, windowStart: now, updatedAt: serverTimestamp() });
      return { allowed: true, remaining: maxCalls - 1, resetAt: new Date(now + windowMs).toISOString() };
    }

    const data = snap.data();
    const windowStart = data.windowStart as number;
    const elapsed = now - windowStart;

    if (elapsed > windowMs) {
      // Window expired — reset
      await setDoc(ref, { count: 1, windowStart: now, updatedAt: serverTimestamp() });
      return { allowed: true, remaining: maxCalls - 1, resetAt: new Date(now + windowMs).toISOString() };
    }

    const currentCount = (data.count as number) ?? 0;
    if (currentCount >= maxCalls) {
      return { allowed: false, remaining: 0, resetAt: new Date(windowStart + windowMs).toISOString() };
    }

    await setDoc(ref, { count: currentCount + 1, windowStart, updatedAt: serverTimestamp() });
    return { allowed: true, remaining: maxCalls - currentCount - 1, resetAt: new Date(windowStart + windowMs).toISOString() };
  } catch {
    // Fail open — a rate limiter outage must never take down the API.
    // This is a deliberate trade-off: availability over strict enforcement
    // during infrastructure failures.
    return { allowed: true, remaining: maxCalls, resetAt: new Date(Date.now() + windowMs).toISOString() };
  }
}

/** Standard rate limit tiers used across ARCTIS routes. */
export const RATE_LIMITS = {
  aiChat:      { maxCalls: 30, windowMs: 60_000 },       // 30/min
  agentAction: { maxCalls: 10, windowMs: 60_000 },       // 10/min — financial actions, tighter
  swap:        { maxCalls: 5,  windowMs: 60_000 },       // 5/min
  bridge:      { maxCalls: 5,  windowMs: 60_000 },       // 5/min
  passport:    { maxCalls: 5,  windowMs: 300_000 },      // 5/5min — claim/update is infrequent
} as const;
