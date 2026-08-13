// ============================================================
// Rate Limiting — Phase 18: Production Hardening
// Firestore-backed sliding window (Admin SDK, server-only).
// ============================================================
import 'server-only';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase/admin';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: string;
}

/**
 * Checks and increments a sliding-window rate limit counter.
 * Sensitive financial/agent routes fail closed if the limiter itself
 * is unavailable; low-risk routes retain graceful degradation.
 */
export async function checkRateLimit(key: string, maxCalls: number, windowMs: number): Promise<RateLimitResult> {
  const db = getAdminDb();
  const ref = db.collection('rate_limits').doc(key);
  const reset = (start: number) => new Date(start + windowMs).toISOString();
  const sensitive = /(^|:)(agentAction|swap|bridge|transfer|treasury)(:|$)/i.test(key);

  try {
    const snap = await ref.get();
    const now = Date.now();

    if (!snap.exists) {
      await ref.set({ count: 1, windowStart: now, updatedAt: FieldValue.serverTimestamp() });
      return { allowed: true, remaining: Math.max(0, maxCalls - 1), resetAt: reset(now) };
    }

    const data = snap.data()!;
    const windowStart = Number(data.windowStart);
    const elapsed = now - windowStart;

    if (!Number.isFinite(windowStart) || elapsed > windowMs) {
      await ref.set({ count: 1, windowStart: now, updatedAt: FieldValue.serverTimestamp() });
      return { allowed: true, remaining: Math.max(0, maxCalls - 1), resetAt: reset(now) };
    }

    const currentCount = Number(data.count) || 0;
    if (currentCount >= maxCalls) return { allowed: false, remaining: 0, resetAt: reset(windowStart) };

    await ref.set({ count: currentCount + 1, windowStart, updatedAt: FieldValue.serverTimestamp() });
    return { allowed: true, remaining: Math.max(0, maxCalls - currentCount - 1), resetAt: reset(windowStart) };
  } catch {
    // Availability is acceptable for low-risk reads, but not for sensitive
    // financial/agent actions: an outage must not turn protection into
    // unlimited access.
    if (sensitive) {
      return { allowed: false, remaining: 0, resetAt: new Date(Date.now() + windowMs).toISOString() };
    }
    return { allowed: true, remaining: maxCalls, resetAt: new Date(Date.now() + windowMs).toISOString() };
  }
}

export const RATE_LIMITS = {
  aiChat:      { maxCalls: 30, windowMs: 60_000 },
  agentAction: { maxCalls: 10, windowMs: 60_000 },
  swap:        { maxCalls: 5, windowMs: 60_000 },
  bridge:      { maxCalls: 5, windowMs: 60_000 },
  passport:    { maxCalls: 5, windowMs: 300_000 },
} as const;
