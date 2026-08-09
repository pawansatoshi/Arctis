# DATABASE.md — ARCTIS Firestore Schema

**Provider:** Firebase Firestore (NoSQL document store)
**Mode:** Native mode
**Region:** Set during Firebase project creation

---

## Collections

### `transactions`
All on-chain operation records across Transfer, Swap, Bridge, Credits, Membership.

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Document ID (auto-generated) |
| `walletAddress` | string | Lowercase wallet address |
| `toAddress` | string | Recipient address |
| `amount` | string | Raw amount string |
| `amountFormatted` | string | Human-readable amount |
| `txHash` | string | On-chain transaction hash |
| `status` | `confirmed\|pending\|failed` | Transaction status |
| `token` | `USDC\|tUSDC\|tARC` | Token type |
| `type` | `transfer\|swap\|bridge\|credit_purchase\|membership` | Operation type |
| `chainId` | number | Arc Testnet = 5042002 |
| `networkName` | string | "Arc Testnet" |
| `explorerUrl` | string | ArcScan URL |
| `note` | string? | Optional operation note |
| `createdAt` | Timestamp | Server timestamp |

**Writer:** `src/lib/firebase/transactions.ts` → `saveTransaction()` (server-side only)
**Reader:** History page, Dashboard activity feed

---

### `activity`
Cross-pillar unified activity feed.

| Field | Type | Description |
|-------|------|-------------|
| `walletAddress` | string | Lowercase wallet |
| `type` | ActivityType | See below |
| `category` | `wallet\|ai\|agent\|treasury\|system` | Pillar category |
| `title` | string | Human-readable title |
| `description` | string | Detail line |
| `severity` | `info\|success\|warning\|error` | Visual indicator |
| `metadata` | object | txHash, amount, routeId, etc. |
| `createdAt` | Timestamp | Server timestamp |

**ActivityType values:** `transfer_completed`, `swap_completed`, `bridge_completed`, `bridge_failed`, `credit_purchase`, `membership_purchase`

**Writer:** `src/lib/firebase/activity.ts` → `writeActivity()` (server-side only, fire-and-forget)
**Reader:** Activity Center page

---

### `treasury_logs`
Observer-only accounting records. Never gates or blocks operations.

| Field | Type | Description |
|-------|------|-------------|
| `type` | TreasuryLogType | See below |
| `amount` | number | Amount in human-readable units |
| `description` | string | Human-readable description |
| `walletAddress` | string? | Associated wallet |
| `txHash` | string? | Associated tx hash |
| `createdAt` | Timestamp | Server timestamp |

**TreasuryLogType values:** `membership_payment`, `credit_purchase`, `ai_spend`, `transfer`, `refund`, `swap_inflow`, `swap_outflow`, `swap_fee_revenue`, `bridge_inbound_activity`, `agent_spend`

**Writer:** `src/lib/treasury/service.ts` → `logTreasuryEvent()` (server-side only)
**Reader:** Treasury page

---

### `bridge_pending`
Bridge operation lifecycle — from burn initiation through attestation to completion.

| Field | Type | Description |
|-------|------|-------------|
| `burnTxHash` | string | **Document ID** — enforces idempotency |
| `walletAddress` | string | Lowercase wallet |
| `sourceChain` | string | e.g. "Ethereum Sepolia" |
| `sourceChainId` | number | e.g. 11155111 |
| `sourceDomain` | number | CCTP domain number |
| `destinationChain` | "Arc Testnet" | Always Arc Testnet |
| `destinationDomain` | 26 | Arc CCTP domain |
| `amount` | number | Human-readable USDC |
| `status` | BridgeStatus | See below |
| `forwardTxHash` | string? | Arc minting tx (set on completion) |
| `failureReason` | string? | Set on failure/timeout |
| `createdAt` | Timestamp | Server timestamp |
| `completedAt` | string? | ISO timestamp on completion |

**BridgeStatus values:** `approving`, `burning`, `attesting`, `forwarding`, `completed`, `timeout`, `failed`

