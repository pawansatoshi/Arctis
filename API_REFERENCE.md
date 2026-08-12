# ARCTIS — API Reference

This is the current route inventory for the Next.js App Router implementation.

> The source route handlers are authoritative for exact request/response schemas. This document is intentionally a readable map, not a second implementation of every TypeScript type.

Base path: `/api`

## Authentication vocabulary

- **PUBLIC** — no wallet proof required by the route.
- **OWNERSHIP** — application-level ownership/record checks are used.
- **STRICT** — cryptographic wallet verification is explicitly wired through the authentication helper.

The repository does **not** claim that every API route is STRICT. See [`SECURITY.md`](./SECURITY.md).

---

## AI OS

### `/api/ai/chat`

AI Workspace endpoint.

Responsibilities:

- persona selection;
- session-aware chat;
- streaming/non-streaming AI responses;
- automatic backend model routing;
- deterministic Transfer/Swap/Bridge intent detection.

When a financial intent is recognized, the route can return a structured proposal instead of asking an LLM to execute a transaction. The user then continues through the existing product flow.

### `/api/ai/copilot`

Contextual Copilot endpoint.

Builds bounded context from supported user-owned application data and routes the request through the same automatic model-selection layer.

### `/api/sessions`

`GET | POST | DELETE`

Server-side persistence proxy for AI sessions.

### `/api/prompts`

`GET | POST | DELETE`

Server-side persistence proxy for saved prompts.

---

## Economic Agent OS

### `/api/agents`

`GET | POST`

Agent configuration/listing operations.

### `/api/agents/propose`

Creates a pending agent proposal and performs preflight checks without silently executing the task.

### `/api/agents/approve`

Approve or reject a pending proposal.

### `/api/agents/execute`

Execution endpoint used by the agent execution path. Ownership and execution-state checks apply.

### `/api/agents/stream`

Streaming agent execution endpoint.

### `/api/agents/proposals`

Pending proposal retrieval.

### `/api/agents/executions`

Execution history retrieval.

### `/api/agents/reports`

Generated report retrieval.

The intended state machine is:

`Propose → Review → Approve → Execute`

---

## DeFi OS

### `/api/transfer`

Transfer-related server coordination/verification and transaction record operations.

The user's wallet remains the signing authority.

### `/api/swap`

Swap route discovery and configured OTC route information.

### `/api/swap/quote`

Quote and reserve availability for a configured OTC route.

### `/api/swap/execute`

Verify the user's inbound leg and coordinate the configured Swap Wallet counterparty leg.

### `/api/swap/history`

Retrieve swap history for a wallet.

### `/api/bridge`

Returns configured bridge networks/routes and policy-dependent availability.

### `/api/bridge/quote`

Returns bridge quote/fee information for the configured route.

### `/api/bridge/execute`

Registers/coordinates bridge execution state. The current UI execution path uses Circle App Kit; do not interpret this route as a server-side user-wallet signer.

### `/api/bridge/status`

Returns the current bridge operation state where applicable.

### `/api/bridge/history`

Retrieves persisted bridge history.

### `/api/bridge/record`

Bridge record/persistence support used by the current application flow.

---

## Finance

### `/api/credits`

Credit balance, purchase verification and ledger operations.

Canonical package definitions: `src/config/billing.ts`.

### `/api/membership`

Membership activation and entitlement operations.

Canonical tier definitions: `src/config/billing.ts`.

### `/api/treasury`

Observer/accounting data. Treasury does not become a hidden transaction executor.

---

## Identity

### `/api/passport`

Passport identity operations.

Current subroutes include create, update, wallet lookup and username resolution.

---

## Platform

### `/api/activity`

Unified activity aggregation endpoint used by the product's historical/activity data surfaces.

**Important:** Activity is a data aggregation concept; **History** is the canonical primary navigation surface.

### `/api/feedback`

User feedback submission.

### `/api/logs`

Server observability/logging support.

### `/api/auth`

Wallet/authentication helper endpoints used by the current application authentication flow.

---

## Route design principles

### Money routes

Money-moving routes should validate input, apply rate limits/policy, verify ownership/authentication as configured, verify onchain state where required, and persist the resulting operation.

### AI routes

Clients select the **persona**, not the backend model. Provider/model details remain server-side.

### Agent routes

Agent routes must preserve the approval boundary. Adding a new direct execution path that bypasses proposal/approval requires an explicit architecture/security review.

### Firestore

Client components should not directly access sensitive Firestore collections. Persistence belongs behind server-side routes using the Firebase Admin SDK.

---

## Source of truth

For exact route schemas and implementation behavior, inspect:

```text
src/app/api/**/route.ts
```

Then reconcile architecture-level changes with:

- `ARCHITECTURE_TRUTH.md`
- `SYSTEM_ARCHITECTURE.md`
- `SECURITY.md`
- `DATABASE.md`
