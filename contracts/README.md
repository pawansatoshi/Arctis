# ARCTIS Onchain Agent Layer

This directory contains the first ARCTIS-owned programmable-money contracts.

## Start here for continuation

- [`../docs/SMART_CONTRACT_CONTINUATION.md`](../docs/SMART_CONTRACT_CONTINUATION.md) — canonical smart-contract roadmap, security gates and continuation protocol.
- [`../docs/ONCHAIN_AGENT_FLOW.svg`](../docs/ONCHAIN_AGENT_FLOW.svg) — educational architecture showing the agent, policy, human approval, Treasury and Escrow flows.
- [`../ONCHAIN_AGENT_ARCHITECTURE.md`](../ONCHAIN_AGENT_ARCHITECTURE.md) — detailed architecture and boundaries.

## Contracts

### `ARCTISAgentTreasury_ARC_USDC_FIX.sol`

**Canonical V1 Treasury implementation for Arc Testnet.** Use this file for compilation, deployment, verification and future development.

**Current Arc Testnet deployment:**

```text
Contract: ARCTISAgentTreasury
Address:  0xf28541094031BD34bA08Ae98982F4348C9ADB94c
ArcScan:  https://testnet.arcscan.app/address/0xf28541094031BD34bA08Ae98982F4348C9ADB94c
Deploy tx: https://testnet.arcscan.app/tx/0xc4447c1044327ee4eac001816161ce61c1f5d146f6e7404bd56a3889c66e820d
```

The ArcScan source is verified as an exact match for the deployed `ARCTISAgentTreasury` contract using Solidity `0.8.24`, optimizer enabled with 200 runs.

This version is specifically maintained for the Arc Testnet USDC environment, where Arc USDC is exposed through the protocol precompile at `0x3600000000000000000000000000000000000000` and therefore does not have ordinary EVM bytecode.

V1 provides:

- owner-controlled agent registration and revocation;
- per-agent per-transaction and daily spending limits;
- explicit token allowlisting with Arc USDC precompile support;
- owner-only proposal creation in V1;
- deterministic action hashes containing contract, chain, agent, token, recipient, amount, deadline and nonce;
- mandatory owner approval before execution;
- replay protection through per-agent nonces and one-time proposal state;
- deadline expiry;
- emergency pause;
- owner-only withdrawal;
- event-based execution/audit trail.

**Important:** V1 deliberately has no separate relayer key. The owner-controlled wallet submits and approves proposals. A separate relayer may be introduced later only when there is a concrete automation requirement and a separate security model has been reviewed.

**Important:** V1 is deliberately transfer-only. ARCTIS Circle Swap and CCTP Bridge remain on their existing rails and are not routed through this contract.

### Legacy Treasury source

`ARCTISAgentTreasury.sol` is a legacy implementation and is **not the canonical Treasury source**. It should not be compiled, deployed, verified, or referenced for the current Arc Testnet deployment. Remove the legacy file from the repository to prevent source/deployment confusion.

### `ARCTISAgentEscrow.sol`

A testnet-stage economic-agreement primitive for agent/service jobs.

V1 provides:

- payer-funded jobs;
- provider identity;
- token + amount locking;
- hashed job specification (`jobHash`);
- deadline;
- provider submission;
- payer release;
- payer refund rules;
- dispute state;
- owner arbitration for testnet disputes;
- emergency pause;
- event-based lifecycle proof.

**Deployment status:** The Escrow source is present in the repository, but no deployed Arc Testnet Escrow address is currently documented or claimed here.

## Why these contracts are additive

Existing ARCTIS Transfer, Circle Swap and CCTP Bridge flows remain unchanged. The contracts are initially deployed and tested independently. They should only be connected to the application behind an explicit feature flag after testnet verification.

```text
Existing ARCTIS rails
  Transfer → user wallet
  Swap     → ARCTIS OTC / Circle rail
  Bridge   → Circle CCTP

New optional agent rails
  Agent intent → quote → policy → human approval → Agent Treasury
  Agent job    → funding → submission → release/refund → Agent Escrow
```

## Deployment safety

These contracts are **not audited** and must not hold meaningful funds. Use only testnet assets and a dedicated test wallet.

For the current Treasury deployment, the canonical source is **`ARCTISAgentTreasury_ARC_USDC_FIX.sol`**, deployed at the address documented above.

Before any future deployment:

1. compile the canonical source with Solidity `0.8.24`;
2. run unit/invariant/security tests;
3. inspect bytecode and constructor parameters;
4. deploy to Arc Testnet;
5. verify the exact deployed source on ArcScan;
6. perform isolated test transactions;
7. verify pause/revoke/limit/deadline/replay behavior;
8. only then consider application integration.

No private key belongs in the repository. Deployment must be signed by the deployer's wallet or an appropriately secured deployment environment.