**Composite index required:**
```json
{ "walletAddress": "ASC", "createdAt": "DESC" }
```
→ Deploy: `firebase deploy --only firestore:indexes`

---

### `swap_records`
OTC swap history. `inboundTxHash` is the document ID (idempotency key).

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | **Document ID** = inboundTxHash |
| `walletAddress` | string | Lowercase wallet |
| `routeId` | SwapRouteId | e.g. "usdc-tusdc" |
| `fromToken` | SwapToken | USDC\|tUSDC\|tARC |
| `toToken` | SwapToken | USDC\|tUSDC\|tARC |
| `inputAmount` | number | Human-readable input |
| `outputAmount` | number | Human-readable output |
| `fee` | number | Fee in fromToken units |
| `inboundTxHash` | string | User's transfer to Swap Wallet |
| `outboundTxHash` | string? | Swap Wallet's transfer to user |
| `status` | SwapStatus | `pending\|confirming\|dispatching\|completed\|failed` |
| `createdAt` | Timestamp | Server timestamp |
| `completedAt` | string? | ISO on completion |

**Composite index required:**
```json
{ "walletAddress": "ASC", "createdAt": "DESC" }
```

---

### `passports`
Username → wallet identity registry. Document ID = lowercase username.

| Field | Type | Description |
|-------|------|-------------|
| `username` | string | Lowercase username (also Document ID) |
| `walletAddress` | string | Lowercase wallet |
| `displayName` | string? | Optional display name |
| `bio` | string? | Optional bio (max 200 chars) |
| `avatarUrl` | string? | Optional avatar URL |
| `verified` | boolean | Default false |
| `createdAt` | Timestamp | Server timestamp |
| `updatedAt` | Timestamp? | Server timestamp on update |

**Constraint:** One Passport per wallet, enforced via `getPassportByWallet()` check before creation.

---

### `agent_executions`
Full agent execution lifecycle including proposals, approvals, and results.

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Document ID (generated) |
| `agentId` | string | Agent reference |
| `agentName` | string | Denormalised for display |
| `agentType` | AgentType | research\|developer\|engineering\|treasury\|monitoring\|document\|custom |
| `ownerWallet` | string | Lowercase wallet |
| `task` | string | Human-readable task |
| `input` | string | Full input sent to AI |
| `outputSummary` | string | First 300 chars |
| `outputFull` | string? | Complete output |
| `creditsConsumed` | number | Credits charged |
| `model` | string | Model used |
| `status` | AgentExecutionStatus | See below |
| `startedAt` | string | ISO timestamp |
| `completedAt` | string? | ISO timestamp |
| `durationMs` | number? | Execution time |
| `reportId` | string? | Linked report if generated |
| `evaluationVerdict` | `PASS\|FAIL`? | Evaluator verdict |
| `evaluationReasons` | string[]? | Evaluator feedback |
| `revisionCount` | number? | Times revised (0 or 1) |
| `errorMessage` | string? | Error if failed |

**AgentExecutionStatus values:** `proposed`, `approved`, `rejected`, `pending`, `running`, `completed`, `failed`, `cancelled`

**Composite index required:**
```json
{ "ownerWallet": "ASC", "status": "ASC", "startedAt": "DESC" }
```

---

### `agents`
Agent configuration records.

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Document ID |
| `ownerWallet` | string | Lowercase wallet |
| `name` | string | Agent display name |
| `type` | AgentType | One of 7 types |
| `description` | string | Agent description |
| `goals` | string[] | Agent goals list |
| `instructions` | string | System-level instructions |
| `model` | string | Preferred AI model |
| `status` | AgentStatus | `idle\|running\|paused\|error\|archived` |
| `monthlyBudgetCredits` | number | Monthly credit cap |
| `maxCreditsPerExecution` | number | Per-execution cap |
| `creditsUsedThisMonth` | number | Running total |
| `budgetResetDate` | string | ISO date of next reset |
| `tags` | string[] | Classification tags |
| `executionCount` | number | Lifetime executions |
| `totalCreditsConsumed` | number | Lifetime credits |
| `createdAt` | string | ISO timestamp |
| `lastActiveAt` | string? | ISO timestamp |

