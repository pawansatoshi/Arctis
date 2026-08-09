# RELEASE_CHECKLIST.md — ARCTIS

Use this checklist before every deployment. Check off each item.

---

## 1. Environment Variables

- [ ] `NEXT_PUBLIC_FIREBASE_API_KEY` — set to real value
- [ ] `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` — set
- [ ] `NEXT_PUBLIC_FIREBASE_PROJECT_ID` — set
- [ ] `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` — set
- [ ] `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` — set
- [ ] `NEXT_PUBLIC_FIREBASE_APP_ID` — set
- [ ] `OPENROUTER_API_KEY` — server-side only, NOT in `NEXT_PUBLIC_*`
- [ ] `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` — set
- [ ] `SWAP_WALLET_PRIVATE_KEY` — server-side only, dedicated wallet generated
- [ ] `NEXT_PUBLIC_SWAP_WALLET_ADDRESS` — matching public address
- [ ] `NODE_ENV=production` — activates fail-fast env validation
- [ ] `NEXT_PUBLIC_APP_URL` — set to real deployment URL
- [ ] No `.env.local` committed to git — verify with `git status`

## 2. Firebase Setup

- [ ] Firebase project created
- [ ] Firestore enabled (Native mode)
- [ ] Firestore indexes deployed: `firebase deploy --only firestore:indexes`
- [ ] Firestore security rules deployed (see `DATABASE.md` for recommended rules)
- [ ] Firebase Storage enabled (if avatar upload is activated)
- [ ] `obs_logs` TTL policy configured (30-day recommended)

## 3. Wallet Funding (Operational)

- [ ] Swap Wallet generated (dedicated EOA, NOT the Treasury Wallet)
- [ ] Swap Wallet funded with testnet USDC
- [ ] Swap Wallet funded with testnet tUSDC
- [ ] Swap Wallet funded with testnet tARC
- [ ] `NEXT_PUBLIC_SWAP_WALLET_ADDRESS` matches the funded wallet
- [ ] Reserve level verified via the quote route (returns 503 if insufficient)

## 4. Build Verification

- [ ] `npm install` completes without errors
- [ ] `npm run build` completes with zero errors
- [ ] `npm run start` serves correctly in production mode
- [ ] No TypeScript errors beyond confirmed environment-only noise
- [ ] No unused `console.log` in production paths

## 5. End-to-End Testing

- [ ] Transfer: send USDC to another wallet, verify ArcScan link + activity record
- [ ] Swap: USDC → tUSDC (or any supported pair), verify dual explorer links
- [ ] Bridge: inbound from Ethereum Sepolia → Arc Testnet, verify attestation completes
- [ ] Credits: purchase credits, verify balance updates + ArcScan link shown
- [ ] Membership: activate a tier, verify membership status updates
- [ ] Agents: create agent → propose task → review → approve → verify report generated
- [ ] Passport: claim `username.arc`, verify public profile at `/p/username`
- [ ] Copilot: send a message, verify credits deducted correctly
- [ ] Feedback: submit feedback, verify Firestore record created

## 6. Security Checks

- [ ] Run: `grep -rn "sk-\|PRIVATE_KEY\s*=\s*0x" src/` — should return nothing
- [ ] `.env.local` is NOT tracked: `git ls-files .env.local` — should return nothing
- [ ] Firestore rules prevent direct client writes to `credit_balances`, `treasury_logs`
- [ ] Rate limiting verified: repeated requests return 429

## 7. Bridge Verification

- [ ] One complete manual bridge from Ethereum Sepolia with real testnet USDC
- [ ] Burn tx visible on Sepolia explorer
- [ ] Attestation completes (Circle Iris returns `status: complete`)
- [ ] Forward tx visible on ArcScan
- [ ] All 5 proof records appear in Firestore

## 8. Mobile Verification

- [ ] Dashboard renders correctly at 375px viewport
- [ ] USDC balance visible above the fold on mobile
- [ ] Action Required cards are thumb-accessible
- [ ] Bridge and Swap flows complete without horizontal scroll
- [ ] Agent Approval Gate review card fully readable on mobile
- [ ] Passport claim flow works on mobile Safari

## 9. Deployment Platform

- [ ] Vercel project configured (or equivalent)
- [ ] All environment variables set in Vercel dashboard
- [ ] Deployment URL confirmed working
- [ ] WalletConnect project ID allows the production domain
- [ ] Custom domain configured (if applicable)

## 10. Documentation

- [ ] `README.md` reflects current implementation
- [ ] `ENCODE_ARC_SUBMISSION.md` complete and accurate
- [ ] No documented features that do not exist in code
- [ ] `SYSTEM_ARCHITECTURE.md` matches actual architecture
- [ ] `.env.example` contains all required variable keys
