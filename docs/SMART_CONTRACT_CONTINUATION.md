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

## What to build next

### Phase 1 — correctness before integration

1. Compile with Solidity `0.8.24`.
2. Add a proper Foundry test suite for Treasury and Escrow.
3. Test every revert condition and state transition.
4. Add replay, deadline, pause, revoke and spending-limit tests.
5. Test ERC-20 success, false-return and revert behavior.
6. Test zero-address and zero-value inputs.
7. Add invariant/fuzz tests around treasury spending limits and escrow balances.
8. Review event completeness and indexed fields.

### Phase 2 — security hardening

Before deployment, review at minimum:

- reentrancy assumptions around token calls;
- checks-effects-interactions ordering;
- daily bucket accounting;
- proposal approval versus execution-time policy changes;
- nonce uniqueness;
- stale/expired proposals;
- revoked agents;
- token allowlist changes;
- pause semantics;
- owner withdrawal authority;
- escrow dispute/refund edge cases;
- malicious/non-standard ERC-20 behavior.

Use established OpenZeppelin patterns/dependencies where appropriate rather than hand-rolling security primitives.

### Phase 3 — Arc Testnet deployment

Deploy only with the dedicated test wallet above and use only testnet assets.

Record in a deployment manifest:

- chain ID;
- deployer/owner address;
- contract address;
- constructor parameters;
- deployment transaction hash;
- verification URL;
- deployment commit SHA.

Then verify source on ArcScan and perform isolated test transactions.

**Never commit a private key or secret.**

### Phase 4 — application integration

Only after the contract suite and isolated testnet flow are green:

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
