# ARCTIS — Architecture Truth

**Status:** current implementation baseline on `main`.

This is the canonical product/capability reference. If another document, UI label or historical report conflicts with this file or with runtime configuration, the code/configuration wins and the documentation should be corrected.

## 1. Product model

ARCTIS is an AI operating environment built on Arc Testnet. It combines four product pillars:

1. **AI OS** — AI Workspace, Copilot and task-oriented personas with automatic backend model routing.
2. **Knowledge OS** — workspaces, saved prompts, sessions, agents and report context.
3. **DeFi OS** — user-controlled transfers, configured ARCTIS OTC swaps and configured cross-chain USDC bridge flows.
4. **Economic Agent OS** — budgeted agents, proposals, approval, execution history, reports and independent evaluation.

Finance surfaces such as Membership, Credits and Treasury support these pillars. They are product surfaces, not additional operating-system pillars.

The primary dashboard navigation currently groups **Agents under AI OS** and money movement under **DeFi OS**. This is an information-architecture choice; it does not remove the Economic Agent OS or its safety boundary.

## 2. AI OS truth

### Current personas

The current persona registry contains 12 modes:

- Study
- Build
- Analyze
- Research
- Generate
- Treasury
- Developer
- Student
- Teacher
- Professor
- Child
- Engineering

Source of truth: `src/config/ai.ts`.

### Model routing

Users do not select a backend model. The server-side router discovers the configured free-model pool, ranks candidates using health/latency state, and fails over when appropriate. Model/provider identity is intentionally an implementation detail.

Source: `src/lib/ai/router/`, `src/lib/ai/registry/` and `src/lib/ai/providers/`.

Current limitation: health state and model-registry cache are process-local. They reset on restart and are not shared between multiple server instances.

### Financial intent

Transfer/Swap/Bridge natural-language intent is parsed deterministically. A recognized request creates a proposal/prefill path; it does not sign, submit or execute a transaction. The user completes the existing wallet flow.

Source: `src/lib/ai/intent/` and the AI route handlers.

## 3. Knowledge OS truth

Implemented context sources include:

- AI sessions
- saved prompts
- user-owned agents
- recent agent reports / bounded contextual data

This is **not yet** a full document-ingestion or semantic-retrieval system.

Do not describe current ARCTIS as having full PDF/OCR ingestion, vector database RAG, autonomous memory extraction or a dedicated persistent cross-session memory layer unless those capabilities are actually implemented and this file is updated.

## 4. DeFi OS truth

### Transfer

The user's wallet signs the onchain transaction. Server routes verify/record the operation where required; they do not hold the user's signing authority.

### Swap

ARCTIS contains a configured OTC swap layer for the executable assets in `src/config/assets.ts`. The current implementation is a counterparty settlement model, not an AMM or DEX pool.

### Bridge

The bridge UI integrates Circle App Kit with the Viem adapter. The repository contains configured testnet source/destination metadata for Arc Testnet, Ethereum Sepolia, Base Sepolia and Arbitrum Sepolia, subject to the routes returned/enabled by the current bridge policy/API.

The bridge flow performs source-chain balance/gas preflight checks and uses the Circle App Kit lifecycle for execution/result handling. Do not describe unsupported chains, assets or mainnet availability.

Source: `src/app/bridge/page.tsx`, `src/lib/contracts.ts`, `src/lib/bridge/` and `src/app/api/bridge/`.

## 5. Economic Agent OS truth

The mandatory safety boundary is:

`Propose → Review → Approve → Execute`

Agents have configuration, budgets, execution history, reports and evaluator support. The approval boundary is enforced in the agent service/executor layer rather than being a visual-only UI convention.

Agents do not receive a hidden user private key and do not silently sign the user's Transfer/Swap/Bridge wallet transactions.

Current agent templates include the seven core agent types plus template-based custom agents such as Market Intelligence and Shopping Advisor.

## 6. Membership and credits truth

Canonical billing source: `src/config/billing.ts`.

### Memberships

| Tier | Price | Monthly credits |
|---|---:|---:|
| Free | 0 USDC | 100 |
| Student | 9 USDC | 1,000 |
| Pro | 29 USDC | 5,000 |
| Enterprise | 99 USDC | 25,000 |

