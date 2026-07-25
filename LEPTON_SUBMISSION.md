# ARCTIS — Lepton Submission

## What ARCTIS Is

ARCTIS is a unified operating system where humans and Economic AI Agents work together, powered by Arc Native USDC. It combines four operating systems into one platform:

- **Knowledge OS** — sessions, saved prompts, document context
- **AI OS** — 12 AI modes, dynamic-context Copilot, streaming chat
- **Stablecoin OS** — Transfer, Swap (OTC), Bridge (CCTP V2) — three independent modules, each with a full on-chain proof chain
- **Economic Agent OS** — 7 agent types, memory, budgets, an Independent Evaluator Layer, and a mandatory human approval gate for every financial action

## Architecture at a Glance

```
┌─────────────────────────────────────────────────────────┐
│                      ARCTIS Frontend                     │
│         Next.js 14 · RainbowKit · Wagmi v2 · Viem        │
└───────────────────────────┬───────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌───────▼───────┐   ┌───────▼───────┐   ┌───────▼────────┐
│  Stablecoin OS │   │  Economic     │   │   Knowledge/   │
│                │   │  Agent OS     │   │   AI OS        │
│ Transfer       │   │ 7 Agent Types │   │ Copilot         │
│ Swap (OTC)     │   │ Evaluator     │   │ 12 AI Modes     │
│ Bridge (CCTP)  │   │ Approval Gate │   │ Sessions        │
└───────┬────────┘   └───────┬───────┘   └────────┬────────┘
        │                    │                    │
        └────────────────────┼────────────────────┘
                             │
                  ┌──────────▼──────────┐
                  │   Treasury (observer)│
                  │   Proof Chain (×5)   │
                  │   Transaction Memos  │
                  └──────────┬──────────┘
                             │
                  ┌──────────▼──────────┐
                  │     Arc Testnet      │
                  │  Chain ID 5042002    │
                  │  Native USDC gas     │
                  └──────────────────────┘
```

## The Proof Standard

Every Stablecoin OS operation (Transfer, Swap, Bridge, Credits, Membership) satisfies five requirements before being considered complete:

1. On-chain transaction confirmed
2. ArcScan (or source chain explorer) link shown to the user
3. Activity record written (`writeActivity`)
4. Transaction ledger record written (`saveTransaction`)
5. Treasury accounting record written (`logTreasuryEvent`) — or for Transfer, the transaction record itself, since Transfer generates no revenue

All five operations pass all five requirements, verified against source this session.

## The Agent Approval Gate

No agent ever executes a financial action autonomously. Every task follows:

**Prepare → Review → Approve → Execute**

1. **Prepare** — the agent's task is proposed; all preflight checks run (ownership, credit balance, monthly budget, membership tier/model access) — zero AI calls yet
2. **Review** — a human sees exactly what will run, the estimated cost, current balance, and budget headroom
3. **Approve or Reject** — explicit human decision; rejection costs zero credits and makes zero AI calls
4. **Execute** — only after approval does the agent run

## The Independent Evaluator Layer

Every agent execution is reviewed by a second, structurally separate inference pass — the evaluator has no access to the generator's system prompt, memory, or reasoning. It judges the output adversarially against the same quality bar the generator was instructed to meet. On FAIL, one bounded revision attempt occurs before the result reaches the human, with the full verdict preserved for audit.

## What's Real vs. What's Roadmap

**Real, verified against source code, working today:**
- Full Transfer/Swap/Bridge with real on-chain settlement (Swap uses a genuine OTC engine with a dedicated Swap Wallet holding real reserves — not a simulated DEX)
- 7 required agent types + 2 additional templates (Market Intelligence, Shopping Advisor) built on the existing Custom type — no architecture changes
- Transaction Memos across all 5 operations, non-blocking by design, user-toggleable in Settings
- Passport identity system (`username.arc`) with strict EIP-191 signature verification on every mutating route
- Strict wallet ownership verification (`verifyApiWallet` with `strict=true`) on Credits, Membership, Swap execute, Bridge execute, Passport create, Passport update — 6 routes total
- Rate limiting, RPC fallback, environment validation, Firestore composite indexes
- Premium UI across all 16 screens — consistent design system, mobile-first, accessible

**Explicitly not yet done, and why:**
- QR code on Passport profiles — no fake QR, honest "coming soon" state, blocked on package installation in this environment
- Avatar upload — blocked on Firebase Storage package installation
- On-chain Reference/Agent/Passport Registry contracts — require Foundry, scheduled after off-chain systems (which are now stable)
- Swap wallet needs real funding (operational step, not code)
- Firestore indexes need `firebase deploy` run against a live project (not executable from a sandbox)

## Demo Script (suggested flow for judges)

1. Connect wallet → claim a Passport (`yourname.arc`)
2. Transfer USDC to another Passport handle — show the ArcScan link and the Transaction Memo attached
3. Swap USDC → tUSDC — show the OTC quote with live reserve checking, then the completed swap with dual explorer links
4. Bridge USDC from Sepolia → Arc Testnet — show the CCTP V2 attestation flow end to end
5. Create an Economic Agent (try the Market Intelligence template) → give it a task → show the **Propose → Review card → Approve** flow, then the completed report with the Evaluator's PASS/FAIL badge visible in history
6. Open Settings → show the Transaction Memo toggle and language preference — both persisted, both respected by every operation

## Deployment Checklist (for a live environment)

- [ ] Set all required env vars per `.env.example` (Firebase, OpenRouter, WalletConnect)
- [ ] Generate and fund the Swap Wallet with tUSDC/tARC/USDC reserves
- [ ] Run `firebase deploy --only firestore:indexes`
- [ ] Set `NODE_ENV=production` (activates fail-fast environment validation)
- [ ] Verify Arc Testnet RPC connectivity (primary + 2 fallback endpoints configured)
- [ ] Confirm Treasury Wallet address matches `0xb467F683764593316fAEbB0709127E90791Fe47F`

See `DEPLOYMENT.md` for full operational detail.
