# ARCTIS — Mainnet Swap + Bridge Handoff Report
Date: 2026-10-20  
Branch: `feat/mainnet-swap-bridge-v2`  
PR: https://github.com/pawansatoshi/Arctis/pull/35  
Initial main SHA: `20e9c33`  
Final commit SHA: `5b90219`

---

## 1. Initial State

| Item | State |
|------|-------|
| PR #26 (`feat/mainnet-swap-bridge-atomic`) | CONFLICTING on GitHub despite commit `8536d25`; domain bug present |
| PR #34 (`feat/atomic-swap-idempotency`) | Clean; correct `tx.create` pattern |
| Mainnet swap | Disabled screen shown |
| Mainnet bridge | Disabled screen shown |
| CCTP domain for Arc Mainnet | **25 (WRONG — Starknet's domain)** |
| EURC/cirBTC addresses | Not in `contracts.ts` |

---

## 2. Critical Bug Found

**PR #26 `CCTP_BRIDGE_CHAINS_MAINNET` had Arc Mainnet domain = 25.**  
Domain 25 belongs to **Starknet**. Any `depositForBurn` call with `destinationDomain: 25` would attempt to mint USDC on Starknet, not Arc. This is a fund-loss bug.

Correct value: **domain 26**, confirmed from:
- https://developers.circle.com/cctp/concepts/supported-chains-and-domains  
- https://docs.arc.io/integrate/exchanges/cctp-bridging ("`Arc's CCTP domain is 26`")

---

## 3. Files Changed (11 files, +382 / -85)

| File | Change |
|------|--------|
| `src/lib/contracts.ts` | Add EURC + cirBTC addresses for both networks; fix testnet explorer URL; CCTP domain 25→26 |
| `src/lib/swap/circle.ts` | Split `CIRCLE_SWAP_TOKENS` into per-network lists; add `cirBTC` to mainnet; `isCircleSwapPair` accepts `networkEnv` |
| `src/lib/swap/service.ts` | `createSwapRecord` uses `tx.create()` (atomic, duplicate-safe); returns `boolean` |
| `src/app/api/swap/execute/route.ts` | Handle boolean return from `createSwapRecord`; 409 on duplicate |
| `src/app/api/bridge/route.ts` | Network-aware chain selection; mainnet uses `'Arc'` App Kit identifier |
| `src/app/api/bridge/quote/route.ts` | Network-aware quote; include `network` field in response |
| `src/app/swap/page.tsx` | Remove mainnet disabled screen; add cirBTC; network-scoped history key; `isCircleSwapPair` passes `networkEnv`; fee disclosure fix |
| `src/app/bridge/page.tsx` | Remove mainnet disabled screen; mainnet disclaimer banner; correct chain cast |
| `scripts/swap-bridge-regression.mjs` | New: 30 assertions covering all changes |
| `scripts/network-isolation-regression.mjs` | Updated: mainnet bridge assertion updated for disclaimer (not disabled screen) |
| `package.json` | Add `swap-bridge-regression` script |

---

## 4. Verified Token Addresses

All addresses sourced from `docs.arc.io/arc/references/contract-addresses` on 2026-10-20.

| Token | Network | Address | Decimals |
|-------|---------|---------|----------|
| USDC | Both | `0x3600000000000000000000000000000000000000` | 6 (ERC-20 interface) |
| EURC | Mainnet | `0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1` | 6 |
| EURC | Testnet | `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a` | 6 |
| cirBTC | Mainnet | `0x171A4217b86A807A64eB94757Db6849fb4bDbAA0` | 8 |
| cirBTC | Testnet | `0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF` | 8 |

CCTP Domain for Arc: **26** (not 25).  
App Kit chain identifier: `"Arc"` (mainnet), `"Arc_Testnet"` (testnet).

---

## 5. Test Results

| Check | Result |
|-------|--------|
| `tsc --noEmit` | exit 0 |
| `swap-bridge-regression` (30 assertions) | **30/30 PASS** |
| `network-isolation-regression` | PASS |
| `mainnet-regression` | PASS |
| `transaction-regression` (npm test) | PASS |
| Vercel CI | Pending (see PR #35) |

---

## 6. Conflict Resolution

PR #26 and PR #34 were NOT merged directly. The conflict (package.json + diverged `service.ts`) was resolved by:
1. Creating a clean branch `feat/mainnet-swap-bridge-v2` from `main` at `20e9c33`
2. Porting PR #26 changes selectively (swap page, bridge page, bridge APIs, contracts)
3. Applying PR #34's `tx.create` pattern to `service.ts` (supersedes PR #26's `tx.set`)
4. Correcting the CCTP domain bug (25 → 26)
5. Adding EURC/cirBTC to both network profiles (not in either PR)

PR #26 and PR #34 should be closed in favour of PR #35.

---

## 7. PR #35 Acceptance Checklist

### Testnet
- [x] Testnet remains default when `NEXT_PUBLIC_NETWORK_ENV` is unset
- [x] Testnet USDC/tUSDC/tARC/EURC/cirBTC addresses in `contracts.ts`
- [x] Testnet swap (Circle + OTC) and bridge flows unchanged
- [x] Testnet history isolated (network-scoped localStorage + API filter)

### Mainnet Swap
- [x] `availableTokens` for mainnet: USDC, EURC, cirBTC
- [x] Circle App Kit used exclusively on mainnet (no OTC)
- [x] Token addresses and decimals verified from official docs
- [x] Fee disclosure: "Included in quoted rate" when Circle fee = 0
- [x] Duplicate execution prevented via `tx.create` + execution lock
- [x] History scoped per network in localStorage and Firestore
- [ ] **BLOCKED**: End-to-end transaction evidence requires funded mainnet wallet + `NEXT_PUBLIC_NETWORK_ENV=mainnet` in Vercel

### Mainnet Bridge
- [x] CCTP domain corrected to 26
- [x] Arc App Kit chain identifier `"Arc"` for mainnet
- [x] Mainnet disclaimer banner displayed
- [x] Disabled screen removed
- [ ] **BLOCKED**: Attestation/completion flow requires live CCTP V2 transaction

### Security
- [x] OTC swap execution gated testnet-only at server level
- [x] Atomic record creation prevents duplicate swap processing
- [x] Chain ID verified before every transaction
- [x] No secrets or private keys exposed
- [x] Network isolation maintained across all history surfaces

---

## 8. External Blockers Before Production

| Blocker | Owner | Action |
|---------|-------|--------|
| Set `NEXT_PUBLIC_NETWORK_ENV=mainnet` in Vercel | You | Vercel dashboard → Project Settings → Environment Variables |
| Set `NEXT_PUBLIC_ARCTIS_MAINNET_TREASURY=0xb467F683764593316fAEbB0709127E90791Fe47F` | You | Same location |
| Merge PR #33 (network isolation fixes) | You | Approve + merge first; #35 depends on its changes |
| Merge PR #35 (this PR) | You | Approve after CI passes |
| Close PR #26 and PR #34 | You | Superseded by #35 |
| End-to-end mainnet swap/bridge transaction evidence | You | Requires funded wallet on Arc Mainnet (chain ID 5042) |
| Android Brave device test | You | Physical device required; code fix is in PR #33 |
| Deploy escrow contract (`ARCTISAgentEscrow.sol`) | You | Approve deployment command; provides wallet signature |
| Firestore TTL on `used_nonces.expireAt` | You | Operational: create index in Firebase console |
| Revoke exposed GitHub PAT | You | https://github.com/settings/personal-access-tokens |

---

## 9. Merge Order

```
PR #33  →  merge first (network isolation, Brave fix)
PR #35  →  merge second (mainnet swap + bridge)
Vercel  →  set env vars, redeploy production
PR #26  →  close (superseded)
PR #34  →  close (superseded)
```

---

## 10. Final Classification

**READY WITH EXPLICIT EXTERNAL BLOCKERS**

All code, tests, and configuration are complete. The remaining blockers are:
1. Your approval to merge PR #33 and PR #35
2. Setting two Vercel environment variables
3. End-to-end mainnet transaction evidence (requires your funded wallet)
4. Escrow contract deployment (requires your wallet signature)

No work was fabricated. Every test result above is from actual script execution in this session. Real mainnet transaction receipts cannot be obtained without a funded mainnet wallet performing the swap or bridge from a browser.
