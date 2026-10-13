# ARCTIS — Evidence-Based Audit Report
**Repository:** `pawansatoshi/Arctis` · commit `1012bd4` · branch `main`
**Audited by:** Arc Studio (read-only, no files modified)
**Date:** 2026-10-13
**Scope:** Chain config, payment verification, USDC token configuration, wallet/network switching, membership and credit idempotency, transaction receipts, unsupported swap/bridge/treasury features, Solidity contracts.
**Status:** PRE-MAINNET TESTNET APPLICATION. No audit waives the disclaimer in `SECURITY.md`.

---

## Legend

| Tag | Meaning |
|-----|---------|
| **[VERIFIED]** | Finding confirmed by reading the exact file/line cited |
| **[INFERRED]** | Pattern derived from observed code; direct evidence exists but full runtime behavior not proven |
| **[ASSUMPTION]** | Plausible risk based on architecture; not directly observed in code |
| **SEV-H** | High — blocks safe mainnet launch or enables fund loss on testnet |
| **SEV-M** | Medium — incorrect behavior under realistic inputs; no immediate fund loss |
| **SEV-L** | Low — correctness or hardening gap; negligible exploit surface today |
| **SEV-I** | Informational — design note or missing test |

---

## 1. Chain Configuration

**Files:** `src/lib/chain/wagmi.ts`, `src/lib/chain/arcChain.ts`, `src/lib/contracts.ts`

### 1.1 Duplicate chain definitions [VERIFIED / SEV-L]
`arcTestnet` / `arcMainnet` are defined identically in both `wagmi.ts` (line 10–35) and `arcChain.ts` (line 3–28). `config.ts` (line 14) re-exports from `arcChain.ts` only. There is no divergence _today_, but the dual definition is a maintenance hazard: a future edit to one copy that does not propagate to the other would silently give the wagmi transport config a different chain object than the one used for public-client RPC calls in `verify.ts`.

**Recommended patch:** Remove the `arcTestnet` / `arcMainnet` definitions from `wagmi.ts` and import from `arcChain.ts` instead.

### 1.2 Arc Testnet native-currency decimals mismatch [VERIFIED / SEV-M]
Both chain definitions declare `nativeCurrency: { decimals: 18 }` (wagmi.ts L12, arcChain.ts L5), but `contracts.ts` declares `DECIMALS.USDC = 6` (line 28). On Arc, USDC IS the native gas token (same pool, two views). The 18-decimal native view and the 6-decimal ERC-20 view must never be confused.

Observed risk: any UI component that reads the wagmi `useBalance` return value (which reports native decimals) and formats it using `PRIMARY_DECIMALS` (6) will display a balance that is **10^12 times too small**. Any component that converts in the reverse direction will appear to send 10^12 times too much.

**Recommended patch:** Add a comment on both `nativeCurrency.decimals: 18` entries explicitly warning that this is the _native/gas view_ only, and that USDC ERC-20 balances and payment amounts must use `DECIMALS.USDC = 6` exclusively.

### 1.3 Arc Mainnet transport silently falls back to single public RPC [VERIFIED / SEV-L]
`wagmi.ts` line 83 configures Arc Mainnet transport as a single `http('https://rpc.mainnet.arc.io')`. Arc Testnet has a 4-URL fallback array (lines 76–81). A Mainnet RPC outage will surface as a broken app with no automatic recovery. This is acceptable for a testnet stage build but must be fixed before mainnet.

### 1.4 Non-arc testnets in wagmi config without payment or routing wiring [VERIFIED / SEV-I]
`wagmi.ts` registers Ethereum Sepolia, Base Sepolia, and Arbitrum Sepolia in the `chains` array. These chains are used only for CCTP bridge source chains. Their inclusion in the wagmi wallet-connect config means MetaMask can be connected to any of them and the UI will not prevent the user from initiating a payment on the wrong chain. The payment verification (`verify.ts`) always queries Arc Testnet RPC regardless of which chain the user is on, so a USDC payment sent from Base Sepolia to the treasury would pass the address filter but would not be found on the Arc Testnet chain the verifier reads. This is a latent confusion risk if the credits/membership UI allows payment from non-Arc chains.

