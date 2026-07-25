# ARCTIS

> A unified operating system where humans and Economic AI Agents work together, powered by Arc Native USDC.

[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue)](https://typescriptlang.org)
[![Wagmi](https://img.shields.io/badge/Wagmi-v2-orange)](https://wagmi.sh)
[![Arc Testnet](https://img.shields.io/badge/Arc-Testnet%205042002-cyan)](https://arc.network)

---

## What ARCTIS Is

ARCTIS combines four operating systems into one platform:

- **Knowledge OS** — sessions, saved prompts, document context
- **AI OS** — 12 AI modes, dynamic-context Copilot with session/agent-aware personalization, streaming chat, voice input
- **Stablecoin OS** — Transfer, Swap (real OTC engine), Bridge (CCTP V2) — three independent modules, each with a full 5-requirement on-chain proof chain
- **Economic Agent OS** — 7 required agent types + template-based custom agents (Market Intelligence, Shopping Advisor), persistent memory, monthly budgets, an Independent Evaluator Layer, and a mandatory human approval gate (Prepare → Review → Approve → Execute) for every agent action

See `LEPTON_SUBMISSION.md` for the full platform walkthrough and demo script, and `HANDOFF_REPORT.md` for the complete build history across all 19 implementation phases.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 App Router |
| Language | TypeScript (strict) |
| Styling | TailwindCSS |
| Animation | Framer Motion |
| Wallet | RainbowKit + Wagmi v2 + Viem |
| Database | Firebase / Firestore |
| AI | OpenRouter (multi-model routing) |
| Chain | Arc Testnet (Chain ID 5042002) |

---

## Architecture Locks

These are locked and are not to be redesigned:

- Treasury is **observer-only** — it never executes transfers, swaps, or bridges
- Stablecoin OS modules (Transfer, Swap, Bridge) are **independent** — each generates its own proof chain
- Workspace Domains and Membership Tiers are **independent systems** — no coupling
- Agent financial actions **require human approval** — no autonomous spending, ever
- Every Stablecoin OS operation must satisfy all 5 Proof Standard requirements before being considered complete (see below)

---

## The Proof Standard

Every Transfer, Swap, Bridge, Credits purchase, and Membership purchase satisfies:

1. On-chain transaction confirmed
2. Explorer link (ArcScan or source chain) shown to the user
3. Activity record written
4. Transaction ledger record written
5. Treasury accounting record written (or the transaction record itself, for non-revenue operations like Transfer)

---

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local
# Fill in Firebase, OpenRouter, and WalletConnect credentials — see .env.example for the full list

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Full environment setup: see `DEPLOYMENT.md`. Full production checklist: see `DEPLOYMENT_CHECKLIST.md`.

---

## Project Structure

```
src/
├── app/                       # Next.js App Router
│   ├── layout.tsx             # Root layout — env validation runs here at startup
│   ├── dashboard/              # Main dashboard
│   ├── transfer/                # USDC/EURC/tUSDC/tARC transfer, Passport-aware
│   ├── swap/                    # OTC swap engine UI
│   ├── bridge/                  # CCTP V2 bridge UI
│   ├── passport/                # Passport claim/edit
│   ├── p/[username]/            # Public Passport profiles
│   ├── agents/                  # Economic Agent OS — propose/approve/history
│   ├── copilot/                 # AI Copilot with dynamic context
│   ├── credits/                 # Credit purchase
│   ├── membership/               # Membership tiers
│   ├── settings/                # Preferences (language, memos, notifications)
│   └── api/                     # All backend routes
│       ├── agents/               # propose, approve, execute, stream, reports
│       ├── bridge/                # route, quote, execute, status, history
│       ├── swap/                  # route, quote, execute, history
│       ├── passport/              # create, resolve, by-wallet, update
│       ├── credits/, membership/  # purchase + activation, full proof chain
│       └── ai/copilot/            # dynamic-context Copilot endpoint
├── lib/
│   ├── contracts.ts              # SINGLE SOURCE for all addresses, ABIs, RPC config
│   ├── agents/                   # executor, evaluator, memory, service
│   ├── bridge/, swap/, passport/, memo/   # domain services per Stablecoin OS module
│   ├── security/                  # rate limiting, environment validation
│   ├── chain/                     # verification, wagmi config, RPC fallback
│   ├── firebase/                  # Firestore persistence (transactions, activity, sessions)
│   ├── treasury/                  # observer-only accounting
│   └── auth/                      # wallet signature verification (EIP-191)
├── components/
│   ├── agents/AgentProposalCard.tsx   # human review UI for the approval gate
│   └── passport/PassportCard.tsx      # shared identity card
└── types/index.ts                 # global TypeScript types
```

---

## Documentation Index

| Document | Purpose |
|----------|---------|
| `HANDOFF_REPORT.md` | Full build history, phase-by-phase, verified against source |
| `CLAUDE.md` | Architecture reference and current implementation state |
| `LEPTON_SUBMISSION.md` | Platform overview, demo script, what's real vs. roadmap |
| `FINAL_PROJECT_STATUS.md` | Production readiness assessment |
| `DEPLOYMENT.md` | Environment setup, Swap Wallet funding, operational notes |
| `DEPLOYMENT_CHECKLIST.md` | Pre-launch verification checklist |
| `GITHUB_PUSH_GUIDE.md` | Repository hygiene and push checklist |
| `VERCEL_DEPLOYMENT_GUIDE.md` | Vercel-specific deployment steps |
| `SECURITY_NOTES.md` | Known gaps and security posture |

---

## Common Issues

**0 balance displayed**
Verify wallet is on Arc Testnet (Chain ID 5042002) and confirm the token contract address matches `src/lib/contracts.ts`. USDC and tUSDC use 6 decimals; tARC uses 18 — never assume 18 for all tokens.

**Hydration mismatch**
Wallet-dependent components must be dynamically imported with `ssr: false`. The root layout includes `suppressHydrationWarning`.

**Wallet app not opening on mobile (OKX/Bitget/Trust)**
Confirm `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is set and valid — RainbowKit v2 handles deep links automatically once the project ID resolves.

**Vercel build failures**
Confirm all required environment variables are set (`validateEnv()` in `src/lib/security/env.ts` will throw with a clear list of what's missing if `NODE_ENV=production`).

**Swap fails with "insufficient liquidity"**
The Swap Wallet needs real tUSDC/tARC/USDC reserves — this is an operational funding step, not a code issue. See `DEPLOYMENT.md`.

---

## License

MIT — See LICENSE for details.

---

*Built on Arc. Institutional-grade, agent-native, production-ready.*
