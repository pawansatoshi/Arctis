# ARCTIS — Architecture Truth

**Status:** Current implementation baseline for the `feat/architecture-truth-consolidation` branch.

This document is the canonical product/architecture reference. Other documents such as README, submission notes and historical reports may describe earlier snapshots. When they conflict with runtime configuration or this document, update them rather than copying their stale values forward.

## 1. Product model

ARCTIS is an AI operating environment on Arc with four connected pillars:

1. **Knowledge OS** — workspace domains, AI sessions, saved prompts, and contextual access to user-owned agent/report knowledge. It is **not yet a full document-ingestion/RAG system** and does not claim a dedicated persistent cross-session memory layer.
2. **AI OS** — 12 user-facing personas over automatic backend model routing.
3. **Stablecoin OS** — user-controlled Transfer, configured ARCTIS OTC Swap, and configured CCTP V2/Forwarding Bridge flows.
4. **Economic Agent OS** — specialized agents with budgets, execution history, reports, evaluator support, and a mandatory human approval gate.

## 2. AI OS

The 12 current personas are:

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

Persona behavior is defined in `src/config/ai.ts`.

Backend model selection is deliberately separate from personas. The router discovers the available free OpenRouter model pool, ranks it by health and fails over automatically. Users do not choose or receive a model entitlement from membership tiers.

## 3. Credits and memberships

The single billing source is `src/config/billing.ts`. `src/lib/memberships/plans.ts` is now a backwards-compatible re-export only.

### Memberships

| Tier | Price | Monthly credits |
|---|---:|---:|
| Free | 0 USDC | 100 |
| Student | 9 USDC | 1,000 |
| Pro | 29 USDC | 5,000 |
| Enterprise | 99 USDC | 25,000 |

### Credit top-ups

| Package | Price | Base | Bonus | Total |
|---|---:|---:|---:|---:|
| Starter | 10 USDC | 100 | 0 | 100 |
| Value | 50 USDC | 600 | 100 | 700 |
| Power | 100 USDC | 1,400 | 400 | 1,800 |
| Pro | 250 USDC | 4,000 | 1,500 | 5,500 |

Text usage is currently **1 credit per 1,000 tokens**. Non-text base costs remain centralized in `OPERATION_COSTS`.

No later concrete credit-package amounts were available in the retained project context, so this branch does not invent replacement prices. If the product's newest approved values differ, change `src/config/billing.ts` once; downstream code should consume that source.

## 4. Asset truth

`src/config/assets.ts` is the application-level asset registry and derives executable Arc addresses/decimals from `src/lib/contracts.ts`.

### Executable configured assets

- **USDC** — Arc Native USDC, primary payment/gas asset.
- **tUSDC** — ARCTIS OTC swap-layer test asset.
- **tARC** — ARCTIS OTC swap-layer test asset; not an official Arc native token.

EURC and cirBTC are kept as Circle-rail integration concepts but are intentionally **not marked executable** in the registry until their active network contract configuration is explicitly verified.

## 5. Knowledge OS truth

Current implemented context sources:

- AI sessions
- saved prompts
- user-owned agents
- recent agent reports

Copilot now receives provenance-style source identifiers and timestamps where available. The context builder is a bounded contextual snapshot, not a semantic document retrieval engine.

Do not describe the current product as having:

- full PDF/document ingestion
- OCR knowledge indexing
- vector database retrieval
- persistent cross-session user memory
- autonomous memory extraction

unless those features are subsequently implemented and this document is updated.

## 6. Stablecoin OS truth

### Transfer
User wallet signs the transaction client-side. AI can parse and propose a transaction, but the AI route never signs or submits it.

### Swap
ARCTIS has an OTC swap layer for configured test assets. It is not safe to describe every Circle-supported asset as an ARCTIS OTC asset.

### Bridge
ARCTIS uses the configured CCTP V2/Forwarding flow for supported routes. Do not claim unsupported source chains or assets.

## 7. Economic Agent OS

The safety boundary is:

`Propose → Review → Approve → Execute`

Agent execution is budgeted and auditable. The agent layer must not be described as silently controlling the user's wallet. Any user financial transaction continues through the existing user-controlled signing path.

## 8. Configuration rules

Use these sources instead of duplicating literals:

- Billing: `src/config/billing.ts`
- AI personas: `src/config/ai.ts`
- Assets: `src/config/assets.ts`
- Network/contracts: `src/lib/contracts.ts`
- AI routing: `src/lib/ai/router/index.ts`
- Copilot product facts: `src/lib/ai/copilot/product-context.ts`

## 9. Architecture principle

**Product concept, runtime configuration, and user-facing documentation must not independently define the same fact.**

If a price, token address, AI persona, chain, or capability changes, update the canonical configuration first and then update derived documentation/UI.