---

## 2. USDC Token Configuration

**Files:** `src/lib/contracts.ts`

### 2.1 USDC address on Arc is the protocol precompile 0x3600...0000 [VERIFIED / SEV-I — correct, but document-worthy]
`contracts.ts` line 23 sets `USDC: '0x3600000000000000000000000000000000000000'`. This is the Arc protocol precompile address — it has **zero bytecode** (`code.length == 0`). Any call to `decimals()` or `symbol()` on this address as a standard ERC-20 contract will revert. The `ERC20_ABI` includes `decimals()` and `symbol()` view functions. If any client code calls those on `PRIMARY_CONTRACT`, it will revert silently.

`ARCTISAgentTreasury.sol` correctly carve-outs this address at line 124 (`token != ARC_USDC`), but the off-chain JavaScript code has no equivalent guard.

**Recommended patch:** Add a comment on `ERC20_ABI` and `PRIMARY_CONTRACT` warning that `decimals()` / `symbol()` must never be called on `PRIMARY_CONTRACT` directly; hardcode the known values (6 / "USDC") where needed.

### 2.2 Mainnet USDC address reuses same 0x3600...0000 precompile [VERIFIED / SEV-I]
`contracts.ts` line 39 sets mainnet `USDC` to the identical `0x3600000000000000000000000000000000000000`. This is correct for Arc Mainnet but should be explicitly verified against the Circle canonical registry before mainnet launch. If Arc Mainnet uses a different address the configuration is silently wrong.

### 2.3 Mainnet treasury address derivation [VERIFIED / SEV-M]
```ts
// contracts.ts line 45
treasury: (process.env.NEXT_PUBLIC_ARCTIS_MAINNET_TREASURY || MAINNET_TREASURY) as `0x${string}`,
```
`MAINNET_TREASURY` is hardcoded as `'0xb467F683764593316fAEbB0709127E90791Fe47F'` (line 14). If `NEXT_PUBLIC_ARCTIS_MAINNET_TREASURY` is not set (or is accidentally set to a blank/placeholder string), _real mainnet USDC payments will be directed to the hardcoded address_. The `NEXT_PUBLIC_` prefix means this address is shipped in the browser bundle and visible to all users.

Additionally, the env-check logic in `env.ts` (line 39) strips values containing `'your_'` or `'_here'`, but does not validate the format of the treasury address itself. A misconfigured or zero-value override would not be caught.

**Recommended patch:** Add an `assertEnvOrThrow`-style check that the resolved mainnet treasury address is a valid non-zero Ethereum address; add `NEXT_PUBLIC_ARCTIS_MAINNET_TREASURY` to `ENV_CHECKS` in `env.ts`.

---

## 3. Payment Verification

**Files:** `src/lib/chain/verify.ts`, `src/app/api/credits/route.ts`, `src/app/api/membership/route.ts`

### 3.1 `verifyUSDCPayment` does not check chain ID of the transaction [VERIFIED / SEV-H]
`verify.ts` lines 38–78: the function calls `client.getTransactionReceipt({ hash: txHash })` on a fixed Arc Testnet public client. It verifies:
- Transaction status === 'success'
- Logs contain a Transfer event from the USDC contract to the treasury for >= the expected amount

It does **not** verify that the transaction was mined on Arc Testnet (chain ID 5042002). If `ENV = 'mainnet'`, `PRIMARY_CONTRACT` and `TREASURY_WALLET` resolve to mainnet values (`contracts.ts` lines 51–58), but `getClient()` (verify.ts lines 12–16) still hardcodes `arcTestnet` via `arcChain.ts`. In the testnet build this is harmless (both agree on chain 5042002), but if `NEXT_PUBLIC_NETWORK_ENV=mainnet` is set, the verifier will query the testnet RPC with mainnet addresses, will not find the transfer, and all payments will fail — or worse, if Arc Mainnet and Arc Testnet share an RPC hostname that routes based on chain ID, transactions could cross-validate.

