# ARCTIS — System Architecture

## Overview

ARCTIS is a Next.js 14 App Router application combining four operating systems:

```
┌──────────────────────────────────────────────────────┐
│                    ARCTIS Frontend                    │
│         Next.js 14 · RainbowKit · Wagmi v2           │
└─────────────────────┬────────────────────────────────┘
                      │
       ┌──────────────┼──────────────┐
       ▼              ▼              ▼
┌────────────┐ ┌────────────┐ ┌──────────────┐
│ AI OS      │ │Stablecoin  │ │ Economic     │
│            │ │OS          │ │ Agent OS     │
│ 12 modes   │ │            │ │              │
│ Copilot    │ │ Transfer   │ │ 7 types      │
│ Voice      │ │ Swap (OTC) │ │ Approval     │
│ Image      │ │ Bridge     │ │ Gate         │
│            │ │ (CCTP V2)  │ │ Evaluator    │
└─────┬──────┘ └─────┬──────┘ └──────┬───────┘
      │               │               │
      └───────────────┼───────────────┘
                      ▼
            ┌─────────────────┐
            │ Knowledge OS    │
            │ Sessions/Prompts│
            │ Workspaces      │
            └────────┬────────┘
                     │
          ┌──────────┼──────────┐
          ▼          ▼          ▼
    ┌──────────┐ ┌────────┐ ┌──────────┐
    │ Firebase │ │OpenRtr │ │ Arc      │
    │Firestore │ │  (AI)  │ │Testnet   │
    └──────────┘ └────────┘ └──────────┘
```

## Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js App Router | 14.2.5 |
| Language | TypeScript strict | 5.5.4 |
| Styling | TailwindCSS | 3.4.7 |
| Animation | Framer Motion | 11.x |
| Wallet | Wagmi v2 + Viem | 2.12 / 2.17 |
| Wallet UI | RainbowKit | 2.1.3 |
| State | Zustand | 4.5.4 |
| Database | Firebase Firestore | 10.12.4 |
| Charts | Recharts | 2.12.7 |
| AI | OpenRouter | API |
| Chain | Arc Testnet | ID 5042002 |

## Key Architectural Decisions

### 1. Treasury is Observer-Only

`src/lib/treasury/service.ts` imports only `firebase/firestore` and `@/types`. It never imports viem, wagmi, or any execution logic. `logTreasuryEvent()` is always called **after** a primary on-chain operation succeeds, never before, and never as a gate on whether the operation proceeds.

### 2. Five-Requirement Proof Standard

Every Stablecoin OS operation must satisfy all five before being considered complete:
1. On-chain transaction confirmed
2. Explorer link shown to user (ArcScan or source chain)
3. Activity record written (`writeActivity`)
4. Transaction ledger record written (`saveTransaction`)
5. Treasury accounting record written (`logTreasuryEvent`) — or the transaction record itself for non-revenue operations

### 3. Agent Approval Gate

The gate is enforced in `src/lib/agents/executor.ts`, not just the UI. Three exported functions:
- `proposeAgent()` — runs preflights, creates a `proposed` record, makes zero AI calls
- `approveProposal()` — re-verifies ownership against stored record, then calls `executeAgent()`
- `rejectProposal()` — marks rejected, zero credits consumed, zero AI calls, immutable audit record

### 4. Independent Evaluator Layer

`src/lib/agents/evaluator.ts` makes a structurally separate inference call with:
- No access to the generator's system prompt
- No access to the generator's memory context
- An adversarial review prompt, not a helpful one
- Domain-specific quality criteria per agent type

On FAIL: one bounded revision attempt (non-streaming path only). All verdicts stored in `AgentExecution.evaluationVerdict`.

### 5. OTC Swap Settlement

The Swap engine uses a dedicated Swap Wallet EOA (separate from Treasury) as the actual on-chain counterparty. Both legs are real ERC-20 transfers on Arc Testnet. No AMM, no simulated liquidity. Reserve checks occur at quote time.

### 6. Bridge via Circle CCTP V2 Forwarding Service

Attestation polling via Circle Iris API. The `forwardTxHash` returned by Iris (the minting tx on Arc) is trusted as Circle-signed. No independent re-verification of the attestation itself — this is the intentional Forwarding Service design. `firestore.indexes.json` includes a composite index for `bridge_pending` queries.

### 7. Firestore — Admin SDK Only, Client Access Fully Denied

Every Firestore read/write in the app goes through `src/lib/firebase/admin.ts` (Firebase Admin SDK, server-only, `import 'server-only'` enforced) from Next.js API routes. **No component or client-side code touches Firestore directly** — the two cases that historically did (AI session persistence, saved prompts) were moved behind `/api/sessions` and `/api/prompts`. `firestore.rules` denies all reads/writes by default (`allow read, write: if false`) except a public, read-only `passports/{username}` lookup. Trust is established once, at the API layer, via wallet-signature verification — not re-derived per-collection through security rules matched against a Firebase Auth session that the app never creates (wallet connection is not Firebase Auth).

