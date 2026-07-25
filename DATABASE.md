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
Per-wallet credit ledger.

| Field | Type | Description |
|-------|------|-------------|
| `walletAddress` | string | **Document ID** = lowercase wallet |
| `balance` | number | Current balance |
| `totalPurchased` | number | Lifetime purchased |
| `totalUsed` | number | Lifetime used |
| `updatedAt` | Timestamp | Last modification |

**Writer:** `src/lib/credits/engine.ts` (server-side only)
**Firestore Rule:** `allow write: if false` — server-side only

---

### `ai_sessions`
Chat session history.

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Document ID |
| `walletAddress` | string | Lowercase wallet |
| `title` | string | Auto-generated from first message |
| `mode` | AIMode | Active AI mode |
| `model` | string | Model used |
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

```json
{
  "indexes": [
    {
      "collectionGroup": "bridge_pending",
      "fields": [
        { "fieldPath": "walletAddress", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "swap_records",
      "fields": [
        { "fieldPath": "walletAddress", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "agent_executions",
      "fields": [
        { "fieldPath": "ownerWallet", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "startedAt", "order": "DESCENDING" }
      ]
    }
  ]
}
```

This file already exists at `firestore.indexes.json` in the root.

---

## Recommended Firestore Security Rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /credit_balances/{wallet} {
      allow read: if request.auth != null && request.auth.uid == wallet;
      allow write: if false;
    }
    match /passports/{username} {
      allow read: if true;
      allow write: if false;
    }
    match /feedback/{id} {
      allow create: if true;
      allow read, update, delete: if false;
    }
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

**Important:** All writes to sensitive collections (`transactions`, `activity`, `treasury_logs`, `credit_balances`, `agent_executions`) must go through server-side API routes only.