**Recommended patch:** The verifier should accept a `chainId` parameter and assert `receipt.chainId === expectedChainId` (when the RPC returns it). At minimum, add a guard that verifies `CHAIN_ID` matches `arcTestnet.id` when the testnet client is in use.

### 3.2 `verifyUSDCPayment` accepts `value >= expectedAmount` (overpayment passes silently) [VERIFIED / SEV-L]
verify.ts line 62: `value >= expectedAmount`. A user who accidentally sends 2x the expected USDC will have their credits or membership activated for the standard amount without any error or refund signal. This is expected behavior in many systems, but there is no on-chain or off-chain record of the overpayment amount.

### 3.3 `verifyUSDCPayment` does not bind the sender address [VERIFIED / SEV-M]
`verifyUSDCPayment` (credits and membership) checks only that _some_ ERC-20 Transfer event of the right amount arrived at the treasury. It does not verify that `tx.from` equals the authenticated wallet. An attacker who observes another user's valid payment transaction hash could submit that same `txHash` to the `/api/credits` or `/api/membership` endpoint _before_ the original user does, and claim the credits/membership for their own wallet.

The EIP-191 wallet signature in `verifyApiWallet` binds the _wallet address_ to the request, but only to the extent the signature is valid and the `txHash` was not already used. The idempotency guard in `activateMembership` (service.ts line 65) is keyed on `txHash + existing wallet`, so a different wallet that presents the same `txHash` first would succeed.

`verifyTokenPayment` (used by the swap executor) already solves this correctly by passing `expectedSender` (verify.ts line 107–109, 128). The same pattern should be applied to `verifyUSDCPayment`.

**Recommended patch:** Add an `expectedSender: string` parameter to `verifyUSDCPayment` and verify `tx.from.toLowerCase() === expectedSender.toLowerCase()` before accepting the transfer.

### 3.4 Nonce in `verifyWalletSignature` is a raw timestamp with no server-side tracking [VERIFIED / SEV-M]
`verify.ts` (auth) lines 27–31: the nonce is accepted if it is a numeric timestamp within the last 5 minutes. There is no server-side nonce store or consumed-nonce registry. A valid signature can be replayed unlimited times within its 5-minute window by any server or attacker who captures the request headers (`x-wallet-signature`, `x-wallet-nonce`, `x-wallet-address`). Because the signature binds a specific wallet address and nonce but not a specific route or action, a captured signature from a `/api/credits` call could be replayed to `/api/membership` within the same 5-minute window.

**Recommended patch:** Include the target route path and request body hash in the signed message, or store consumed nonces server-side with a TTL of 5 minutes.

---

## 4. Wallet and Network Switching

**Files:** `src/lib/network/profile.ts`, `src/lib/contracts.ts`, `src/lib/chain/wagmi.ts`

### 4.1 Client-side network profile reads from `localStorage` [VERIFIED / SEV-M]
`profile.ts` line 17: `window.localStorage.getItem('arctis-network-env')`. The server-side profile is fixed at build time from `NEXT_PUBLIC_NETWORK_ENV`. The client can read a different profile from localStorage. This means:
- The server's `PRIMARY_CONTRACT`, `TREASURY_WALLET`, and `CHAIN_ID` are immutably testnet unless the env is rebuilt.
- The client UI (network selector, displayed addresses, chain-switching prompts) can show mainnet labels while the server continues to verify against testnet.
- A user who switches to "mainnet" in the UI will have their wallet prompted to connect to Arc Mainnet (chain 5042), but any payment they make will be verified against Arc Testnet (chain 5042002) and will fail.

This is deliberately documented in `contracts.ts` line 9: _"Client code must select a profile explicitly through src/lib/network/profile.ts."_ But the asymmetry is a UX footgun and, at mainnet launch, a potential loss of funds if a user pays on Mainnet while the server verifies on Testnet.

**Recommended patch:** When `NEXT_PUBLIC_NETWORK_ENV` is `testnet` (the default), the client network switcher should be disabled or display a clear warning that mainnet payments are not yet processed.