### 8. AI Routing — Dynamic Registry + Health-Based Selection, Never Client-Chosen

`src/lib/ai/router/index.ts` no longer accepts a model ID from client input. `src/lib/ai/registry/openrouterModels.ts` discovers free, chat-capable OpenRouter models live (cached, refreshed periodically, falls back to the last-known-good list if OpenRouter is unreachable). `src/lib/ai/registry/health.ts` tracks per-model latency/failures/rate-limit cooldowns in-memory and ranks candidates. Both `routeAIRequest` (non-streaming) and `routeAIStream` (streaming) walk the ranked list and fail over automatically; a stream only fails over if nothing has been shown to the user yet, to avoid mixing partial output from two different models. Model identity is never returned to the client, rendered in any UI, or embedded in user-visible ledger/history text — the product surface is simply "ARCTIS AI."

## Firestore Collections

All collections below are written and read exclusively via the Firebase Admin SDK from server-side API routes (see Decision #7). `firestore.rules` denies direct client access to all of them.

| Collection | Purpose | Writer |
|-----------|---------|--------|
| `transactions` | All on-chain tx records | `saveTransaction()` |
| `activity` | Cross-pillar activity feed | `writeActivity()` |
| `treasury_logs` | Revenue/accounting observer | `logTreasuryEvent()` |
| `bridge_pending` | Bridge in-flight state + history | Bridge API routes |
| `swap_records` | Swap history + idempotency | Swap execute route |
| `passports` | `username → wallet` mapping | Passport API routes |
| `agent_executions` | Full execution lifecycle | Agent executor |
| `agents` | Agent configuration | Agent service |
| `agent_reports` | Generated reports | Agent executor |
| `agent_ledger` | Per-agent credit ledger | Agent service |
| `ai_sessions` | Chat session persistence | `/api/sessions` |
| `saved_prompts` | User prompt library | `/api/prompts` |
| `credit_balances` | Running credit total per wallet | Credits engine |
| `credit_ledger` | Per-transaction credit history | Credits engine |
| `memberships` | Tier, status, renewal date | Membership service |
| `obs_logs` | Observability / error logging | `obs` logger |
| `rate_limits` | Sliding-window rate limit counters | `checkRateLimit()` |

## API Routes

All API routes are Next.js Route Handlers (App Router `route.ts` files).

**Stablecoin OS:**
- `POST /api/credits` — verify payment, grant credits, proof chain
- `POST /api/membership` — verify payment, activate tier, proof chain
- `GET|POST /api/swap` — OTC route availability
- `GET /api/swap/quote` — fee quote with reserve check
- `POST /api/swap/execute` — verify inbound, dispatch outbound, proof chain
- `GET /api/bridge` — CCTP route data
- `GET /api/bridge/quote` — fee quote from Iris API
- `POST /api/bridge/execute` — initiate bridge, async attestation polling
- `GET /api/bridge/status` — client polling endpoint
- `GET /api/bridge/history` — wallet bridge history

**Identity:**
- `POST /api/passport/create` — strict auth, one-per-wallet
- `GET /api/passport/resolve` — public username → wallet
- `GET /api/passport/by-wallet` — wallet → passport check
- `PATCH /api/passport/update` — strict auth, ownership verified

**Agent OS:**
- `POST /api/agents/propose` — Phase 1: preflights, no AI call
- `POST /api/agents/approve` — Phase 3: approve or reject
- `GET /api/agents/proposals` — pending proposals for wallet
- `POST /api/agents/execute` — direct execution (internal)
- `POST /api/agents/stream` — SSE streaming execution
- `GET /api/agents/executions` — execution history
- `GET /api/agents/reports` — agent reports

**AI OS:**
- `POST /api/ai/chat` — multi-mode AI Workspace; automatic model selection (never client-chosen); detects Transfer/Swap/Bridge intent and returns a confirmation plan instead of an AI reply when matched (no credits charged, no model call)
- `POST /api/ai/copilot` — dynamic-context Copilot; always free, always automatic routing
- `GET|POST|DELETE /api/sessions` — AI chat session persistence (Admin SDK proxy for what used to be direct client Firestore access)
- `GET|POST|DELETE /api/prompts` — saved-prompt persistence (same reasoning)

**Platform:**
- `GET /api/activity` — unified aggregation feed (transfers, swaps, bridge, credits, AI sessions, agent executions) powering both the Activity Center and History page

## Security Model

```
Client Request
     │
     ├─ Format validation (cheap, first)
     ├─ Rate limiting (Firestore counter, second)
     ├─ Wallet signature verification (strict mode, third)
     ├─ On-chain payment verification (most expensive, last)
     └─ Business logic
```

**Routes with strict EIP-191 verification:** Credits, Membership, Swap execute, Bridge execute, Passport create, Passport update (6 total).

**Routes with ownership-only verification (no cryptographic proof):** Agent propose, Agent approve (wallet checked against stored record, not cryptographically signed).

**Routes without auth (public):** Passport resolve, Bridge route list, Swap route list.
