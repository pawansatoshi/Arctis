# ARCTIS — Architecture Truth

**Status:** current implementation baseline on `main` as of 2026-08-20.

This is the canonical product/capability reference. When documentation conflicts with runtime configuration, the code/configuration wins and the documentation must be corrected.

## 1. Product model

ARCTIS is a programmable-money operating environment built on Arc Testnet. It combines:

1. **AI OS** — AI Workspace, Copilot and task-oriented personas with automatic backend model routing.
2. **Knowledge OS** — workspaces, saved prompts, sessions, agents and bounded report context.
3. **DeFi OS** — user-controlled transfers, ARCTIS OTC swaps and configured cross-chain USDC bridge flows.
4. **Economic Agent OS** — budgeted agents, proposals, live quotes, human approval, execution history, reports and evaluation.

Passport, Membership, Credits and Treasury support these pillars as platform/finance surfaces.

The intended product story is:

`Identity → Membership → Money → Knowledge → Agents → controlled economic action`

## 2. Financial safety truth

The mandatory financial pipeline is:

```text
intent → deterministic parse → proposal → route/recipient validation
→ live quote/preflight → human review → wallet approval
→ execution → confirmation → history/proof
```

Agents do not receive a hidden user private key and do not silently sign user-wallet Transfer/Swap/Bridge transactions.

Transaction state distinguishes:

`Wallet approval → Submitted → Processing/Confirming → Confirmed / Failed`

A transaction hash alone is not treated as final success.

## 3. DeFi OS truth

### Transfer

The user's wallet signs the transaction. Server routes coordinate/verify/record operations where required but do not hold the user's signing authority.

### Swap

ARCTIS has:

1. **ARCTIS OTC:** USDC ↔ tUSDC ↔ tARC using a counterparty settlement wallet.
2. **Circle rail:** configured Circle-supported swap handling, including EURC where live routes are available.

### Bridge

The bridge uses Circle App Kit with a Viem adapter and configured CCTP testnet metadata for Arc Testnet, Ethereum Sepolia, Base Sepolia and Arbitrum Sepolia, subject to current route/policy availability.

## 4. Economic Agent OS truth

The current live product flow is wallet-controlled:

```text
Agent intent
   ↓
Proposal
   ↓
Recipient / route validation
   ↓
Live quote + preflight
   ↓
Expected receive shown
   ↓
Human review
   ↓
Wallet approval
   ↓
Transaction submitted
   ↓
Processing / confirmation
   ↓
Confirmed / failed
   ↓
Persist execution / report / ledger
```

## 5. Onchain application-layer truth

ARCTIS includes an ARCTIS-owned Solidity layer for bounded Economic Agent capabilities. It is additive and does not replace the existing Transfer, Swap or Bridge rails.

### Agent Treasury — deployed

Canonical source:

`contracts/ARCTISAgentTreasury_ARC_USDC_FIX.sol`

Verified Arc Testnet deployment:

```text
Contract: ARCTISAgentTreasury
Address: 0xf28541094031BD34bA08Ae98982F4348C9ADB94c
ArcScan: https://testnet.arcscan.app/address/0xf28541094031BD34bA08Ae98982F4348C9ADB94c
Deploy tx: 0xc4447c1044327ee4eac001816161ce61c1f5d146f6e7404bd56a3889c66e820d
Block: 56815151
Solidity: 0.8.24
Optimizer: enabled, 200 runs
```

ArcScan source verification is recorded as an exact match.

Treasury V1 provides bounded agent transfer policy controls including agent registration/revocation, per-transaction and daily limits, token allowlisting, deterministic action binding, owner approval, nonce/replay protection, deadlines, pause and event-based execution/audit trail.

The current testnet owner/deployer/human-approval wallet is:

`0xb467F683764593316fAEbB0709127E90791Fe47F`

That same wallet is currently also configured as the normal ARCTIS payment/revenue treasury wallet. It is **not** the Agent Treasury contract.

V1 deliberately has no separate relayer key. The owner wallet remains the proposal and approval boundary.

### Agent Escrow — not deployed

Canonical source:

`contracts/ARCTISAgentEscrow.sol`

Status:

**Scaffolded/test-covered, not deployed, not integrated into the current UI/API/demo.**

The source models future/testnet economic jobs with funding, provider submission, release/refund, dispute, deadline and centralized testnet arbitration. No Escrow contract address is claimed.

Do not modify the current live Transfer, Swap, Bridge or Economic Agent demo merely to add Escrow. If Escrow is resumed later, it must have its own deployment, ArcScan verification, isolated tests, regression checks and explicit feature flag.

## 6. Existing rails remain isolated

```text
Manual Transfer → user wallet
Circle Swap     → existing Circle / ARCTIS rail
CCTP Bridge     → Circle CCTP rail

Optional Agent Treasury
intent → quote → policy → human approval → Treasury

Future Optional Agent Escrow
job → fund → work → submit → release/refund
```

The current recorded demo does not include Escrow.

## 7. Passport / Membership / Knowledge truth

Passport is the wallet-linked identity/profile layer with `.arc` username creation and resolution. Membership and Credits are first-class account surfaces. Knowledge OS currently provides workspaces, saved prompts, sessions, agents and bounded report context; it is not presented as a full PDF/OCR/vector-RAG platform.

## 8. Security boundary

The intended money-control boundary is:

```text
User intent
   ↓
Validation / policy
   ↓
Server coordination + verification
   ↓
User wallet / Circle App Kit signing
   ↓
Onchain settlement
   ↓
Receipt confirmation
   ↓
Persistence / explorer / history
```

Important testnet limitation: not every mutating API route currently has the same cryptographic wallet-proof level. See `SECURITY.md` for route-level posture and remaining hardening work.

## 9. Configuration sources of truth

- AI personas → `src/config/ai.ts`
- Billing → `src/config/billing.ts`
- Arc/native executable assets → `src/config/assets.ts`
- Network/contracts → `src/lib/contracts.ts`
- Circle Swap pair logic → `src/lib/swap/circle.ts`
- Bridge policy → `src/lib/bridge/policy.ts`
- AI routing → `src/lib/ai/router/`

Never duplicate mutable configuration values in documentation or UI when they can be derived from code.

## 10. Product claims policy

Use precise language:

- **Built on Arc** — yes.
- **Arc Testnet** — yes.
- **Uses Circle tooling** — yes where the repository actually integrates it.
- **Official Circle/Arc partner** — do not claim unless formally approved.
- **Production-ready/mainnet** — do not claim while the product remains testnet-stage.
- **Autonomous wallet custody** — do not claim.
- **Official tARC token** — do not claim.
- **Agent Treasury deployed** — yes, with the exact ArcScan evidence recorded above.
- **Agent Escrow deployed** — no; it is intentionally not deployed.

## 11. Security posture

The ARCTIS-owned contracts are **not independently audited** and are testnet-stage engineering implementations. They must not hold meaningful funds. Mainnet consideration requires comprehensive testing, independent security review and a final authorization/custody design review.