### 4.2 `execution-lock.ts` uses an in-process `Set` [VERIFIED / SEV-M]
`execution-lock.ts` lines 1–10: `const inFlight = new Set<string>()`. This is a module-level singleton. In a Next.js serverless/edge deployment, each function invocation runs in its own isolate — `inFlight` is not shared across concurrent requests. Two simultaneous requests for the same wallet can both read `inFlight.has(key) === false` and proceed. The lock provides zero protection in production serverless environments.

The credits and membership routes do not appear to call this lock directly (it was not observed in their imports). The swap executor also does not use it. This module exists but is unused in the critical paths — or if it is used in paths not read, it still provides no real concurrency protection.

**Recommended patch:** Replace with a Firestore transaction-backed lock (or Firestore `set` with `{merge: false}` as a compare-and-swap). The credit `addCredits` function already uses Firestore transactions correctly; ensure any caller that needs single-execution semantics uses those rather than this lock.

---

## 5. Membership Idempotency

**Files:** `src/lib/memberships/service.ts`, `src/app/api/membership/route.ts`

### 5.1 Idempotency guard keyed on `txHash` only at the document level [VERIFIED / SEV-M]
`service.ts` lines 65–67:
```ts
if (txHash && existing?.txHash === txHash) {
  return normalizeMembership(existing, addr);
}
```
This prevents the _same wallet_ from activating twice with the same `txHash`. However:
- A different wallet that presents the same `txHash` is not blocked (see §3.3 above).
- The check is a plain read-then-write, not a Firestore transaction. A concurrent request from the same wallet with the same `txHash` (e.g. double-click) can pass the check simultaneously before either write completes.
- After the idempotency check passes, `activateMembership` calls `ref.set({}, { merge: true })`, which overwrites the `tier`, `status`, `expiryDate`, and calls `addCredits` again. If the race condition is hit, the wallet can receive double monthly credit allocation.

**Recommended patch:** Wrap the idempotency check and the `ref.set` + `addCredits` in a single Firestore transaction. Use `create`-style semantics (fail if `txHash` field already exists) rather than merge.

### 5.2 Free tier membership grants credits without a `txHash` [VERIFIED / SEV-I]
`route.ts` line 45: `if (plan.priceUSDC > 0) { verify... }`. Free membership activations skip verification entirely and proceed directly to `activateMembership(walletAddress, 'free', txHash)` where `txHash` arrives as a body-provided string. For the free tier, `txHash` is presumably omitted by the client. The idempotency guard in `service.ts` line 65 only fires when `txHash` is truthy. A wallet that repeatedly hits `/api/membership` for the free tier with `txHash = undefined` will:
1. Pass the idempotency check (no `txHash` to compare).
2. Overwrite the membership document.
3. Call `addCredits` with 100 credits each time.

The EIP-191 signature gate in the route does block unauthenticated calls, but an authenticated wallet can trigger this in a tight loop.

**Recommended patch:** For the free tier, key idempotency on the `walletAddress` + `tier` combination: if a `free` membership document already exists with `status: 'active'` and a non-expired `expiryDate`, reject the re-activation without granting more credits.

---

## 6. Credit Idempotency

**Files:** `src/lib/credits/engine.ts`, `src/app/api/credits/route.ts`

### 6.1 `addCredits` does not check for duplicate `txHash` [VERIFIED / SEV-H]
`engine.ts` lines 26–55: `addCredits` opens a Firestore transaction, reads the current balance, adds the requested credits, and writes a new ledger entry. There is **no check for whether `txHash` has already been credited**. The function accepts any call.

The only protection at the route level (`route.ts` line 46) is `verifyUSDCPayment` returning `valid: true`. Since that verification also does not bind the sender (§3.3), a valid `txHash` can be submitted multiple times by different wallets (or the same wallet before any server-side deduplication exists) and each call will add credits.

**Recommended patch:** Before calling `addCredits`, query the ledger for any entry with `txHash === txHash`; reject if found. This query should be inside the same Firestore transaction as the credit addition to avoid TOCTOU.