---

### `agent_reports`
Generated agent reports, downloadable.

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Document ID |
| `agentId` | string | Parent agent |
| `agentName` | string | Denormalised |
| `ownerWallet` | string | For ownership verification |
| `title` | string | First 80 chars of task |
| `type` | AgentType | Agent type |
| `content` | string | Full report content |
| `summary` | string | First 250 chars |
| `executionId` | string | Parent execution |
| `createdAt` | string | ISO timestamp |
| `tags` | string[] | Classification |

---

### `credit_balances`
Per-wallet running credit total. **Document ID** = lowercase wallet.

| Field | Type | Description |
|-------|------|-------------|
| `total` | number | Lifetime credits granted (purchased + bonus) |
| `used` | number | Lifetime credits consumed |
| `updatedAt` | Timestamp | Last modification |

`remaining = total - used`, computed on read, not stored.

**Writer:** `src/lib/credits/engine.ts` (Admin SDK, server-side only)

---

### `credit_ledger`
Per-transaction credit history — every purchase, deduction, bonus, and refund as its own document.

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Document ID (auto) |
| `walletAddress` | string | Lowercase wallet |
| `type` | `purchase\|deduct\|refund\|bonus\|expiry` | Entry type |
| `credits` | number | Signed amount (negative for deductions) |
| `balanceBefore` / `balanceAfter` | number | Running balance snapshot |
| `description` | string | Branded, human-readable — e.g. "ARCTIS AI — Research mode" (never a raw model name) |
| `aiModel` | string? | Internal only — the actual backend model used, if any. Never rendered in any UI. |
| `sessionId` | string? | Related AI session, if applicable |
| `txHash` | string? | On-chain tx, for purchases |
| `createdAt` | Timestamp | Server timestamp |

**Writer:** `src/lib/credits/engine.ts` (Admin SDK)

---

### `memberships`
Per-wallet membership tier state. **Document ID** = lowercase wallet.

| Field | Type | Description |
|-------|------|-------------|
| `tier` | `free\|student\|pro\|enterprise` | Active tier |
| `status` | string | `active`, etc. |
| `startDate` / `renewalDate` | string (ISO) | Billing cycle |
| `txHash` | string | Activation payment |
| `autoRenew` | boolean | |

**Writer:** `src/lib/memberships/service.ts` (Admin SDK)

---

### `agent_ledger`
Per-agent credit history — separate from the owner's global `credit_ledger`, scoped to one agent's spend.

| Field | Type | Description |
|-------|------|-------------|
| `agentId` | string | Owning agent |
| `ownerWallet` | string | Lowercase wallet |
| `type` | `created\|execution` | Entry type |
| `creditsAmount` | number | Signed amount |
| `balanceBefore` / `balanceAfter` | number | Monthly-budget snapshot |
| `description` | string | Human-readable |
| `executionId` | string? | Related execution |
| `createdAt` | Timestamp | Server timestamp |

**Writer:** `src/lib/agents/service.ts` (Admin SDK)

---

### `ai_sessions`
Chat session history.

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Document ID |
| `walletAddress` | string | Lowercase wallet |
| `title` | string | Auto-generated from first message |
| `mode` | AIMode | Active AI mode |
| `model` | string | Internal marker only (`'arctis-ai'`) — never a real model identifier; actual model selection is automatic and per-request, not per-session |
| `messages` | AIMessage[] | Full message history |
| `totalCreditsUsed` | number | Session total |
| `createdAt` | Timestamp | Server timestamp |
| `updatedAt` | Timestamp | Last message timestamp |

---

### `saved_prompts`
Personal prompt library.

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Document ID |
| `walletAddress` | string | Lowercase wallet |
| `text` | string | Prompt content |
| `domain` | WorkspaceDomain? | Optional domain tag |
| `createdAt` | Timestamp | Server timestamp |

