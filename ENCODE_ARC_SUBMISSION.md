# ARCTIS — Encode × Arc Hackathon Submission

**Project:** ARCTIS
**Category:** AI + Stablecoin Infrastructure
**Network:** Arc Testnet (Chain ID 5042002)
**Status:** Fully functional on Arc Testnet

---

## Problem Statement

Web3 is fragmented. Users need a wallet for assets, a separate tool for AI, another for agents, and yet another for cross-chain operations. Each tool is siloed, unaware of the others, and requires re-learning a new interface. Economic agents — AI systems that can take financial actions — exist in demos but not in production-safe deployments. There is no human approval gate, no audit trail, and no trust model.

The result: Web3 power is inaccessible to most people, and those who do use it have to stitch together five products to do what one should do.

---

## Solution

ARCTIS is a Web3 Operating System. One interface, four integrated operating systems, built on Arc.

```
AI OS  ←→  Knowledge OS  ←→  Stablecoin OS  ←→  Economic Agent OS
```

Every system is aware of every other. Your AI Copilot knows your recent transactions. Your agents can only act after you approve them. Your Passport identity works across every module. Your USDC movements generate a verified audit trail automatically.

**The key insight:** the most important missing piece in Web3 AI is not capability — it is trust. ARCTIS solves trust through verifiability, not theater.

---

## Why ARCTIS Matters

1. **Real settlement, not simulation.** Every Transfer, Swap, and Bridge executes real on-chain transactions with real USDC on Arc Testnet. No mock liquidity. No fake DEX behavior. The OTC swap engine uses a dedicated on-chain wallet with real reserves.

2. **Human-in-the-loop by design.** Agents cannot spend without explicit human approval. The gate is enforced in the executor — not just the UI — so it cannot be bypassed by a frontend change.

3. **Verifiability as the UX.** Every stablecoin operation produces five proof records: on-chain confirmation, explorer link, activity record, transaction ledger entry, and treasury log. Trust is a property of the system, not a marketing claim.

4. **Integrated, not assembled.** This is not four separate products connected by links. The AI Copilot pulls context from your agent reports. Your agent's budget comes from the same credit system as your AI chat. Your Passport identity resolves to your wallet in the Transfer flow. The integration is functional, not cosmetic.

---

## Arc Integration

ARCTIS is built on Arc. Every economic operation settles on Arc Testnet.

| Integration Point | How It's Used |
|-------------------|---------------|
| Arc Native USDC (`0x3600000000000000000000000000000000000000`) | Primary asset for all Transfer, Swap, Credits, Membership, Treasury operations |
| Arc Testnet RPC (Chain ID 5042002) | All on-chain reads and writes via viem with 3-endpoint fallback transport |
| ArcScan (`testnet.arcscan.app`) | Every completed operation shows a working ArcScan explorer link |
| Arc Memo Contract (`0x5294E...`) | Transaction Memos attach structured metadata to Transfer and Bridge operations |
| CCTP V2 (inbound to Arc) | Bridge brings USDC from Ethereum/Base/Arbitrum Sepolia to Arc Testnet |

**Arc Native USDC usage is real.** Credits are purchased with real Arc Native USDC transfers. Membership tiers are activated with real Arc Native USDC. The OTC swap engine holds real Arc Native USDC reserves. No simulated or mocked USDC amounts.

**Arc brand compliance confirmed.** All copy follows the official Arc Brand Guidelines: "Built on Arc," "Arc Native USDC," "Arc Testnet" — ARCTIS is always the product, Arc is always the infrastructure.

---

## Four Operating Systems

### AI OS

12 AI modes covering research, code generation, explanation, summarization, translation, creative writing, analysis, QA, debugging, review, brainstorming, and custom tasks.

The **Copilot** builds dynamic context from the user's actual data: recent transactions, saved prompts, agent reports, and session history. It is not a generic chatbot — it knows what you have been doing.

Streaming output, voice input, image attachment, session persistence, and multi-model routing via OpenRouter.

### Knowledge OS

Domain-specific prompt workspaces for 9 professional domains. A personal prompt library. Session persistence. Everything feeds into the AI OS as context.

### Stablecoin OS

Three independent modules, each production-grade:

**Transfer:** USDC/tUSDC/tARC on-chain transfer with Passport-aware address resolution (`username.arc` resolves to a wallet).

**Swap:** Real OTC settlement. A dedicated Swap Wallet holds on-chain reserves. The quote route checks live reserves before the user signs. The execute route verifies the inbound transfer on-chain before dispatching the outbound leg. No AMM. No simulated liquidity.

**Bridge:** CCTP V2 inbound bridge via Circle Iris attestation. The UI shows the full lifecycle: approve → burn → attest → forward → complete, with source-chain and ArcScan explorer links at completion.

**Five-Requirement Proof Standard:** Every operation (Transfer, Swap, Bridge, Credits, Membership) satisfies all five requirements before being considered complete:
1. On-chain transaction confirmed
2. Explorer link shown to user
3. Activity record written
4. Transaction ledger record written
5. Treasury accounting record written

### Economic Agent OS

7 required agent types with persistent memory, monthly budgets, and a full lifecycle.

**The Approval Gate** (most important feature for trust):
- **Prepare:** Agent preflights run. Zero AI calls made. A proposal record is created with `status: proposed`.
- **Review:** Human sees the task, cost estimate, current balance, and budget remaining.
- **Approve or Reject:** The human decides. Rejection costs zero credits and makes zero AI calls. The decision is an immutable audit record.
- **Execute:** Only after explicit approval does the AI run.

