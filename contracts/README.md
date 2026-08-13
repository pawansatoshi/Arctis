# ARCTIS Onchain Agent Layer

This directory contains the first ARCTIS-owned programmable-money contracts.

## Start here for continuation

- [`../docs/SMART_CONTRACT_CONTINUATION.md`](../docs/SMART_CONTRACT_CONTINUATION.md) — canonical smart-contract roadmap, security gates and new-chat continuation protocol.
- [`../docs/ONCHAIN_AGENT_FLOW.svg`](../docs/ONCHAIN_AGENT_FLOW.svg) — educational animated architecture showing the agent, policy, human approval, Treasury and Escrow flows.
- [`../ONCHAIN_AGENT_ARCHITECTURE.md`](../ONCHAIN_AGENT_ARCHITECTURE.md) — detailed architecture and boundaries.

## Contracts

### `ARCTISAgentTreasury.sol`

A testnet-stage policy vault for bounded agent transfers.

V1 provides:

- owner-controlled agent registration and revocation;
- per-agent per-transaction and daily spending limits;
- explicit token allowlisting;
- a dedicated relayer for proposal creation;
- deterministic action hashes containing contract, chain, agent, token, recipient, amount, deadline and nonce;
- mandatory owner approval before execution;
- replay protection through per-agent nonces and one-time proposal state;
- deadline expiry;
- emergency pause;
- owner-only withdrawal;
- event-based execution/audit trail.

**Important:** V1 is deliberately transfer-only. ARCTIS Circle Swap and CCTP Bridge remain on their existing rails and are not routed through this contract.

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

Before any deployment:

1. compile with Solidity `0.8.24`;
2. run unit/invariant/security tests;
3. inspect bytecode and constructor parameters;
4. deploy to Arc Testnet;
5. verify source on ArcScan;
6. perform isolated test transactions;
7. verify pause/revoke/limit/deadline/replay behavior;
8. only then consider application integration.

No private key belongs in the repository. Deployment must be signed by the deployer's wallet or an appropriately secured deployment environment.
