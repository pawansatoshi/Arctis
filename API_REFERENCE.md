# API_REFERENCE.md — ARCTIS

All routes are Next.js App Router Route Handlers at `src/app/api/`.

Base URL: `https://your-deployment.vercel.app/api`

---

## Authentication

Routes marked **[STRICT AUTH]** require EIP-191 wallet signature headers:

```
x-wallet-address: 0x...
x-wallet-signature: 0x...   (signed message)
x-wallet-nonce: 1234567890  (Unix timestamp in ms)
```

Message format (must match server-side `buildAuthMessage()`):
```
ARCTIS Auth Request
Wallet: 0x{lowercase_address}
Nonce: {timestamp}
```

Routes marked **[OWNERSHIP]** verify wallet ownership against a stored record (no cryptographic signature required at this stage).

Routes marked **[PUBLIC]** require no authentication.

---

## Stablecoin OS

### Credits

#### `POST /api/credits` [STRICT AUTH]

Purchase AI credits after an on-chain USDC payment.

**Request body:**
```json
{
  "walletAddress": "0x...",
  "packageId": "starter|pro|enterprise",
  "txHash": "0x..."
}
```

**Response 200:**
```json
{
  "success": true,
  "creditsAdded": 100,
  "memoPayload": "0x..."
}
```

**Errors:** 400 (validation), 401 (auth), 402 (payment verification failed), 429 (rate limited), 500

---

#### `GET /api/credits?wallet=0x...` [PUBLIC]

Get current credit balance and purchase history.

**Response 200:**
```json
{
  "balance": { "remaining": 450, "totalPurchased": 500, "totalUsed": 50 },
  "history": [...]
}
```

---

### Membership

#### `GET /api/membership?wallet=0x...` [PUBLIC]

Get current membership status.

**Response 200:**
```json
{
  "membership": {
    "tier": "pro",
    "walletAddress": "0x...",
    "activatedAt": "2026-01-01T00:00:00.000Z",
    "txHash": "0x..."
  }
}
```

---

#### `POST /api/membership` [STRICT AUTH]

Activate membership tier after on-chain USDC payment.

**Request body:**
```json
{
  "walletAddress": "0x...",
  "tier": "pro",
  "txHash": "0x..."
}
```

**Response 200:**
```json
{
  "success": true,
  "memoPayload": "0x..."
}
```

---

### Swap

#### `GET /api/swap` [PUBLIC]

Get available swap routes.

**Response 200:**
```json
{
  "available": true,
  "mode": "otc_settlement",
  "routes": [
    { "id": "usdc-tusdc", "fromToken": "USDC", "toToken": "tUSDC", "rate": 1, "feeBps": 30, "enabled": true }
  ]
}
```

---

#### `GET /api/swap/quote?from=USDC&to=tUSDC&amount=100` [PUBLIC]

Get swap quote with live reserve check.

**Response 200:**
```json
{
  "routeId": "usdc-tusdc",
  "fromToken": "USDC",
  "toToken": "tUSDC",
  "inputAmount": 100,
  "outputAmount": 99.7,
  "fee": 0.3,
  "feeBps": 30,
  "rate": 1,
  "routeAvailable": true
}
```

**Response 503 (insufficient reserves):**
```json
{
  "routeAvailable": false,
  "reserveAvailable": 50,
  "error": "Insufficient tUSDC liquidity. Available: 50.0000, needed: 99.7000."
}
```

---

#### `POST /api/swap/execute` [STRICT AUTH]

Execute swap settlement after user's inbound transfer is confirmed.

**Request body:**
```json
{
  "walletAddress": "0x...",
  "fromToken": "USDC",
  "toToken": "tUSDC",
  "amount": 100,
  "inboundTxHash": "0x..."
}
```

**Response 200:**
```json
{
  "success": true,
  "outputAmount": 99.7,
  "outboundTxHash": "0x...",
  "memoPayload": "0x..."
}
```

**Errors:** 400, 401, 409 (already processed — idempotent), 429, 500

---

#### `GET /api/swap/history?wallet=0x...` [PUBLIC]

Get wallet swap history.

**Response 200:**
```json
{ "swaps": [{ "id": "0x...", "fromToken": "USDC", "toToken": "tUSDC", "status": "completed" }] }
```

---

### Bridge