This gate is enforced in `src/lib/agents/executor.ts` — not just in the UI. There is no way to call `executeAgent()` without going through the gate.

**The Independent Evaluator:** After every agent execution, a second structurally-separate inference pass reviews the output adversarially. It has no access to the generator's system prompt or memory. On FAIL, one bounded revision attempt occurs. The verdict is stored and displayed in the execution history.

---

## Security Model

| Layer | Mechanism |
|-------|-----------|
| Payment verification | `verifyUSDCPayment()` / `verifyTokenPayment()` — on-chain transaction verified via viem before any credit or tier change |
| Wallet ownership | EIP-191 signature verification on 6 routes (strict mode) |
| Agent gate | `proposeAgent()` + `approveProposal()` enforced in executor |
| Rate limiting | Firestore-backed sliding window on 5 highest-risk routes |
| RPC resilience | 3-endpoint fallback transport on all server-side viem clients |
| Treasury isolation | Observer-only — never executes, never holds funds, never gates operations |
| Startup validation | `assertEnvOrThrow()` — fails fast if required env vars are missing |

---

## Technical Highlights

- **Real OTC swap engine** — not a DEX wrapper, not a quote aggregator. An EOA-based counterparty with live reserve checking at quote time.
- **CCTP V2 Forwarding Service** — direct integration without the Bridge Kit SDK; gives full control over the attestation flow.
- **Agent evaluator isolation** — the evaluator makes a completely separate API call with a separate system prompt. It cannot inherit the generator's blind spots.
- **Idempotent settlement** — both Swap and Bridge use the inbound/burn tx hash as the document ID, making double-processing impossible even with concurrent requests.
- **Non-blocking proof writes** — all proof records (activity, transaction ledger, treasury log) use `Promise.allSettled()` / fire-and-forget. A Firestore write failure never blocks the user's funds from settling.
- **Type-safe Firestore** — all collection reads/writes go through typed service functions. No raw `doc.data()` in API routes.

---

## Technical Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 App Router |
| Language | TypeScript (strict) |
| Blockchain | Wagmi v2 + Viem |
| Wallet UI | RainbowKit v2 |
| State | Zustand |
| Database | Firebase Firestore |
| AI | OpenRouter (multi-model) |
| Styling | TailwindCSS + Framer Motion |
| Chain | Arc Testnet, Chain ID 5042002 |

---

## Demo Guide

**Suggested judge walkthrough (approximately 5 minutes):**

1. **Connect wallet** → MetaMask on Arc Testnet (Chain ID 5042002)

2. **Claim Passport** → Navigate to Passport, claim `yourname.arc`, view your public profile at `/p/yourname`

3. **Send USDC** → Navigate to Transfer, send a small amount to any address or Passport handle. See the ArcScan link on the success screen. Check Activity Center — the record is there.

4. **Swap tokens** → Navigate to Swap. Request a USDC → tUSDC quote — note the live reserve check. Execute the swap. See both inbound and outbound tx links on the completion screen.

5. **Create an Agent** → Navigate to Agents, create a Research Agent. Give it a task. Watch the **Proposal Review card** appear — showing cost estimate, current balance, and Approve/Reject buttons. Approve it. Watch the execution and then the Evaluator verdict badge in History.

6. **Dashboard** → Return to Dashboard. See the Command Center — USDC balance prominently displayed, OS Overview, Quick Actions, and recent activity all in one view.

---

## Screenshots

_[Add screenshots to `/public/screenshots/` before submission]_

- `dashboard.png` — Command Center with balance and OS Overview
- `agents-approval.png` — The Proposal Review card
- `bridge-attesting.png` — CCTP V2 attestation in progress
- `swap-complete.png` — Completed swap with dual explorer links
- `passport.png` — Passport card with `username.arc`

---

## Future Roadmap

**Near-term (post-testnet):**
- Full SIWE enforcement on all API routes
- QR code on Passport profiles
- Avatar upload via Firebase Storage
- Agent-to-agent communication

**Protocolization phase:**
- `ReferenceRegistry` — on-chain attestation linking ARCTIS operation IDs to Arc transaction hashes
- `AgentRegistry` — on-chain agent identity for agent wallet support
- `PassportRegistry` — on-chain `username.arc → wallet` mapping for cross-app identity

**Long-term:**
- Mainnet deployment after Arc Mainnet launch
- Cross-chain USDC treasury
- Agent marketplace
- Enterprise workspace plans

---

## Repository Structure

```
src/
├── app/                    # Next.js App Router pages + API routes
│   ├── api/                # All backend routes
│   │   ├── agents/         # Proposal gate + execution
│   │   ├── bridge/         # CCTP V2 settlement
│   │   ├── swap/           # OTC settlement
│   │   ├── passport/       # Identity management
│   │   ├── credits/        # Credit purchase + verification
│   │   ├── membership/     # Tier activation + verification
│   │   └── ai/             # Chat + Copilot
│   └── [screens]/          # 16 user-facing screens
├── lib/
│   ├── agents/             # Executor + evaluator + memory + service
│   ├── bridge/             # CCTP types + service + attestation
│   ├── swap/               # OTC types + service + executor
│   ├── passport/           # Identity types + service
│   ├── memo/               # Transaction memo service + hook
│   ├── security/           # Rate limiting + env validation
│   ├── chain/              # Viem clients + verification + fallback transport
│   ├── firebase/           # Firestore persistence layer
│   ├── treasury/           # Observer-only accounting
│   └── auth/               # EIP-191 verification + middleware
└── types/index.ts          # All shared TypeScript types
```