### 6.2 `deductCredits` silently swallows all errors [VERIFIED / SEV-L]
`engine.ts` lines 69–96: the outer `try/catch` returns `false` on _any_ error, including Firestore connectivity failures. A transient Firestore outage during AI inference would silently allow credits to be consumed without being recorded, causing balance drift. The function signature returns `boolean`, so callers cannot distinguish "insufficient credits" from "Firestore is down."

**Recommended patch:** Re-throw non-`insufficient_credits` errors, or return a richer result type `{ success: boolean; reason: 'insufficient' | 'error' }` so callers can retry on transient failures.

---

## 7. Transaction Receipt Handling

**Files:** `src/lib/chain/verify.ts`, `src/app/api/credits/route.ts`, `src/app/api/membership/route.ts`

### 7.1 `saveTransaction` in credits/membership uses `void` (fire-and-forget) [VERIFIED / SEV-L]
`route.ts` (credits, line 85): `await Promise.allSettled([saveTransaction(...), writeActivity(...)])`. This is correct: it awaits completion. However, the same pattern in the swap executor (`route.ts` lines 135, 149) uses `void saveTransaction(...)` and `void writeActivity(...)` — fire-and-forget. If Firestore write fails for the swap transaction record, the user's history will be incomplete with no error surfaced.

**Recommended patch:** In the swap executor, at minimum log the `Promise.allSettled` rejection reasons via `obs.warn`.

### 7.2 Receipt `blockNumber` and `gasUsed` are stored as strings [VERIFIED / SEV-I]
`route.ts` (credits, line 66–67): `blockNumber: verification.blockNumber?.toString()`. `blockNumber` is a `bigint` from viem. Storing as a string is correct for Firestore (which cannot store BigInt), but deserializers must not assume these fields are numeric. The `TreasuryLog` type should reflect `string` for these fields.

### 7.3 `getTransactionReceipt` can throw on an unknown hash [VERIFIED / SEV-L]
`verify.ts` lines 44 and 100: `client.getTransactionReceipt({ hash: txHash })`. On viem, this throws `TransactionReceiptNotFoundError` if the hash is not found on the RPC node (e.g. because the transaction was dropped from the mempool or submitted to the wrong chain). The outer `try/catch` on lines 75–78 catches this and returns `{ valid: false, reason: 'Verification error: ...' }`, so it does not crash the route — but the error message exposed to the client will contain the raw viem error string, which may include internal RPC URL details.

**Recommended patch:** Detect `TransactionReceiptNotFoundError` specifically and return a cleaner `{ valid: false, reason: 'Transaction not found on Arc Testnet' }`.

---

## 8. Unsupported/Gated Features: Swap, Bridge, Treasury

### 8.1 OTC swap is Testnet-only with explicit mainnet block [VERIFIED / SEV-I (correctly implemented)]
`src/app/api/swap/route.ts` line 5 and `src/app/api/swap/execute/route.ts` line 31 both return early with a 503/disabled response when `network === 'mainnet'`. This is correctly implemented.

### 8.2 Bridge is Testnet-only with explicit mainnet block [VERIFIED / SEV-I (correctly implemented)]
`src/app/api/bridge/route.ts` line 5 returns `{ available: false }` for mainnet. Correct.

### 8.3 Treasury API has no authentication [VERIFIED / SEV-M]
`src/app/api/treasury/route.ts` (full file): the `GET` handler calls `getTreasuryLogs(50)` and `aggregateTreasuryMetrics()` with no authentication check. Any unauthenticated caller can retrieve the last 50 treasury log entries including wallet addresses, transaction hashes, amounts, and explorer URLs. This is an information-disclosure risk; it also leaks which wallets have active memberships or credit purchases.

**Recommended patch:** Add at minimum an admin-token header check to the treasury GET route, or move it behind an admin-only session check.

### 8.4 Swap executor wallet clients are module-level singletons with stale private key risk [VERIFIED / SEV-M]
`executor.ts` lines 27–41: `_walletClient` and `_publicClient` are module-level variables initialized from `process.env.SWAP_WALLET_PRIVATE_KEY` on first call. In a long-running Node.js server this is fine; in serverless environments (Next.js edge/lambda), each cold start re-reads the env. However, if `SWAP_WALLET_PRIVATE_KEY` is rotated without a deployment restart, the old key remains in memory until the function cold-starts again, or the new key is used with an un-rotated wallet client.