#### `GET /api/bridge` [PUBLIC]

Get bridge route availability and CCTP configuration.

---

#### `GET /api/bridge/quote?sourceChain=11155111&amount=100` [PUBLIC]

Get bridge fee quote from Circle Iris API.

**Response 200:**
```json
{
  "sourceChain": "Ethereum Sepolia",
  "fee": 0.1,
  "feeToken": "USDC",
  "estimatedTime": "~30 seconds",
  "feeEstimated": false
}
```

---

#### `POST /api/bridge/execute` [STRICT AUTH]

Register a burn transaction and begin attestation polling.

Returns immediately with `status: "attesting"`. Poll `/api/bridge/status` to track progress.

**Request body:**
```json
{
  "burnTxHash": "0x...",
  "sourceChainId": 11155111,
  "walletAddress": "0x...",
  "amount": 100
}
```

**Response 200:**
```json
{ "bridgeId": "0x...", "status": "attesting" }
```

---

#### `GET /api/bridge/status?bridgeId=0x...` [PUBLIC]

Poll bridge completion status.

**Response 200:**
```json
{
  "status": "completed",
  "forwardTxHash": "0x...",
  "completedAt": "2026-01-01T00:00:00.000Z"
}
```

**Status values:** `attesting | forwarding | completed | timeout | failed | not_found`

---

#### `GET /api/bridge/history?wallet=0x...` [PUBLIC]

Get wallet bridge history.

---

## Identity

### `POST /api/passport/create` [STRICT AUTH]

Claim a new Passport username. One per wallet. Enforces uniqueness.

**Request body:**
```json
{ "username": "satoshi", "displayName": "Satoshi" }
```

**Response 201:**
```json
{
  "username": "satoshi",
  "walletAddress": "0x...",
  "passportHandle": "satoshi.arc"
}
```

---

### `GET /api/passport/resolve?username=satoshi` [PUBLIC]

Resolve username to wallet address.

**Response 200:**
```json
{ "walletAddress": "0x...", "displayName": "Satoshi" }
```

---

### `GET /api/passport/by-wallet?walletAddress=0x...` [PUBLIC]

Check if a wallet has a Passport.

---

### `PATCH /api/passport/update` [STRICT AUTH]

Update Passport profile. Verifies ownership against stored wallet.

**Request body:**
```json
{ "username": "satoshi", "displayName": "New Name", "bio": "Builder" }
```

---

## Economic Agent OS

### `POST /api/agents` [PUBLIC body, OWNERSHIP]

Create a new agent.

### `GET /api/agents?wallet=0x...` [PUBLIC]

List agents for a wallet.

### `GET /api/agents/:id` [PUBLIC]

Get agent by ID.

### `PATCH /api/agents/:id` [OWNERSHIP]

Update agent configuration.

---

### `POST /api/agents/propose` [OWNERSHIP]

Phase 1 of the approval gate. Runs preflights. Creates `proposed` record. Makes zero AI calls.

**Request body:**
```json
{ "agentId": "...", "task": "Research Arc stablecoin infrastructure", "walletAddress": "0x..." }
```

**Response 200:**
```json
{
  "proposalId": "prop_...",
  "agentName": "My Research Agent",
  "task": "Research Arc stablecoin infrastructure",
  "estimatedCredits": 10,
  "currentCreditBalance": 450,
  "budgetRemaining": 90,
  "model": "anthropic/claude-3.5-sonnet",
  "status": "proposed"
}
```

**Errors:** 402 (insufficient credits), 403 (unauthorized)

---

### `POST /api/agents/approve` [OWNERSHIP]

Phase 3 of the approval gate. Approve or reject a pending proposal.

**Request body:**
```json
{
  "proposalId": "prop_...",
  "walletAddress": "0x...",
  "action": "approve",
  "reason": "Optional rejection reason"
}
```

**Response (approve) 200:**
```json
{
  "executionId": "...",
  "outputSummary": "...",
  "creditsConsumed": 8,
  "durationMs": 3400
}
```

**Response (reject) 200:**
```json
{ "success": true, "status": "rejected" }
```

---

### `GET /api/agents/proposals?wallet=0x...` [PUBLIC]

List pending proposals (status = `proposed`) for a wallet.

---

### `POST /api/agents/stream` [OWNERSHIP]

Execute agent task with SSE streaming output.