### Top-ups

| Package | Price | Base | Bonus | Total |
|---|---:|---:|---:|---:|
| Starter | 10 USDC | 100 | 0 | 100 |
| Value | 50 USDC | 600 | 100 | 700 |
| Power | 100 USDC | 1,400 | 400 | 1,800 |
| Pro | 250 USDC | 4,000 | 1,500 | 5,500 |

Text generation currently costs **1 credit per 1,000 tokens**. Other operation costs are centralized in `OPERATION_COSTS`.

Membership status and credit entitlements are separate persisted concepts and are surfaced in the product UI.

## 7. Asset truth

Canonical application registry: `src/config/assets.ts`.

| Asset | Role | Executable |
|---|---|---|
| USDC | Arc Native USDC; primary payment/gas asset | Yes |
| tUSDC | ARCTIS OTC test asset | Yes |
| tARC | ARCTIS OTC test asset; not an official Arc native token | Yes |
| EURC | Circle-rail integration concept pending explicit configuration | No |

Only assets with an explicit active contract/route configuration should be exposed as executable. Do not document or expose unsupported assets such as cirBTC.

Network/contract truth lives in `src/lib/contracts.ts`.

## 8. Data architecture

The browser does not directly operate on sensitive Firestore collections. Server-side API routes use Firebase Admin SDK for persistence.

Primary collections include:

- `transactions`
- `activity`
- `treasury_logs`
- `bridge_pending`
- `swap_records`
- `passports`
- `agents`
- `agent_executions`
- `agent_reports`
- `agent_ledger`
- `credit_balances`
- `credit_ledger`
- `memberships`
- `ai_sessions`
- `saved_prompts`
- `obs_logs`
- `rate_limits`

See `DATABASE.md` for the current data reference.

## 9. Activity and History truth

`/api/activity` is the shared aggregation source for user-facing activity data. The current product treats **History** as the canonical historical surface; the Activity page is not part of the primary navigation architecture.

Do not reintroduce separate, competing transaction/history data stores without an explicit architecture decision.

## 10. Navigation truth

Primary navigation:

```text
Overview
  Dashboard
  History

AI OS
  Copilot
  Agents

DeFi OS
  Transfer
  Swap
  Bridge

Knowledge OS
  Workspace
  Knowledge

Finance
  Treasury
  Membership
  Credits

Platform
  Settings
  Feedback
```

Command Palette and other secondary navigation should follow the same terminology.

## 11. Internationalization truth

The product has a single locale selector with these supported languages:

English, Hindi, Spanish, Portuguese, Chinese, Korean, Vietnamese, French, Swahili and Arabic.

Arabic includes RTL handling. Locale selection is persisted client-side.

Source: `src/lib/i18n/` and the settings/language UI.

## 12. Security boundary

The intended money-control boundary is:

```text
User intent
   ↓
Validation / policy
   ↓
Server coordination + verification
   ↓
User wallet / Circle App Kit signing flow
   ↓
Onchain settlement
   ↓
Persistence / explorer / history
```

No server-side ARCTIS component should be described as possessing the user's wallet signing authority.

Important testnet limitation: not every mutating API route currently has the same cryptographic wallet-proof level. See `SECURITY.md` for the current route-level posture and remaining hardening work.

## 13. Configuration sources of truth

Never duplicate these facts in documentation or UI when they can be derived:

- AI personas → `src/config/ai.ts`
- Billing → `src/config/billing.ts`
- Assets → `src/config/assets.ts`
- Network/contracts → `src/lib/contracts.ts`
- Bridge policy → `src/lib/bridge/policy.ts`
- AI routing → `src/lib/ai/router/`

## 14. Product claims policy

ARCTIS should use precise language:

- **Built on Arc** — yes.
- **Arc Testnet** — yes when referring to the configured network.
- **Official Arc/Circle partner** — do not claim unless formally approved.
- **Production-ready/mainnet** — do not claim while the product remains testnet-stage.
- **Autonomous wallet control** — do not claim.
- **Official tARC token** — do not claim.

The Arc brand guidance states that the builder's brand should lead and Arc should be described as infrastructure. Keep ARCTIS visually and verbally distinct.
