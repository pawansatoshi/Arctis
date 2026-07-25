# DEPLOYMENT_CHECKLIST.md — ARCTIS

Complete every item before considering a deployment production-ready. Check off as you go.

## 1. Environment Variables

- [ ] `NEXT_PUBLIC_FIREBASE_API_KEY` set (real value, not placeholder)
- [ ] `NEXT_PUBLIC_FIREBASE_PROJECT_ID` set
- [ ] `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` set
- [ ] `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` set
- [ ] `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` set
- [ ] `NEXT_PUBLIC_FIREBASE_APP_ID` set
- [ ] `OPENROUTER_API_KEY` set (server-side only — confirm it is NOT prefixed `NEXT_PUBLIC_`)
- [ ] `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` set
- [ ] `SWAP_WALLET_PRIVATE_KEY` set (server-side only, generate a dedicated wallet — never reuse the Treasury Wallet key)
- [ ] `NEXT_PUBLIC_SWAP_WALLET_ADDRESS` set (public address matching the above key)
- [ ] `NODE_ENV=production` set (activates fail-fast environment validation in `src/lib/security/env.ts`)
- [ ] Confirm no `.env.local` file is committed to git (`.gitignore` already excludes it — verify)

## 2. Firebase / Firestore

- [ ] Firestore project created and connected
- [ ] Run `firebase deploy --only firestore:indexes` — deploys the composite indexes in `firestore.indexes.json` (bridge_pending, swap_records, agent_executions)
- [ ] Firestore security rules reviewed and deployed (see `SECURITY_NOTES.md` for the recommended rule set)
- [ ] Confirm the following collections will be created on first write (no manual setup needed, but verify quota/billing is configured): `transactions`, `activity`, `treasury_logs`, `bridge_pending`, `swap_records`, `passports`, `agent_executions`, `agents`, `agent_reports`, `ai_sessions`, `saved_prompts`, `rate_limits`

## 3. Swap Wallet Funding (Operational — Required Before Swap Works)

- [ ] Generate a dedicated Swap Wallet (never reuse the Treasury Wallet)
- [ ] Fund with testnet USDC
- [ ] Fund with testnet tUSDC
- [ ] Fund with testnet tARC
- [ ] Verify balance via `getSwapWalletReserve()` before going live — the quote route will return 503 with exact shortfall if reserves are insufficient, but confirm this manually once before launch

## 4. Bridge Verification

- [ ] Perform one full manual bridge test: real wallet, real Sepolia testnet USDC, full Ethereum Sepolia → Arc Testnet flow
- [ ] Confirm the burn transaction, attestation, and forward transaction all complete and are visible on both explorers
- [ ] Confirm all 5 proof records are written to Firestore after a real bridge completes

## 5. Smart Contract Deployment (If Applicable — Optional for MVP Launch)

- [ ] Reference Registry deployed to Arc Testnet, verified on ArcScan
- [ ] Agent Registry deployed (after Reference Registry), verified on ArcScan
- [ ] Passport Registry deployed (after Agent Registry, and after off-chain Passport is stable — it is), verified on ArcScan
- [ ] Security review completed for each contract before deployment

## 6. Security Hardening

- [ ] Confirm `verifyApiWallet(strict=true)` is applied to every mutating route that should require it before mainnet (currently: Passport only — see `FINAL_PROJECT_STATUS.md` for the full list of routes still in graceful-degradation mode)
- [ ] Confirm rate limiting is active on all financial and AI routes (verify by checking `src/lib/security/rateLimit.ts` usage)
- [ ] Confirm no secrets appear in any committed file — run `git log -p | grep -i "private_key\|api_key\|secret"` before the first push as a sanity check
- [ ] Confirm Firestore rules deny direct client writes to `credit_balances`, `treasury_logs`, and other server-only collections

## 7. Mobile Compatibility

- [ ] Test wallet connection flow on iOS Safari and Android Chrome
- [ ] Test WalletConnect deep-linking with at least one mobile wallet app (MetaMask Mobile, Trust Wallet, or similar)
- [ ] Confirm no horizontal scroll or fixed-width overflow on any page at 375px viewport width

## 8. Build & Deployment

- [ ] `npm run build` completes with zero errors
- [ ] `npm run start` boots and serves correctly in production mode locally before deploying
- [ ] Confirm `next.config.js` webpack fallbacks for `fs`/`net`/`tls` are present (required for wallet libraries on Vercel)
- [ ] Deploy to Vercel (see `VERCEL_DEPLOYMENT_GUIDE.md`)
- [ ] Confirm the deployed URL loads the landing page, wallet connect works, and at least one full operation (Transfer) completes end-to-end on the live deployment

## 9. Post-Launch Monitoring

- [ ] Confirm `obs` logger entries are appearing in Firestore's `obs_logs` collection
- [ ] Set a reminder to review rate limit hit rates after the first week — adjust `RATE_LIMITS` tiers in `src/lib/security/rateLimit.ts` if legitimate users are being throttled
- [ ] Set a reminder to review the Swap Wallet reserve levels periodically and top up as needed

---

Do not consider the deployment complete until every box above is checked. Operational items (Swap Wallet funding, Firestore index deployment, live Bridge test) cannot be verified from a development sandbox — they require an actual deployed environment with real network access.