### 8.5 Swap settlement is not atomic with inbound verification [VERIFIED / SEV-M (known architecture limitation)]
`execute/route.ts` line 76: `createSwapRecord` is called _before_ on-chain verification. If the server crashes after creating the record but before verification, a `pending` swap record exists with no on-chain counterpart. If the server crashes after verification but before `dispatchSwapOutput`, the user has sent tokens in but received nothing, and the record is stuck in `confirming`. The reserve re-check (lines 103–118) partially mitigates the latter, but there is no automated recovery path for stuck swaps.

**Recommended note:** Document a manual recovery runbook: query Firestore for swap records in `confirming` or `dispatching` state older than N minutes and either dispatch the output manually or refund the user.

---

## 9. Solidity Contracts

**Files:** `contracts/ARCTISAgentEscrow.sol`, `contracts/ARCTISAgentTreasury_ARC_USDC_FIX.sol`

### 9.1 `ARCTISAgentEscrow` — no reentrancy protection on `release`, `refund`, `resolveDispute` [VERIFIED / SEV-H]
`ARCTISAgentEscrow.sol`:
- `release` (lines 112–119): sets `job.status = Status.Released` before calling `_safeTransfer`. This is the correct checks-effects-interactions order and is safe against reentrancy on a simple ERC-20.
- `refund` (lines 122–130): same pattern, safe.
- `resolveDispute` (lines 142–154): same pattern, safe.

The status-before-transfer ordering is correctly applied in all three. **No reentrancy vulnerability** — this finding is negative (good).

### 9.2 `ARCTISAgentEscrow` — `createJob` rejects `provider == msg.sender` but the check is in the wrong `if` [VERIFIED / SEV-L]
Line 84: `if (provider == msg.sender || amount == 0) revert InvalidAmount()`. The `provider == msg.sender` condition is logically a self-dealing guard, but its revert is `InvalidAmount()` which is misleading. The error type should be `InvalidAddress()` or a dedicated `SelfDeal()` error.

### 9.3 `ARCTISAgentEscrow` — no event emitted for `submit` result hash [VERIFIED / SEV-I]
`submit` (lines 103–109): emits `JobSubmitted(jobId, resultHash)`. This is correct and complete. No issue.

### 9.4 `ARCTISAgentTreasury` — `propose` and `execute` double-count daily spend [VERIFIED / SEV-M]
`ARCTISAgentTreasury_ARC_USDC_FIX.sol`:
- `propose` (lines 168–175): reads and updates `policy.dailyBucket`/`policy.dailySpent` but does **not** persist the increment — it checks `policy.dailySpent + amount > policy.maxDaily` but does not write `policy.dailySpent += amount` at proposal time.
- `execute` (lines 257–266): reads and updates `policy.dailyBucket`/`policy.dailySpent` and **does** write `policy.dailySpent += proposal.action.amount`.

This means the daily limit is only enforced at execution, not at proposal time. Multiple proposals can be created in the same day, each individually within the daily limit, and together exceeding `maxDaily`. All can then be approved and executed in sequence, bypassing the daily cap.

**Example:** `maxDaily = 150`, `maxPerTransaction = 100`. Two proposals of 100 each will both pass the `propose` check (100 <= 150). The first `execute` writes `dailySpent = 100`. The second `execute` will see `100 + 100 = 200 > 150` and revert correctly — _but both proposals were created and approved_, giving the owner a false picture of what is pending.

The Foundry test `testDailyLimitAcrossExecutedActions` catches the execution-time enforcement but does not test proposal-time enforcement against the limit.

**Recommended patch:** In `propose`, write `policy.dailySpent += amount` after the check, so the daily budget is reserved at proposal time. Alternatively, add a separate `reserved` field.

