# ARCTIS — System Architecture

This document describes the implementation architecture on `main`. For product capability truth, see [`ARCHITECTURE_TRUTH.md`](./ARCHITECTURE_TRUTH.md).

## 1. Runtime overview

```text
┌─────────────────────────────────────────────────────────────┐
│                       ARCTIS Web App                         │
│             Next.js 14 · React · Tailwind · Motion          │
└────────────────────────────┬────────────────────────────────┘
                             │
                    Next.js Route Handlers
                             │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
┌───────────────┐   ┌────────────────┐   ┌──────────────────┐
│ Firebase      │   │ AI Router      │   │ Chain / Money    │
│ Admin SDK     │   │ registry       │   │ orchestration    │
│               │   │ health/failover│   │ policy + verify  │
└───────┬───────┘   └───────┬────────┘   └────────┬─────────┘
        │                   │                     │
        ▼                   ▼                     ▼
   Firestore          AI provider API      User wallet / App Kit
                                              │
                                              ▼
                                      Arc + configured CCTP rails
```

### Core boundary

- Browser UI requests work and displays state.
- Server routes validate, coordinate and persist.
- Firebase Admin SDK remains server-side persistence infrastructure.
- AI model selection remains server-side.
- User-controlled money movement ends at the wallet/App Kit signing boundary.

## 2. Product pillars

### AI OS

- `/ai` — AI Workspace.
- `/copilot` — contextual Copilot.
- `/agents` — Economic Agent surface.
- 12 persona definitions in `src/config/ai.ts`.
- Automatic backend model routing in `src/lib/ai/router/`.

### Knowledge OS

- `/workspace`
- `/knowledge`
- `/api/sessions`
- `/api/prompts`

Current knowledge context is application-data based, not a full document-RAG stack.

### DeFi OS

- `/transfer`
- `/swap`
- `/bridge`
- `/api/transfer`
- `/api/swap`
- `/api/bridge`

Transfer is user-signed. Swap combines ARCTIS OTC settlement with the configured Circle Swap surface. Bridge uses Circle App Kit and CCTP route/policy configuration.

### Economic Agent OS

The runtime state machine is:

```text
Intent
  ↓
Proposal
  ↓
Recipient / route validation
  ↓
Live quote + preflight
  ↓
Expected receive
  ↓
Human review
  ↓
Wallet approval
  ↓
Execute
  ↓
Persist execution / report / ledger
```

The quote/approval gate is important: an agent proposal does not itself authorize a wallet transaction.

## 3. AI routing

```text
request
  ↓
validate persona/messages
  ↓
discover/cache free chat-capable models
  ↓
rank by health + latency + cooldown
  ↓
call provider adapter
  ↓
stream or return response
  ↓
fail over when safe
```

Financial intent is handled separately:

```text
user message
  ↓
deterministic intent parser
  ↓
action proposal
  ↓
route / recipient validation
  ↓
existing Transfer / Swap / Bridge page
  ↓
quote + preflight
  ↓
wallet/App Kit signing
```

An LLM is not trusted to invent a financial amount, token pair, destination address or execution transaction.

### Current routing limitation

Health state and the model registry cache are process-local. Multi-instance shared routing state is a future hardening step.

## 4. Money movement

### Transfer

```text
UI → recipient validation → preflight → wallet write → onchain confirmation → record
```

Passport `.arc` recipients and direct wallet addresses are normalized through the shared recipient-validation path.

### OTC Swap

```text
live quote → reserve/route check → human review
      → wallet inbound transfer → server verifies inbound
      → Swap Wallet counterparty transfer → record both legs
```

The Swap Wallet is a separate counterparty wallet. This is not an AMM.

### Circle Swap surface

```text
pair selection
    ↓
live Circle quote
    ↓
estimated receive displayed
    ↓
route available?
  ├─ no → explicit route-unavailable state; no wallet tx
  └─ yes → human review → wallet/App Kit execution
```

EURC is exposed as the last Circle asset in the ARCTIS dropdown. `cirBTC` is intentionally not exposed in the current product UI.

### Bridge

```text
source-chain selection
      ↓
source balance + native gas preflight
      ↓
Circle App Kit estimateBridge
      ↓
provider + forwarding + gas fees
      ↓
estimated receive
      ↓
human review
      ↓
Circle App Kit bridge
      ↓
result extraction + history persistence
```

Configured testnet metadata currently covers Arc Testnet, Ethereum Sepolia, Base Sepolia and Arbitrum Sepolia. Availability remains constrained by bridge policy and current route configuration.

## 5. Proof model

Where an operation requires the full proof standard, completion uses the relevant combination of:

1. Confirmed onchain transaction.
2. Explorer transaction reference.
3. Activity record.
4. Transaction/operation ledger record.
5. Treasury/accounting record when applicable.

The exact persistence path differs by operation.

## 6. Passport identity

Passport is a wallet-linked profile and `.arc` resolution layer.

Current owner flow includes:

- create/update profile;
- optional profile photo during creation;
- later photo add/change/remove;
- public username resolution;
- owner return navigation to ARCTIS Home.

The same canonical Passport recipient resolver is used by Manual Transfer and Economic Agent recipient validation.

## 7. Persistence

Firestore access is server-mediated through Firebase Admin SDK.

Core collections:

```text
transactions
activity
treasury_logs
bridge_pending
swap_records
passports
agents
agent_executions
agent_reports
agent_ledger
credit_balances
credit_ledger
memberships
ai_sessions
saved_prompts
obs_logs
rate_limits
```

See [`DATABASE.md`](./DATABASE.md) for schema/index details.

## 8. Security pipeline

Mutating server routes should follow the cheapest-to-most-expensive validation order where applicable:

```text
request shape
   ↓
rate limit
   ↓
authentication / wallet proof
   ↓
onchain verification
   ↓
business logic
   ↓
persistence
```

The repository has stronger cryptographic wallet verification on some routes than others. This is documented rather than hidden.

See [`SECURITY.md`](./SECURITY.md).

## 9. Central configuration

| Concern | Source |
|---|---|
| AI personas | `src/config/ai.ts` |
| Billing | `src/config/billing.ts` |
| Assets | `src/config/assets.ts` |
| Network/contracts | `src/lib/contracts.ts` |
| Circle Swap pair logic | `src/lib/swap/circle.ts` |
| Bridge policy | `src/lib/bridge/policy.ts` |
| AI routing | `src/lib/ai/router/` |
| Product context | `src/lib/ai/copilot/product-context.ts` |

Avoid copying these values into pages or documentation.

## 10. UI architecture

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

The command palette mirrors these names. Activity remains an internal aggregation/API concept rather than a primary navigation pillar.

## 11. Animation and interaction

Framer Motion is used for product transitions and interaction feedback. Animation is state/hierarchy-oriented rather than decorative.

`docs/architecture-flow.svg` is a dependency-free SVG/CSS animation. Animated dashed paths communicate control/data flow; pulsing nodes communicate active hand-offs; the layered layout maps directly to the runtime architecture.

This makes the architecture legible to GitHub reviewers without requiring the application to run.

## 12. Internationalization

`src/lib/i18n/` provides a persisted locale selector for 10 languages and RTL handling for Arabic.

## 13. Known implementation boundaries

- Testnet only.
- Not independently security audited.
- AI model health is process-local.
- Knowledge OS is not full RAG/document ingestion.
- Some mutating routes need stronger wallet-proof enforcement before mainnet.
- Bridge and Circle Swap depend on current testnet operational routes/liquidity/policy.
- OTC Swap requires a funded counterparty wallet for meaningful end-to-end settlement.
- Mainnet contract placeholders must not be treated as production configuration.
