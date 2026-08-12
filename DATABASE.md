# ARCTIS — Firestore Data Reference

Firestore is the persistence layer for application state, history, accounting and observability.

## Access model

Sensitive collections are accessed from server-side code through the Firebase Admin SDK. Client components should not directly read/write those collections.

The repository's Firestore rules and indexes are part of the deployment configuration:

- `firestore.rules`
- `firestore.indexes.json`

Deploy after review with:

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

## Collections

| Collection | Purpose | Primary owner |
|---|---|---|
| `transactions` | Onchain transaction records | transaction persistence |
| `activity` | Cross-product activity aggregation | activity service |
| `treasury_logs` | Observer/accounting events | treasury service |
| `bridge_pending` | Bridge lifecycle and idempotency state | bridge service |
| `swap_records` | OTC swap lifecycle and idempotency | swap service |
| `passports` | Username → wallet identity mapping | passport service |
| `agents` | Agent configuration | agent service |
| `agent_executions` | Proposal/execution lifecycle | agent executor |
| `agent_reports` | Generated agent reports | agent executor |
| `agent_ledger` | Per-agent budget/spend ledger | agent service |
| `credit_balances` | Per-wallet credit balance | credits engine |
| `credit_ledger` | Credit purchases/deductions/bonuses/refunds | credits engine |
| `memberships` | Membership tier and entitlement state | membership service |
| `ai_sessions` | AI conversation persistence | sessions API |
| `saved_prompts` | User prompt library | prompts API |
| `obs_logs` | Server observability | logging service |
| `rate_limits` | Sliding-window request counters | rate-limit service |

## Important data boundaries

### Transactions

Used for user-facing transaction history and proof records. The transaction schema should be treated as an operation record, not as a replacement for the actual blockchain.

### Activity

A derived cross-pillar feed. It may aggregate transfer, swap, bridge, credit, membership, AI and agent events. It is not an independent financial ledger.

### Treasury

`treasury_logs` are observer/accounting records. Treasury is not the transaction executor.

### Bridge

`bridge_pending` stores the bridge lifecycle needed by the current application. The current bridge implementation supports configured source/destination metadata rather than assuming every bridge is always inbound to Arc.

### Swap

`swap_records` provide the application lifecycle around the configured OTC counterparty flow. Onchain transaction hashes remain the settlement evidence.

### Agents

Agent state is intentionally split between configuration (`agents`), lifecycle (`agent_executions`), reports (`agent_reports`) and budget/accounting (`agent_ledger`).

### Credits and membership

Membership entitlement and credit balance are separate domains. Billing definitions live in `src/config/billing.ts`; Firestore stores the resulting user state and ledger history.

### AI sessions and prompts

These are persistence primitives for the AI/Knowledge surfaces. They do not constitute a general-purpose semantic memory database.

## Security rules

The expected posture is:

```text
Browser
  │
  │ HTTPS
  ▼
Next.js API route
  │
  ├── wallet/auth checks where required
  ├── validation + rate limit
  └── Firebase Admin SDK
          │
          ▼
      Firestore
```

Do not bypass the API layer for sensitive collections merely to simplify a component.

## Indexes

The exact deployed index set is maintained in `firestore.indexes.json`. When adding a query that combines filters and ordering, update the index configuration and test the real Firestore environment.

Common indexed domains include:

- agent executions;
- bridge history;
- swap history;
- credit ledger;
- transactions;
- AI sessions;
- saved prompts;
- agents;
- agent reports.

## Data integrity principles

1. Store wallet addresses in a normalized form consistently.
2. Use onchain transaction hashes as evidence, not as trusted user claims.
3. Make financial operations idempotent where the lifecycle requires it.
4. Keep derived activity feeds separate from canonical ledgers.
5. Keep backend model identity out of user-facing product records where the product intentionally abstracts model choice.
6. Avoid creating a second collection when an existing domain record can represent the state cleanly.

## Source of truth

For exact fields and types, inspect the TypeScript models and the relevant Firebase service in `src/lib/firebase/` or the domain service that owns the collection. This document intentionally describes architecture rather than duplicating every implementation field.