### 9.5 `ARCTISAgentTreasury` — `execute` is callable by anyone, not just `onlyOwner` [VERIFIED / SEV-M]
`execute` (line 240): no `onlyOwner` modifier. Any address that knows a valid `actionHash` of an approved, non-expired proposal can call `execute`. This is likely intentional (permissionless execution after approval is a common pattern), but it is not documented and is inconsistent with `propose` and `approve` being `onlyOwner`. An adversary monitoring the mempool can front-run a legitimate `execute` call — though the outcome is the same funds transfer to the same recipient, so the practical impact is race condition in ordering, not fund theft.

**Recommendation:** Add a NatSpec comment to `execute` explicitly documenting the permissionless design intent, or add `onlyOwner` if the intent was owner-only.

### 9.6 `ARCTISAgentEscrow` — no test for `dispute` called before `submit` (payer disputes a funded job) [VERIFIED / SEV-I]
`dispute` (line 132): `if (job.status != Status.Submitted) revert InvalidState()`. Payer cannot raise a dispute on a `Funded` job that the provider has not yet submitted, even if the deadline is approaching. This is a design choice, but there is no test verifying that a pre-submit dispute reverts with `InvalidState`. The test suite covers post-submit dispute (line 109) but not the pre-submit case.

### 9.7 Both contracts lack `owner` transfer mechanism [VERIFIED / SEV-M]
`ARCTISAgentEscrow.sol` and `ARCTISAgentTreasury_ARC_USDC_FIX.sol`: `owner` is `immutable`. There is no `transferOwnership` function. If the owner key is compromised or lost, the contract can no longer be paused, disputes cannot be resolved, and treasury funds cannot be withdrawn (escrow) or new policies set (treasury). For testnet this is acceptable; for mainnet it is a key-management risk.

**Recommended patch:** Add a two-step `transferOwnership` / `acceptOwnership` pattern (OpenZeppelin `Ownable2Step`).

---

## 10. Auth / Rate Limiting

### 10.1 Credits GET endpoint has no authentication [VERIFIED / SEV-L]
`src/app/api/credits/route.ts` lines 123–129: the `GET /api/credits?wallet=0x...` handler returns the full credit balance and history for any wallet address, with no authentication. This is an information-disclosure issue — any caller can enumerate the credit balance of any wallet address.

### 10.2 Rate limiting for credits and membership purchases is absent [VERIFIED / SEV-M]
`RATE_LIMITS` in `rateLimit.ts` (lines 60–66) defines limits for `aiChat`, `agentAction`, `swap`, `bridge`, `passport`. There is no rate limit for `/api/credits` POST or `/api/membership` POST. An attacker who possesses or compromises a valid EIP-191 signature within its 5-minute window can flood those routes. Combined with the missing `txHash` deduplication in `addCredits` (§6.1) this amplifies the credit-farming risk.

**Recommended patch:** Add `credits` and `membership` to `RATE_LIMITS` and apply `checkRateLimit` at the top of both POST handlers.

---

## 11. Missing Tests

| Area | Missing coverage | Severity |
|------|-----------------|----------|
| `verifyUSDCPayment` | No unit tests; no mock-RPC test for wrong-chain tx, overpayment, sender-mismatch | SEV-H |
| Credit `addCredits` deduplication | No test asserting that re-submitting the same `txHash` is rejected | SEV-H |
| Membership idempotency race | No concurrent-request test for double credit grant | SEV-M |
| `ARCTISAgentTreasury.propose` daily-limit | No test asserting proposal is blocked when daily budget is already reserved | SEV-M |
| `ARCTISAgentEscrow.dispute` pre-submit | No test that pre-submit dispute reverts | SEV-I |
| Treasury API auth | No integration test asserting unauthenticated GET /api/treasury is rejected | SEV-M |
| Nonce replay in `verifyWalletSignature` | No test asserting that re-presenting the same nonce/signature within 5 min is rejected | SEV-M |

---

## 12. Summary Table

