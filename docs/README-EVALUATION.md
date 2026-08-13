# ARCTIS — Evaluation Guide

This page is a fast orientation for Arc/Circle reviewers, hackathon judges and external developers.

## What ARCTIS is

ARCTIS is a programmable-money operating environment built on Arc Testnet. It combines AI assistance, bounded knowledge context, user-controlled stablecoin operations, identity and an Economic Agent safety layer in one product.

The core thesis is not "AI with a wallet". It is:

> **natural-language financial intent → deterministic proposal → live quote → human review → wallet approval → verifiable execution**

## Five-minute reviewer path

1. Open the live demo: `https://arctis-zeta.vercel.app`
2. Connect an Arc Testnet wallet.
3. Open **AI OS → Agents** and inspect the Economic Agent flow.
4. Try a transfer intent using a `.arc` Passport recipient.
5. For Swap, choose `USDC → tUSDC`, `USDC → tARC`, or a Circle-supported pair such as `USDC → EURC`.
6. Observe the quote before any wallet approval. The UI shows the expected receive amount.
7. In Agent mode, verify the state machine: **Propose → Review → live quote → Approve → Execute**.
8. Open Bridge and inspect the Circle CCTP quote, fee breakdown and estimated receive amount before approval.
9. Open Passport to inspect the `.arc` identity/profile surface, including photo add/edit behavior.
10. Open History after a completed operation to inspect the persisted transaction/bridge/swap record.

## Architecture

```text
                         ARCTIS
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
      AI OS          Knowledge OS         DeFi OS
        │                  │                  │
        └──────────────┬───┴───────┬──────────┘
                       ▼           ▼
                 Economic Agent OS  Passport
                       │
                       ▼
             deterministic intent/policy
                       │
                 live quote / preflight
                       │
                human review boundary
                       │
                       ▼
             wallet / Circle App Kit
                       │
                       ▼
               Arc Testnet + rails
                       │
                       ▼
              history / proofs / ledger
```

The repository also contains an animated self-contained SVG architecture overview at [`architecture-flow.svg`](./architecture-flow.svg). The moving dashed paths represent data/control flow; pulsing nodes represent active hand-off points. The animation is intentionally lightweight, CSS/SVG-only, requires no external runtime, and remains readable as a static image.

## What is distinctive

### 1. Agent safety is a product primitive

Agents do not silently spend from a hidden server key. Financial actions pass through a state boundary:

`Propose → Review → Approve → Execute`

Swap and Bridge add a live quote step before wallet approval so the user sees what they are expected to receive.

### 2. Human-readable identity is part of the transaction UX

Passport profiles provide wallet-linked `.arc` usernames and public resolution. Economic Agent recipient entry uses the same canonical Passport validation path as manual transfer entry.

### 3. Arc is infrastructure; ARCTIS is the application

ARCTIS uses Arc Testnet as the settlement environment and integrates Circle rails where configured. The project does not imply an official Circle partnership or endorsement.

### 4. The UI explains state instead of hiding it

Quotes, route availability, preflight failures, wallet approval, processing and completion are explicit states. Testnet route/liquidity limitations are surfaced rather than disguised as successful execution.

## Current scope

- Arc Testnet
- Arc Native USDC as the primary payment/gas asset
- ARCTIS OTC test assets: tUSDC and tARC
- Circle Swap surface including EURC as the final Circle asset in the ARCTIS dropdown; route availability remains dependent on the live Circle/Arc Testnet environment
- Circle App Kit + CCTP bridge flows for configured testnet routes
- Economic Agent OS with budgets, proposals, execution history, reports and evaluation
- Wallet-linked Passport identity and `.arc` username resolution
- Passport photo add/change support
- AI Workspace, Copilot and multiple task-oriented personas
- Knowledge OS based on implemented application context, not full document RAG
- Membership, Credits, Treasury and History surfaces

## Important boundaries

ARCTIS is a testnet-stage project. It is not independently security audited, is not presented as mainnet-ready, and does not claim autonomous custody of user wallets. Some server routes still require additional cryptographic hardening before mainnet.

The exact code/configuration is authoritative. Start with [`ARCHITECTURE_TRUTH.md`](../ARCHITECTURE_TRUTH.md) and [`SYSTEM_ARCHITECTURE.md`](../SYSTEM_ARCHITECTURE.md).

## Repository entry points

- [`README.md`](../README.md) — public overview
- [`ARCHITECTURE_TRUTH.md`](../ARCHITECTURE_TRUTH.md) — canonical capability truth
- [`SYSTEM_ARCHITECTURE.md`](../SYSTEM_ARCHITECTURE.md) — runtime/security architecture
- [`API_REFERENCE.md`](../API_REFERENCE.md) — route inventory
- [`SECURITY.md`](../SECURITY.md) — security posture
- [`DEPLOYMENT.md`](../DEPLOYMENT.md) — setup/deployment
- [`CHANGELOG.md`](../CHANGELOG.md) — recent material changes

