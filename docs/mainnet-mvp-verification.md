# ARCTIS Mainnet MVP — Verification Report

**PR #23** — `feat/mainnet-mvp` → `main`  
**Commit** — `f17b3ba1358c35813ab5eb97c4d00aab455b0646`  
**Date** — 2026-10-13  
**Status** — VERIFIED READY. Awaiting owner approval before merge.

---

## Preview Deployment

| Field | Value |
|-------|-------|
| Preview URL | `https://arctis-ic4r0zu9n-pawansatoshis-projects.vercel.app` |
| Vercel deployment ID | `Boz2zVtzdpKT6yGXxosM5uLoogiK` |
| Vercel status | `success` (deployment completed 2026-10-13T10:28:12Z) |
| Access | Vercel SSO protected (302 → `/sso-api` for unauthenticated callers — expected for team preview URLs) |
| PR | https://github.com/pawansatoshi/Arctis/pull/23 |

---

## Check Results

| Check | Result | Detail |
|-------|--------|--------|
| `tsc --noEmit` | PASS | exit 0, zero type errors |
| `mainnet-regression.mjs` | PASS | 11 groups, all passed |
| `network-isolation-regression.mjs` | PASS | passed |
| `transaction-regression.mjs` | PASS | passed |
| GitHub Actions `verify` job | PASS | completed 2026-10-13T10:28:49Z |
| Vercel preview build | PASS | deployment completed |

---

## On-Chain Facts (verified directly, no transactions sent)

| Fact | Verified value | Method |
|------|---------------|--------|
| Arc Mainnet chain ID | `5042` | `read_contract` on live node |
| Arc Mainnet USDC address | `0x3600000000000000000000000000000000000000` | on-chain |
| USDC symbol | `USDC` | `symbol()` call |
| USDC decimals | `6` | `decimals()` call |
| Arc Mainnet live block | `25,736,817+` | `eth_blockNumber` |
| Treasury EOA `0xb467...Fe47F` | Active, ERC-20 USDC balance present | `balanceOf()` call |

---

## Source Verification (commit f17b3ba)

### `src/lib/chain/verify.ts`
- Per-network viem clients: `clients = { testnet: ..., mainnet: ... }`
- Chain ID binding: `tx.chainId !== profile.chainId` → cross-chain replay rejected
- Sender binding: `tx.from.toLowerCase() !== expectedSender.toLowerCase()` → payment tied to authenticated wallet
- Exact Transfer log: matches `from=sender`, `to=treasury`, `value=expectedAmount`
- Mainnet treasury gate: rejects with `'Treasury is not explicitly configured'` if env var absent, not set, or is the zero address
- Swap verifier (`verifyTokenPayment`) remains testnet-only: hardcoded to `clients.testnet`

### `src/lib/contracts.ts`
- Arc Testnet chain ID: `5042002` ✓
- Arc Mainnet chain ID: `5042` ✓
- Arc Testnet RPC: `https://rpc.testnet.arc.io` ✓
- Arc Mainnet RPC: `https://rpc.mainnet.arc.io` ✓
- USDC address (both networks): `0x3600000000000000000000000000000000000000` ✓
- USDC decimals: `6` ✓
- `tUSDC` and `tARC` on mainnet: `ZERO_ADDRESS` ✓
- Mainnet treasury: `process.env.NEXT_PUBLIC_ARCTIS_MAINNET_TREASURY || MAINNET_TREASURY` where `MAINNET_TREASURY = '0xb467F683764593316fAEbB0709127E90791Fe47F'`
- Mainnet swap/bridge assets: all `ZERO_ADDRESS` ✓

### `src/lib/chain/wagmi.ts`
- `arcTestnet.id`: `5042002` ✓
- `arcMainnet.id`: `5042` ✓
- Both chains have `nativeCurrency.decimals: 18` ✓ (Arc native USDC is 18-decimal for gas)
- Mainnet transport: single `http('https://rpc.mainnet.arc.io')` — never inherits testnet fallbacks ✓
- Both networks registered in `wagmiConfig.chains` ✓

### `src/lib/network/profile.ts`
- `DEFAULT_NETWORK_ENV: NetworkEnv = 'testnet'` — default is testnet ✓
- `getSelectedNetworkEnv()` reads from `window.localStorage.getItem('arctis-network-env')` on client ✓
- Server-side fallback: `process.env.NEXT_PUBLIC_NETWORK_ENV` ✓