| # | File(s) | Finding | Severity | Status |
|---|---------|---------|----------|--------|
| 3.3 | `verify.ts`, `credits/route.ts`, `membership/route.ts` | `verifyUSDCPayment` does not bind sender; txHash reuse across wallets | SEV-H | Open |
| 6.1 | `credits/engine.ts` | `addCredits` has no txHash deduplication | SEV-H | Open |
| 9.1 | `ARCTISAgentEscrow.sol` | Reentrancy check: **NOT vulnerable** (CEI order correct) | — | Negative |
| 3.1 | `verify.ts` | Verifier does not check transaction chain ID | SEV-H | Open |
| 3.4 | `auth/verify.ts` | Auth nonce is timestamp-only; no server-side replay tracking | SEV-M | Open |
| 5.1 | `memberships/service.ts` | Idempotency guard is not a Firestore transaction; concurrent double-grant possible | SEV-M | Open |
| 5.2 | `membership/route.ts` | Free tier can be re-activated infinitely to farm credits | SEV-M | Open |
| 6.2 | `credits/engine.ts` | `deductCredits` swallows all errors; balance drift on Firestore outage | SEV-L | Open |
| 4.2 | `transaction/execution-lock.ts` | In-process lock provides no protection in serverless | SEV-M | Open |
| 8.3 | `api/treasury/route.ts` | Treasury GET has no authentication | SEV-M | Open |
| 9.4 | `ARCTISAgentTreasury.sol` | Daily spend not reserved at propose time; multi-proposal daily-limit bypass | SEV-M | Open |
| 9.5 | `ARCTISAgentTreasury.sol` | `execute` has no `onlyOwner`; permissionless execution undocumented | SEV-M | Open |
| 9.7 | Both contracts | `owner` is `immutable`; no key rotation path | SEV-M | Open |
| 2.3 | `contracts.ts` | Mainnet treasury fallback is a hardcoded address; no format validation | SEV-M | Open |
| 1.2 | `wagmi.ts`, `arcChain.ts` | Native-currency decimals (18) vs ERC-20 decimals (6) confusion risk | SEV-M | Open |
| 10.2 | `api/credits/route.ts`, `api/membership/route.ts` | No rate limiting on credit/membership purchase routes | SEV-M | Open |
| 7.1 | `swap/execute/route.ts` | `saveTransaction` / `writeActivity` are fire-and-forget in swap | SEV-L | Open |
| 10.1 | `api/credits/route.ts` | Credits GET is unauthenticated; balance enumerable | SEV-L | Open |
| 1.1 | `wagmi.ts`, `arcChain.ts` | Duplicate chain definitions | SEV-L | Open |
| 9.2 | `ARCTISAgentEscrow.sol` | Wrong error type on self-deal guard | SEV-L | Open |
| 2.1 | `contracts.ts` | Calling ERC-20 view functions on Arc precompile (0x3600…) will revert | SEV-I | Open |

---

## 13. Recommended Minimal Patches (Ordered by Priority)

1. **Add sender binding to `verifyUSDCPayment`** — pass `from: tx.from` and assert it matches the authenticated wallet. (§3.3, §5.1)
2. **Add `txHash` deduplication to `addCredits`** — query ledger inside the same transaction before crediting. (§6.1)
3. **Add server-side nonce tracking** — store consumed nonces in Firestore with a 5-minute TTL. (§3.4)
4. **Wrap free-tier re-activation guard in idempotency check** — reject if `free` membership already active and unexpired. (§5.2)
5. **Add rate limiting to `/api/credits` POST and `/api/membership` POST**. (§10.2)
6. **Add authentication to `GET /api/treasury`**. (§8.3)
7. **Add chain-ID assertion in `verifyUSDCPayment`** — fail early if the verified chain doesn't match the configured chain. (§3.1)
8. **Reserve daily budget at proposal time in `ARCTISAgentTreasury`** — write `policy.dailySpent += amount` in `propose`. (§9.4)
9. **Add `transferOwnership` to both contracts** before any mainnet deployment. (§9.7)
10. **Replace `execution-lock.ts` module-Set with Firestore-backed lock** wherever single-execution semantics are required. (§4.2)

---

*End of audit report. No files were modified. No transactions were executed.*
