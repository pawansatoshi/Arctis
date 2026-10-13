// ============================================================
// Client-side execution deduplication — UX GUARD ONLY
//
// This module prevents a user from double-clicking "Execute"
// in the same browser tab during an in-flight transaction.
// It is imported exclusively by client components:
//   - src/app/swap/page.tsx
//   - src/app/bridge/page.tsx
//   - src/app/transfer/page.tsx
//
// IMPORTANT SCOPE LIMITATION:
// The in-memory Set below is NOT a distributed lock. In Vercel's
// serverless runtime each function invocation gets its own memory
// and never shares this Set with any other instance. This module
// provides zero protection against:
//   - Two different browser sessions
//   - Two concurrent API calls from different instances
//   - Page reloads that clear the Set
//
// SERVER-SIDE IDEMPOTENCY is handled separately:
//   - Swap:       createSwapRecord uses a Firestore transaction
//                 (atomic create — throws swap_already_processed on race)
//   - Credits:    addCredits uses a stable tx-keyed Firestore doc
//                 (throws transaction_already_processed on duplicate)
//   - Membership: activateMembership checks txHash uniqueness across wallets
//   - Nonces:     consumeNonce in verify.server.ts uses a Firestore transaction
//
// DO NOT add server-side imports or business logic here.
// ============================================================

const inFlight = new Set<string>();

export function tryAcquireExecution(key: string): boolean {
  if (inFlight.has(key)) return false;
  inFlight.add(key);
  return true;
}

export function releaseExecution(key: string): void {
  inFlight.delete(key);
}