### `src/app/membership/page.tsx`
- Calls `getSelectedNetworkEnv()` before initiating payment ✓
- Treasury gate: `if (/^0x0{40}$/i.test(treasury)) { toast.error('Mainnet treasury is not configured; payment is disabled.'); return; }` ✓
- Sends `network: pendingNetworkRef.current` in API request body ✓

### `src/app/api/membership/route.ts`
- Parses and validates `network` field from request body via `parseNetwork()` ✓
- Returns 400 if `network` is absent or invalid ✓
- Calls `verifyUSDCPayment(txHash, plan.priceUSDC, network, walletAddress)` ✓
- No duplicate imports ✓ (PR #16 bug eliminated)

### `src/app/api/credits/route.ts`
- Same network-aware pattern as membership ✓
- Calls `verifyUSDCPayment(txHash, pkg.usdcAmount, network, walletAddress)` ✓

### `src/app/api/swap/execute/route.ts`
- Mainnet swap remains disabled (testnet-only gate preserved) ✓

---

## What Changed vs `main`

| File | Change |
|------|--------|
| `src/lib/chain/verify.ts` | Rewritten: testnet-only → dual-network with chain ID + sender binding |
| `src/app/api/membership/route.ts` | Network-aware + PR #16 build fix (duplicate import) |
| `src/app/api/credits/route.ts` | Network-aware |
| `src/app/membership/page.tsx` | Network-aware + treasury gate |
| `src/app/credits/page.tsx` | Network-aware |
| `src/lib/firebase/activity.ts` | `metadata` typed with `chainId?: number`, `networkName?: string` |
| 13 other UI/component files | PR #16 build fixes (duplicate imports, hardcoded labels) |
| `scripts/mainnet-regression.mjs` | New: 11-group static regression covering all mainnet invariants |

---

## What Remains Disabled (intentional)

| Feature | Gate |
|---------|------|
| Mainnet OTC swap | `swap/execute` returns 400 for non-testnet |
| Mainnet CCTP bridge | No mainnet bridge routes |
| Solidity treasury contract on mainnet | Not deployed — `AGENT_TREASURY: ZERO_ADDRESS` on mainnet |
| Mainnet escrow | Not integrated |

---

## Remaining Blockers Before First Real Mainnet Payment

None in code. Two operational steps only:

### Step 1 — Set Vercel production environment variables

These two values must be added in the Vercel project dashboard under
**Settings → Environment Variables → Production** (not Preview, not Development).

**Do not set these until you have independently confirmed the receiving wallet.**

| Key | Value | Notes |
|-----|-------|-------|
| `NEXT_PUBLIC_NETWORK_ENV` | `mainnet` | Switches the build-time network default to mainnet |
| `NEXT_PUBLIC_ARCTIS_MAINNET_TREASURY` | `0xb467F683764593316fAEbB0709127E90791Fe47F` | The confirmed treasury EOA. Active on Arc Mainnet, ERC-20 USDC balance verified. |

After adding both, redeploy the production branch (Vercel will detect the env change and trigger a new build automatically if auto-deploy is on, or you can click "Redeploy" in the Vercel dashboard).

**Note:** `NEXT_PUBLIC_ARCTIS_MAINNET_TREASURY` is already hardcoded as the fallback constant `MAINNET_TREASURY` in `contracts.ts`. Setting the env var explicitly is belt-and-suspenders and makes future rotation possible without a code change. If you are satisfied with the hardcoded fallback and do not need rotation, you can omit this env var — the code will use the fallback. You still need `NEXT_PUBLIC_NETWORK_ENV=mainnet` to switch the build.

### Step 2 — One controlled acceptance test

1. Open the deployed production app; verify the network selector shows Arc Mainnet (chain 5042)
2. Connect the treasury wallet `0xb467...Fe47F` and confirm the balance display shows USDC
3. From a different wallet, send a small USDC amount to the treasury via Membership or Credits
4. Confirm the receipt at `https://explorer.arc.io/tx/<hash>`
5. Confirm the membership or credit was activated in Firestore

Do not treat the mainnet path as production-ready until step 2 is confirmed.

---

## Rollback

`git revert f17b3ba` — no database migrations, no contract deployments, no schema changes.
The revert restores `main` to its prior state with zero risk to existing Testnet users.