---

### `obs_logs`
Observability and error logging. Server-side only.

| Field | Type | Description |
|-------|------|-------------|
| `level` | `info\|warn\|error` | Log severity |
| `module` | string | Source module |
| `message` | string | Log message |
| `data` | object? | Additional context |
| `wallet` | string? | Associated wallet |
| `createdAt` | Timestamp | Server timestamp |

**Note:** Configure a TTL policy on this collection (30-day retention recommended) to avoid unbounded growth.

---

### `rate_limits`
Sliding-window rate limit counters. Auto-expires by design (window resets).

| Field | Type | Description |
|-------|------|-------------|
| Key | string | `{route}:{walletAddress}` (Document ID) |
| `count` | number | Requests in current window |
| `windowStart` | number | Unix ms timestamp of window start |
| `updatedAt` | Timestamp | Server timestamp |

---

## Required Firestore Indexes

Deploy via: `firebase deploy --only firestore:indexes`

This file exists at `firestore.indexes.json` in the root. Composite indexes are required wherever a query combines an equality filter with an `orderBy` on a different field (a very common Firestore gotcha — these queries fail at runtime with a console link to auto-create the missing index if it's ever missed). The full current set:

| Collection | Fields (in order) |
|-----------|-------------------|
| `agent_executions` | `ownerWallet` ASC, `status` ASC, `startedAt` DESC |
| `agent_executions` | `agentId` ASC, `startedAt` DESC |
| `agent_executions` | `ownerWallet` ASC, `startedAt` DESC |
| `bridge_pending` | `walletAddress` ASC, `createdAt` DESC |
| `swap_records` | `walletAddress` ASC, `createdAt` DESC |
| `credit_ledger` | `walletAddress` ASC, `createdAt` DESC |
| `transactions` | `walletAddress` ASC, `createdAt` DESC |
| `ai_sessions` | `walletAddress` ASC, `updatedAt` DESC |
| `saved_prompts` | `walletAddress` ASC, `createdAt` DESC |
| `agents` | `ownerWallet` ASC, `status` ASC, `createdAt` DESC |
| `agent_reports` | `agentId` ASC, `createdAt` DESC |
| `agent_reports` | `ownerWallet` ASC, `createdAt` DESC |
| `agent_ledger` | `agentId` ASC, `createdAt` DESC |
| `obs_logs` | `category` ASC, `createdAt` DESC |

**Note on build time:** composite indexes build asynchronously after deploy — this can take a few minutes for a fresh project. Queries against a not-yet-built index fail until it reaches "Enabled" in Firebase Console → Firestore → Indexes.

---

## Firestore Security Rules (Actual, Deployed)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Public, read-only profile lookup. Writes always go through
    // /api/passport/* (Admin SDK).
    match /passports/{username} {
      allow read: if true;
      allow write: if false;
    }

    // Everything else: no direct client access at all. Every other
    // collection in this document is read/written exclusively via
    // the Firebase Admin SDK from server-side API routes, which
    // bypasses these rules entirely — the trust boundary is wallet-
    // signature verification at the API layer, not these rules.
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

**Why this is the correct design (and what changed):** an earlier version of these rules required `request.auth != null && request.auth.uid == wallet` for `credit_balances` reads — but the app authenticates wallet ownership via signature verification, not Firebase Auth, so `request.auth` was always `null` and every read was silently denied. Combined with every Firestore call (including from server API routes) using the **client** SDK rather than the Admin SDK, this meant nearly every read/write in the app was permission-denied by design, not by bug — it looked like "flaky Firestore connectivity" but was actually a rules/architecture mismatch. The fix was two-part: (1) migrate every Firestore-touching file to the Admin SDK, which bypasses rules entirely for trusted server code, and (2) lock the rules down to deny all direct client access outright, since nothing legitimate needs it anymore.

**All writes to every collection above must go through server-side API routes only — there is no other supported path.**
