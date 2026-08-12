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

- Browser UI can request work and display results.
- Server routes validate, coordinate and persist.
- Firebase Admin SDK is server-side persistence infrastructure.
- AI model selection stays server-side.
- User-controlled money movement ends at the wallet/App Kit signing boundary.

## 2. Product pillars

### AI OS

- `/ai` — AI Workspace.
- `/copilot` — contextual Copilot.
- `/agents` — agent configuration/execution surface.
- 12 persona definitions in `src/config/ai.ts`.
- Automatic backend model routing in `src/lib/ai/router/`.

### Knowledge OS

- `/workspace`
- `/knowledge`
- `/api/sessions`
- `/api/prompts`

Current knowledge context is application-data based. It is not a full document RAG stack.

### DeFi OS

- `/transfer`
- `/swap`
- `/bridge`
- `/api/transfer`
- `/api/swap`
- `/api/bridge`

Transfer is user-signed. Swap is configured OTC settlement. Bridge uses Circle App Kit and the repository's CCTP route/policy configuration.

### Economic Agent OS

Agent safety boundary:

```text
Prepare / Propose
       ↓
Review
       ↓
Human approval
       ↓
Execute
       ↓
Persist execution + report + ledger
```

The executor/service layer enforces this boundary; the UI is not the only guard.

## 3. AI routing

The routing pipeline is:

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
user confirmation
  ↓
existing Transfer / Swap / Bridge page
  ↓
wallet/App Kit signing
```

This separation is deliberate. An LLM is not trusted to invent a financial amount, token pair, destination address or execution transaction.

### Current routing limitation

Health state and the model registry cache are process-local. Multi-instance shared routing state is a future hardening step.

## 4. Money movement

### Transfer

```text
UI → validation → wallet write → onchain confirmation → record
```

The server does not sign the user's transaction.

### OTC Swap

```text
quote → reserve check → user inbound transfer → server verifies inbound
      → Swap Wallet counterparty transfer → record both legs
```

The Swap Wallet is a separate counterparty wallet. This is not an AMM.

### Bridge

```text
source-chain preflight
      ↓
Circle App Kit / Viem adapter
      ↓
CCTP burn / forwarding lifecycle
      ↓
result extraction + history persistence
```

Configured testnet chain metadata currently covers Arc Testnet, Ethereum Sepolia, Base Sepolia and Arbitrum Sepolia. Availability is still constrained by the bridge policy and returned route configuration.

## 5. Five-part proof model

Where an operation requires the full proof standard, completion means the system has the relevant combination of:

1. Confirmed onchain transaction.
2. Explorer transaction reference.
3. Activity record.
4. Transaction/operation ledger record.
5. Treasury/accounting record when applicable.

The exact record path differs by operation. Documentation should not imply that every operation uses an identical persistence sequence.

## 6. Persistence

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

## 7. Security pipeline

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

The repository has stronger cryptographic wallet verification on some routes than others. This is explicitly documented rather than hidden.

See [`SECURITY.md`](./SECURITY.md).

## 8. Central configuration

| Concern | Source |
|---|---|
| AI personas | `src/config/ai.ts` |
| Billing | `src/config/billing.ts` |
| Assets | `src/config/assets.ts` |
| Network/contracts | `src/lib/contracts.ts` |
| Bridge policy | `src/lib/bridge/policy.ts` |
| AI routing | `src/lib/ai/router/` |
| Product context | `src/lib/ai/copilot/product-context.ts` |

Avoid copying these values into pages or documentation.

## 9. UI architecture

The current shell is organized around the product information architecture:

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

The command palette should mirror these names. Activity remains an internal aggregation concept/API rather than a primary navigation pillar.

## 10. Internationalization

`src/lib/i18n/` provides a persisted locale selector for 10 languages and RTL handling for Arabic. Product copy should use the translation layer rather than duplicating language-specific strings across pages.

## 11. Animation and interaction

Framer Motion is used for product-level transitions and interaction feedback. Animation should communicate state or hierarchy rather than become decorative noise. The architecture illustration in `docs/architecture-flow.svg` is intentionally lightweight and self-contained so the repository landing page can explain the system without an external animation service.

## 12. Known implementation boundaries

- Testnet only.
- Not independently security audited.
- AI model health is process-local.
- Knowledge OS is not full RAG/document ingestion.
- Some mutating routes need stronger wallet-proof enforcement before mainnet.
- Bridge and swap require real testnet operational funding/configuration for meaningful end-to-end validation.
- Mainnet contract placeholders must not be treated as production configuration.
