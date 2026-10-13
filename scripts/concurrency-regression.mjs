/**
 * ARCTIS Concurrency & Distributed Idempotency Regression Tests
 * Verifies that server-side idempotency guards are NOT based on
 * the in-memory execution-lock.ts Set and ARE backed by Firestore
 * atomic operations.
 *
 * Run: node scripts/concurrency-regression.mjs
 *
 * These are static source-analysis tests. They verify structural
 * invariants without running a live server or Firestore.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const executionLock   = read('src/lib/transaction/execution-lock.ts');
const swapService     = read('src/lib/swap/service.ts');
const swapRoute       = read('src/app/api/swap/execute/route.ts');
const creditsEngine   = read('src/lib/credits/engine.ts');
const membershipSvc   = read('src/lib/memberships/service.ts');
const authVerifyServer = read('src/lib/auth/verify.server.ts');
const authVerifyClient = read('src/lib/auth/verify.ts');

// ── 1. execution-lock.ts is CLIENT-ONLY ──────────────────────────────────────

// The lock module must not import any server-only package
assert.ok(
  !executionLock.includes("'server-only'") && !executionLock.includes('"server-only"'),
  'execution-lock: must NOT import server-only (it is a client-side UX guard)',
);
assert.ok(
  !executionLock.includes('firebase') && !executionLock.includes('getAdminDb'),
  'execution-lock: must NOT import Firebase Admin (no server-side logic here)',
);
// Must document that it is a UX guard only
assert.ok(
  executionLock.includes('UX GUARD ONLY') || executionLock.includes('UX guard'),
  'execution-lock: must document that it is a UX guard, not a distributed lock',
);

// ── 2. verify.ts (shared) must not contain server-only imports ───────────────
// Check for actual import statements (not mentions in comments/strings)
assert.ok(
  !(/^import\s+['"]server-only['"]/m.test(authVerifyClient)),
  'verify.ts (client-shared): must NOT have `import "server-only"` statement (would break client bundle)',
);
assert.ok(
  !(/^import\s+.*from\s+['"]firebase-admin/m.test(authVerifyClient)) &&
  !authVerifyClient.includes('getAdminDb('),
  'verify.ts (client-shared): must NOT import firebase-admin or call getAdminDb()',
);

// ── 3. verify.server.ts nonce consumption is atomic ──────────────────────────
assert.ok(
  authVerifyServer.includes("'server-only'"),
  'verify.server.ts: must import server-only',
);
assert.ok(
  authVerifyServer.includes('runTransaction'),
  'verify.server.ts: consumeNonce must use Firestore runTransaction for atomicity',
);
assert.ok(
  authVerifyServer.includes('used_nonces'),
  'verify.server.ts: nonce store must use the used_nonces collection',
);
// Fail-closed: Firestore error → return false → caller gets 401
assert.ok(
  authVerifyServer.includes('return false') && authVerifyServer.includes('catch'),
  'verify.server.ts: consumeNonce must fail-closed (return false) on Firestore error',
);

// ── 4. Swap createSwapRecord is atomic (Firestore transaction) ────────────────
assert.ok(
  swapService.includes('runTransaction') && swapService.includes('swap_already_processed'),
  'swap/service.ts: createSwapRecord must use Firestore runTransaction and throw swap_already_processed on race',
);
// Verify snap.exists and swap_already_processed both appear in createSwapRecord function body.
// We locate the function by its export name and check both tokens appear within it.
{
  const fnStart = swapService.indexOf('export async function createSwapRecord');
  assert.ok(fnStart !== -1, 'swap/service.ts: createSwapRecord must be exported');
  // Find the end of the function by counting braces from fnStart
  let depth = 0, fnEnd = fnStart;
  for (let i = fnStart; i < swapService.length; i++) {
    if (swapService[i] === '{') depth++;
    else if (swapService[i] === '}') { depth--; if (depth === 0) { fnEnd = i; break; } }
  }
  const fnBody = swapService.slice(fnStart, fnEnd + 1);
  assert.ok(
    fnBody.includes('snap.exists'),
    'swap/service.ts: createSwapRecord body must check snap.exists inside the transaction',
  );
  assert.ok(
    fnBody.includes('swap_already_processed'),
    'swap/service.ts: createSwapRecord body must throw swap_already_processed on race',
  );
  assert.ok(
    fnBody.includes('runTransaction'),
    'swap/service.ts: createSwapRecord must use runTransaction',
  );
}

// ── 5. Swap execute route handles swap_already_processed → 409 ───────────────
assert.ok(
  swapRoute.includes('swap_already_processed') && swapRoute.includes('status: 409'),
  'swap/execute route: must catch swap_already_processed and return 409 (not 500)',
);

// ── 6. Credits addCredits is idempotent via stable Firestore key ──────────────
assert.ok(
  creditsEngine.includes('tx_${txHash.toLowerCase()}'),
  'credits/engine.ts: addCredits must use stable tx-keyed Firestore doc for deduplication',
);
assert.ok(
  creditsEngine.includes('runTransaction') && creditsEngine.includes('ledgerSnap.exists'),
  'credits/engine.ts: addCredits must check ledgerSnap.exists inside a Firestore transaction',
);
assert.ok(
  creditsEngine.includes('transaction_already_processed'),
  'credits/engine.ts: addCredits must throw transaction_already_processed on duplicate txHash',
);

// ── 7. Membership activateMembership guards txHash across wallets ─────────────
assert.ok(
  membershipSvc.includes("where('txHash', '==', txHash)"),
  'memberships/service.ts: activateMembership must query txHash across all wallets to prevent cross-wallet replay',
);
assert.ok(
  membershipSvc.includes('transaction_already_processed'),
  'memberships/service.ts: activateMembership must throw transaction_already_processed on duplicate txHash',
);

// ── 8. No server-side route imports execution-lock directly ───────────────────
const apiDir = path.join(root, 'src/app/api');
function walkTs(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...walkTs(full));
    else if (e.name.endsWith('.ts') || e.name.endsWith('.tsx')) files.push(full);
  }
  return files;
}
const apiFiles = walkTs(apiDir);
for (const f of apiFiles) {
  const src = fs.readFileSync(f, 'utf8');
  assert.ok(
    !src.includes('execution-lock'),
    `Server route ${path.relative(root, f)} must NOT import execution-lock (client-only UX guard)`,
  );
}

console.log('');
console.log('✓ All ARCTIS concurrency regression checks passed');
console.log('  Invariants verified:');
console.log('  - execution-lock.ts: client-only UX guard, no server imports, documented');
console.log('  - verify.ts: no server-only imports (client bundle safe)');
console.log('  - verify.server.ts: Firestore runTransaction nonce atomicity, fail-closed');
console.log('  - swap createSwapRecord: Firestore transaction, swap_already_processed on race');
console.log('  - swap execute route: 409 on concurrent duplicate, not 500');
console.log('  - addCredits: stable tx-keyed doc + runTransaction idempotency');
console.log('  - activateMembership: cross-wallet txHash uniqueness guard');
console.log(`  - ${apiFiles.length} API route files: none import execution-lock`);
