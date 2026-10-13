/**
 * ARCTIS Security Regression Tests
 * Covers the findings from the 2026-10-13 Arc Studio audit.
 *
 * Run: node scripts/security-regression.mjs
 *
 * These are static code analysis tests — they assert invariants in the source
 * files without running a live server or Firestore. They are deterministic,
 * require no environment variables, and can run in CI.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

// ── Source files ────────────────────────────────────────────
const verify       = read('src/lib/chain/verify.ts');
const credits      = read('src/app/api/credits/route.ts');
const membership   = read('src/app/api/membership/route.ts');
const freeTier     = read('src/app/api/membership/activate-free/route.ts');
const treasury     = read('src/app/api/treasury/route.ts');
const engine       = read('src/lib/credits/engine.ts');
const memberSvc    = read('src/lib/memberships/service.ts');
const authVerify   = read('src/lib/auth/verify.ts');
const rateLimit    = read('src/lib/security/rateLimit.ts');
const contracts    = read('src/lib/contracts.ts');

// ══════════════════════════════════════════════════════════
// H1 — USDC payment verifier must bind to authenticated sender
// ══════════════════════════════════════════════════════════
assert.ok(
  verify.includes('tx.from.toLowerCase() !== expectedSender.toLowerCase()'),
  'H1: verifyUSDCPayment must bind to authenticated sender (tx.from check)',
);
assert.ok(
  verify.includes('from === senderAddress'),
  'H1: Transfer log must verify from === senderAddress',
);
assert.ok(
  verify.includes('value === expectedAmount'),
  'H1: verifyUSDCPayment must require exact amount match',
);
assert.ok(
  credits.includes('pkg.usdcAmount, network, walletAddress'),
  'H1: credits route must pass walletAddress as expectedSender to verifyUSDCPayment',
);
assert.ok(
  membership.includes('plan.priceUSDC, network, walletAddress'),
  'H1: membership route must pass walletAddress as expectedSender to verifyUSDCPayment',
);

// ══════════════════════════════════════════════════════════
// H2 — addCredits must be idempotent for duplicate txHash
// ══════════════════════════════════════════════════════════
assert.ok(
  engine.includes('tx_${txHash.toLowerCase()}'),
  'H2: addCredits must use stable Firestore key keyed on txHash',
);
assert.ok(
  engine.includes('transaction_already_processed'),
  'H2: addCredits must throw transaction_already_processed on duplicate hash',
);
assert.ok(
  engine.includes('ledgerSnap.exists'),
  'H2: addCredits must check for existing ledger doc before inserting',
);

// ══════════════════════════════════════════════════════════
// H3 — Verifier must assert transaction chain ID
// ══════════════════════════════════════════════════════════
assert.ok(
  verify.includes('tx.chainId !== profile.chainId'),
  'H3: verifyUSDCPayment must assert tx.chainId === profile.chainId',
);
assert.ok(
  verify.includes("clients[network]"),
  'H3: verifier must select the RPC client by network parameter, not hardcode testnet',
);

// ══════════════════════════════════════════════════════════
// M-Auth-Nonce-Replay — nonce must be consumed server-side
// ══════════════════════════════════════════════════════════
assert.ok(
  authVerify.includes('consumeNonce'),
  'M-Auth-Nonce-Replay: verifyWalletSignature must call consumeNonce',
);
assert.ok(
  authVerify.includes('used_nonces'),
  'M-Auth-Nonce-Replay: nonce consumption must write to Firestore used_nonces collection',
);
assert.ok(
  authVerify.includes('Nonce already used'),
  'M-Auth-Nonce-Replay: must return an error when nonce has been consumed',
);
assert.ok(
  authVerify.includes('runTransaction'),
  'M-Auth-Nonce-Replay: nonce consumption must be atomic (Firestore transaction)',
);

// ══════════════════════════════════════════════════════════
// M-Membership-Replay — membership must reject duplicate txHash across wallets
// ══════════════════════════════════════════════════════════
assert.ok(
  memberSvc.includes("priorClaim = await db.collection(MEMBERSHIPS_COL).where('txHash', '==', txHash)"),
  'M-Membership-Replay: activateMembership must check for prior claim across wallets',
);
assert.ok(
  memberSvc.includes('existing.tier !== tier'),
  'M-Membership-Replay: idempotent retry must only apply to same tier',
);

// ══════════════════════════════════════════════════════════
// M-Rate-Credits / M-Rate-Membership — rate limits
// ══════════════════════════════════════════════════════════
assert.ok(
  rateLimit.includes("credits:"),
  'M-Rate-Credits: RATE_LIMITS must include a credits entry',
);
assert.ok(
  rateLimit.includes("membership:"),
  'M-Rate-Membership: RATE_LIMITS must include a membership entry',
);
assert.ok(
  credits.includes('checkRateLimit') && credits.includes('credits:${walletAddress.toLowerCase()}'),
  'M-Rate-Credits: credits POST route must check rate limit per wallet',
);
assert.ok(
  membership.includes('checkRateLimit') && membership.includes('membership:${walletAddress.toLowerCase()}'),
  'M-Rate-Membership: membership POST route must check rate limit per wallet',
);
assert.ok(
  freeTier.includes('checkRateLimit'),
  'M-Rate-FreeTier: activate-free route must also check rate limit',
);
// Sensitive pattern must cover credits and membership so Firestore outage fails-closed
assert.ok(
  rateLimit.includes('credits|membership'),
  'M-Rate-Sensitive: credits and membership must be in the sensitive-route pattern (fail-closed)',
);

// ══════════════════════════════════════════════════════════
// M-Treasury-Auth — treasury GET must require auth
// ══════════════════════════════════════════════════════════
assert.ok(
  treasury.includes('verifyApiWallet'),
  'M-Treasury-Auth: treasury GET must call verifyApiWallet',
);
assert.ok(
  treasury.includes('status: 401') || treasury.includes('{ status: 401 }'),
  'M-Treasury-Auth: treasury GET must return 401 on auth failure',
);

// ══════════════════════════════════════════════════════════
// M-Free-Tier-Farming — free tier must guard against repeated activations
// ══════════════════════════════════════════════════════════
assert.ok(
  freeTier.includes('alreadyActive: true'),
  'M-Free-Tier: activate-free must return alreadyActive when membership is still valid',
);
assert.ok(
  freeTier.includes('isValidEthAddress'),
  'M-Free-Tier: activate-free must validate wallet address format',
);
assert.ok(
  freeTier.includes('transaction_already_processed'),
  'M-Free-Tier: activate-free must handle transaction_already_processed from engine',
);

// ══════════════════════════════════════════════════════════
// M-Credits-GET-Auth — credit history must require auth
// ══════════════════════════════════════════════════════════
// credits file has verifyApiWallet in the GET handler (line ~108) and getCreditBalance (line ~112)
// Assert both are present and verifyApiWallet appears before getCreditBalance in the file.
{
  const vaIdx = credits.indexOf('verifyApiWallet(req, wallet, true)');
  const cbIdx = credits.indexOf('getCreditBalance(wallet)');
  assert.ok(vaIdx !== -1, 'M-Credits-GET-Auth: credits GET must call verifyApiWallet(req, wallet, true)');
  assert.ok(cbIdx !== -1, 'M-Credits-GET-Auth: credits GET must call getCreditBalance');
  assert.ok(vaIdx < cbIdx, 'M-Credits-GET-Auth: verifyApiWallet must appear before getCreditBalance in the handler');
}

// ══════════════════════════════════════════════════════════
// Chain isolation — mainnet must use mainnet treasury / RPC
// ══════════════════════════════════════════════════════════
assert.ok(
  verify.includes('process.env.NEXT_PUBLIC_ARCTIS_MAINNET_TREASURY'),
  'Chain-Isolation: mainnet treasury must come from env, not hardcoded',
);
// PR #19 uses MAINNET_PAYMENTS_ENABLED guard before reading the treasury env var.
// Either pattern is acceptable: the important invariant is ZERO_ADDRESS is the fallback.
assert.ok(
  contracts.includes('ZERO_ADDRESS') &&
  contracts.includes('NEXT_PUBLIC_ARCTIS_MAINNET_TREASURY'),
  'Chain-Isolation: mainnet treasury must reference ZERO_ADDRESS fallback and env var',
);

// ══════════════════════════════════════════════════════════
// Network field required on payment APIs
// ══════════════════════════════════════════════════════════
assert.ok(
  credits.includes('!network'),
  'Network-Required: credits POST must reject requests without a network field',
);
assert.ok(
  membership.includes('!network'),
  'Network-Required: membership POST must reject requests without a network field',
);

// ══════════════════════════════════════════════════════════
// No unguarded free-tier path to paid membership endpoint
// ══════════════════════════════════════════════════════════
assert.ok(
  membership.includes('Use the dedicated free-membership activation endpoint'),
  'Free-Tier-Guard: paid membership POST must reject free tier (priceUSDC === 0)',
);

console.log('');
console.log('✓ All ARCTIS security regression checks passed (2026-10-13 audit)');
console.log('  Findings covered: H1, H2, H3, M-Auth-Nonce-Replay, M-Membership-Replay,');
console.log('  M-Rate-Credits, M-Rate-Membership, M-Treasury-Auth, M-Free-Tier-Farming,');
console.log('  M-Credits-GET-Auth, Chain-Isolation, Network-Required, Free-Tier-Guard');
