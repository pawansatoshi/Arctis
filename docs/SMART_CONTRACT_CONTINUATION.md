# ARCTIS Smart Contract Continuation Blueprint

**Purpose:** canonical continuation document for future contributors/AI sessions working on the ARCTIS onchain layer.

## Current state — 2026-08-20

ARCTIS has a **testnet-stage Solidity implementation**. The canonical Treasury V1 contract is deployed and source-verified on Arc Testnet. Escrow remains source/test coverage only and is intentionally **not deployed or integrated** so the current application and recorded demo remain unchanged.

Current ARCTIS-owned application contracts:

1. `contracts/ARCTISAgentTreasury_ARC_USDC_FIX.sol` — canonical bounded agent transfer policy vault; **deployed + source-verified**.
2. `contracts/ARCTISAgentEscrow.sol` — economic job / service escrow primitive; **scaffolded, not deployed**.
3. `tUSDC` and `tARC` remain existing ARCTIS OTC test assets.

The legacy `contracts/ARCTISAgentTreasury.sol` file is not the canonical deployment source and must not be used for deployment/verification.

Arc Native USDC, EURC, Circle Swap and CCTP are infrastructure / third-party rails and must not be represented as ARCTIS-owned contracts.

## Verified Treasury deployment

```text
Contract: ARCTISAgentTreasury
Address: 0xf28541094031BD34bA08Ae98982F4348C9ADB94c
ArcScan: https://testnet.arcscan.app/address/0xf28541094031BD34bA08Ae98982F4348C9ADB94c
Deploy tx: https://testnet.arcscan.app/tx/0xc4447c1044327ee4eac001816161ce61c1f5d146f6e7404bd56a3889c66e820d
```

ArcScan source verification is recorded as an exact match for Solidity `0.8.24`, optimizer enabled, 200 runs.

## Owner / treasury wallet for V1

The current Arc Testnet owner/deployer and human approval wallet is:

`0xb467F683764593316fAEbB0709127E90791Fe47F`

The same testnet wallet is also currently configured as the normal ARCTIS payment/revenue treasury wallet. This is a deliberate testnet configuration. It is **not** the Treasury contract address.

The Agent Treasury contract is:

`0xf28541094031BD34bA08Ae98982F4348C9ADB94c`

This address is public onchain information. **No private key, seed phrase or signing secret belongs in GitHub or this documentation.**

## Non-negotiable architecture boundary

**Do not replace or route the existing transaction rails through the new contracts.** The current demo and application flows remain unchanged.

Existing:

```text
Manual Transfer → user wallet
Circle Swap     → existing Circle / ARCTIS rail
CCTP Bridge     → Circle CCTP rail
```

Current optional agent rail:

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
```

Future optional rail, not currently deployed:

```text
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

Integration is **additive, parallel and feature-flagged**. Escrow must remain unintegrated until its own deployment, source verification, isolated tests and regression checks are complete.

## Treasury V1 — owner-only proposer model

For the first testnet/hackathon version, ARCTIS deliberately has **no separate relayer wallet**.

The same user-controlled testnet wallet is the:

- deployer;
- owner;
- proposal submitter;
- human approval authority;
- governance boundary;
- current normal payment/revenue treasury wallet.

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

## Escrow V1 — intentionally frozen for the current demo

The source contract and tests remain in the repository for future development, but **Escrow is not deployed and is not integrated into the current ARCTIS UI/API/demo**.

Do not change existing Transfer, Swap, Bridge or Economic Agent flows merely to introduce Escrow. A future Escrow implementation must be isolated, separately deployed and feature-flagged.

## Verification gates

### Treasury — current evidence

- Canonical source: `contracts/ARCTISAgentTreasury_ARC_USDC_FIX.sol`.
- Arc Testnet deployment recorded.
- ArcScan source verification recorded as exact match.
- Deployment address recorded in repository configuration and documentation.
- Existing application rails remain unchanged.

Remaining application integration work must still preserve the existing regression/demo behavior.

### Escrow — future gate

Before Escrow is ever called deployed/verified/integrated:

1. compile with Solidity `0.8.24`;
2. run unit tests;
3. run fuzz/invariant/security tests as appropriate;
4. inspect constructor/bytecode;
5. deploy to Arc Testnet using the current secured deployer wallet or an appropriately secured deployment environment;
6. record the deployment transaction and address;
7. verify exact source on ArcScan;
8. run isolated `createJob → fund → submit → release` and refund/dispute tests;
9. confirm existing ARCTIS Transfer/Swap/Bridge regression tests remain green;
10. integrate only behind an explicit feature flag.

Until these gates are complete, **do not claim an Escrow contract address or live Escrow execution**.

## Security posture

These contracts are **not independently audited**. They are testnet engineering implementations and must not hold meaningful funds.

Before mainnet consideration, use audited dependencies/patterns where practical, add comprehensive automated testing, conduct an independent security review, and review the custody/authorization model with the final product threat model.

## New-chat continuation protocol

A new engineering session should read these files first:

1. `README.md`
2. `ARCHITECTURE_TRUTH.md`
3. `SYSTEM_ARCHITECTURE.md`
4. `ONCHAIN_AGENT_ARCHITECTURE.md`
5. `docs/SMART_CONTRACT_CONTINUATION.md`
6. `contracts/README.md`
7. `contracts/DEPLOYMENT_STEPS.md`
8. `contracts/ARCTISAgentTreasury_ARC_USDC_FIX.sol`
9. `contracts/ARCTISAgentEscrow.sol`
10. `docs/ONCHAIN_AGENT_FLOW.svg`

Then inspect the live repository before assuming any deployment, test result, contract address or integration exists.

## Definition of done for any future onchain feature

The work is **not complete** merely because Solidity compiles.

Completion requires:

`compile → unit tests → fuzz/invariants → security review → Arc Testnet deployment → source verification → isolated transactions → regression tests → feature-flagged integration → verified History/audit trail`

Until that chain is complete, describe future contracts as **testnet-stage** and never as audited, production-ready or fully integrated.
