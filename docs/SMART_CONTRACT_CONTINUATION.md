# ARCTIS Smart Contract Continuation Blueprint

**Purpose:** canonical continuation document for future contributors/AI sessions working on the ARCTIS onchain layer.

## Current state — 2026-08-13

ARCTIS has a **testnet-stage Solidity scaffold**, not a production deployment.

Current ARCTIS-owned application contracts:

1. `contracts/ARCTISAgentTreasury.sol` — bounded agent transfer policy vault.
2. `contracts/ARCTISAgentEscrow.sol` — economic job / service escrow primitive.
3. `tUSDC` and `tARC` remain existing ARCTIS OTC test assets.

Arc Native USDC, EURC, Circle Swap and CCTP are infrastructure / third-party rails and must not be represented as ARCTIS-owned contracts.

## Owner / treasury wallet for V1

The current intended Arc Testnet owner, deployer and human approval wallet is:

`0xb467F683764593316fAEbB0709127E90791Fe47F`

This address is public onchain information. **No private key, seed phrase or signing secret belongs in GitHub or this documentation.**

## Non-negotiable architecture boundary

**Do not replace or route the existing transaction rails through the new contracts yet.**

Existing:

```text
Manual Transfer → user wallet
Circle Swap     → existing Circle / ARCTIS rail
CCTP Bridge     → Circle CCTP rail
```

New optional rails:

```text
Agent intent
   ↓
proposal / quote / preflight
   ↓
policy validation
   ↓
human review + wallet authorization
   ↓
ARCTISAgentTreasury

Agent job
   ↓
fund escrow
   ↓
provider work / submission
   ↓
release / refund / dispute
   ↓
ARCTISAgentEscrow
```

Integration is **additive, parallel and feature-flagged** until independent testnet verification is complete.

## Treasury V1 — owner-only proposer model

For the first testnet/hackathon version, ARCTIS deliberately has **no separate relayer wallet**.

The same user-controlled treasury wallet is the:

- deployer;
- owner;
- proposal submitter;
- human approval authority;
- governance boundary.

The agent does **not** hold the Treasury key. It prepares intent, quote and policy information offchain. The owner submits the exact onchain proposal and then explicitly approves it.

This minimizes key-management complexity and attack surface for V1. A separate relayer can be introduced later only when there is a concrete automation requirement.

### Policy controls

Every agent action must be constrained by:

- registered + active agent;
- allowlisted ERC-20 token;
- recipient;
- amount;
- per-transaction cap;
- UTC-day spending cap;
- deadline;
- per-agent nonce;
- exact action hash binding contract + chain + action parameters;
- owner approval;
- replay protection;
- pause/revoke controls.

### State machine

```text
AGENT INTENT / QUOTE
        ↓
OWNER SUBMITS PROPOSAL
        ↓
     PROPOSED
        ↓
OWNER APPROVES / REJECTS
      ↙       ↘
 APPROVED    REJECTED
    ↓
 EXECUTED
```

Expired actions cannot execute.

### Treasury hardening already incorporated

- Same-day spending is preserved when an owner updates an agent policy; changing limits cannot reset the accumulated daily spend bucket.
- Token allowlisting requires a deployed contract address rather than an EOA.
- Zero-value deposits/withdrawals and zero-address withdrawal targets are rejected explicitly.
- Withdrawal is restricted to an allowlisted token.
- The owner-only proposal/approval boundary remains explicit; no relayer key is required in V1.

These changes are still subject to automated compile/test verification before deployment.

## Escrow V1 — intended economic model

```text
CREATED / FUNDED
        ↓
    SUBMITTED
     ↙      ↘
 RELEASED  DISPUTED
             ↙   ↘
        RELEASED  REFUNDED
```

The complete task specification remains offchain. Only a cryptographic `jobHash` is anchored onchain.

V1 deliberately uses **centralized testnet arbitration**. It must never be described as decentralized dispute resolution.

### Escrow hardening already incorporated

- Payer refunds are deadline-gated; a funded/submitted job cannot be refunded before its deadline.
- Terminal states remain one-way and cannot be reused.
- Provider submission remains deadline-bound.
- Dispute resolution remains owner-controlled for the testnet prototype and is explicitly documented as centralized arbitration.

## Verification gates

### Gate A — compiler/toolchain

Use the repository Foundry configuration:

- Solidity `0.8.24`;
- optimizer enabled;
- 200 optimizer runs;
- `test/` as the Foundry test directory;
- Arc Testnet RPC configured through `ARC_TESTNET_RPC_URL`.

### Gate B — unit tests

Treasury coverage must include:

- ownership and authorization;
- agent registration/revocation;
- policy limits and same-day accounting;
- token allowlist;
- proposal/approval/rejection;
- deadline handling;
- execution and replay protection;
- pause behavior;
- ERC-20 success, revert, false-return and empty-return behavior.

Escrow coverage must include:

- creation/funding;
- provider submission;
- payer release;
- deadline refund;
- dispute and owner resolution;
- pause behavior;
- terminal-state replay;
- ERC-20 transfer failure behavior.

### Gate C — fuzz/invariants

At minimum prove that:

- an executed Treasury action cannot execute again;
- Treasury execution never exceeds the configured daily policy;
- revoked agents cannot execute;
- expired actions cannot execute;
- escrow terminal states cannot transition again;
- escrow balance accounting does not release more than the funded amount.

### Gate D — deployment

Only after Gates A–C:

1. Deploy to Arc Testnet with the dedicated owner wallet above.
2. Record chain ID, deployment commit SHA and constructor parameters.
3. Record deployment transaction hashes.
4. Verify both contracts on ArcScan.
5. Execute small isolated testnet flows.
6. Preserve verified addresses in the deployment manifest.

### Gate E — application integration

Only after isolated onchain verification:

```text
Agent proposal
   ↓
frontend/backend preflight
   ↓
Treasury policy preview
   ↓
Human review
   ↓
wallet authorization
   ↓
contract execution
   ↓
receipt confirmation
   ↓
ARCTIS History
```

Keep the existing Transfer / Swap / Bridge paths unchanged while this is enabled behind an explicit feature flag.

## New-chat continuation protocol

A new engineering session should read these files first:

1. `README.md`
2. `ARCHITECTURE_TRUTH.md`
3. `SYSTEM_ARCHITECTURE.md`
4. `ONCHAIN_AGENT_ARCHITECTURE.md`
5. `docs/SMART_CONTRACT_CONTINUATION.md`
6. `contracts/README.md`
7. `contracts/DEPLOYMENT_STEPS.md`
8. `contracts/ARCTISAgentTreasury.sol`
9. `contracts/ARCTISAgentEscrow.sol`
10. `docs/ONCHAIN_AGENT_FLOW.svg`

Then inspect the live repository before assuming any deployment, test result, contract address or integration exists.

## Definition of done for the onchain layer

The work is **not complete** merely because Solidity compiles.

Completion requires:

`compile → unit tests → fuzz/invariants → security review → Arc Testnet deployment → source verification → isolated transactions → regression tests → feature-flagged integration → verified History/audit trail`

Until that chain is complete, describe the contracts as **testnet-stage scaffolding** and never as audited, production-ready or deployed.