Returns `text/event-stream`. Events: `{ chunk: "..." }` and `{ done: true, executionId, creditsConsumed, reportId }`.

---

### `GET /api/agents/executions?agentId=...` [PUBLIC]

Get execution history for an agent.

---

### `GET /api/agents/reports?agentId=...` [PUBLIC]

Get generated reports for an agent.

---

## AI OS

### `POST /api/ai/chat`

AI Workspace — model selection is fully automatic (dynamic free-model registry + health-based routing, see `SYSTEM_ARCHITECTURE.md` §8). The client cannot choose or influence which backend model answers; only `mode` (persona/system-prompt) is accepted. Credit cost is flat — 1 credit per 1,000 tokens — regardless of which model actually served the request.

If the message matches a Transfer/Swap/Bridge natural-language pattern (e.g. *"bridge 5 USDC"*), the route returns an `actionProposal` instead of calling any AI model — zero credits charged, deterministic regex parse, not an LLM inference. The client renders a confirmation card; nothing executes until the user confirms and completes the existing Transfer/Swap/Bridge page flow with their own wallet signature.

**Request body:**
```json
{
  "messages": [{ "role": "user", "content": "..." }],
  "mode": "research",
  "walletAddress": "0x...",
  "sessionId": "...",
  "stream": true
}
```

**Streaming response (SSE), normal reply:**
```
data: {"chunk": "..."}
data: {"done": true, "creditsUsed": 3}
```

**Streaming response, financial-intent match:**
```
data: {"actionProposal": {"action": "bridge", "amount": "5", "fromToken": "USDC", "createdAt": 1234567890}, "chunk": "Here's what I understood: ..."}
data: {"done": true, "creditsUsed": 0}
```

**Errors:** 400 (missing messages), 402 (insufficient credits) — no 403; there is no per-model or per-tier gate on AI Workspace access, only the credit balance check.

---

### `POST /api/ai/copilot`

Dynamic-context Copilot. Builds context from the user's sessions, prompts, agents, recent transactions. Always free — never checks or deducts credits, never enforces a membership tier. Model selection is automatic, same as `/api/ai/chat`.

**Request body:**
```json
{
  "messages": [{ "role": "user", "content": "..." }],
  "walletAddress": "0x...",
  "sessionId": "...",
  "stream": true
}
```

---

### `GET|POST|DELETE /api/sessions`

Server-side proxy for AI chat session persistence (Admin SDK — the browser never touches Firestore directly for this).

- `POST` body: `{ "session": AISession }` → `{ "success": true }`
- `GET ?wallet=0x...` → `{ "sessions": AISession[] }`
- `DELETE ?id=...` → `{ "success": true }`

---

### `GET|POST|DELETE /api/prompts`

Same pattern as `/api/sessions`, for the Workspace saved-prompt library.

- `POST` body: `{ "walletAddress": "0x...", "prompt": SavedPrompt }` → `{ "success": true }`
- `GET ?wallet=0x...` → `{ "prompts": SavedPrompt[] }`
- `DELETE ?id=...` → `{ "success": true }`

---

## Platform

### `GET /api/activity?wallet=0x...&limit=50`

Unified activity feed — aggregates transfers, swaps, bridge, credit ledger entries, AI sessions, and agent executions into one chronological list, sorted newest-first. Powers both the Activity Center (card feed) and History page (paginated table) from the same source — no duplicate aggregation logic.

```json
{ "items": [{ "id": "...", "type": "transfer", "title": "...", "description": "...", "timestamp": "...", "status": "confirmed", "txHash": "0x..." }], "total": 42 }
```

`meta` fields on each item are internal-only (never rendered) and never include the backend AI model/provider — see the AI Routing note in `SYSTEM_ARCHITECTURE.md`.

---

## Rate Limits

| Route | Limit |
|-------|-------|
| `/api/agents/propose` | 10 requests / 60 seconds per wallet |
| `/api/agents/approve` | 10 requests / 60 seconds per wallet |
| `/api/swap/execute` | 5 requests / 60 seconds per wallet |
| `/api/bridge/execute` | 5 requests / 60 seconds per wallet |
| `/api/passport/create` | 5 requests / 5 minutes per wallet |

Responses: HTTP 429 with `{ error: "Too many requests", resetAt: "ISO timestamp" }`
