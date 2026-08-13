# ARCTIS — Onchain Agent Architecture

**Status: design + testnet implementation scaffold. Not deployed yet.**

This document defines the first ARCTIS-owned smart-contract layer. It is deliberately additive: existing Transfer, Swap and Bridge rails remain unchanged until these contracts are independently tested and explicitly integrated.

## 1. Why an onchain layer

ARCTIS already has an off-chain agent workflow:

`intent → proposal → validation → live quote → expected receive → human review → wallet approval → execution`

The onchain layer adds enforceable economic policy and verifiable state rather than replacing the existing wallet-controlled transaction rails.

## 2. Contract set

ARCTIS currently targets **four application contracts total**:

| Contract | Status | Role |
|---|---|---|
| tUSDC | Existing | ARCTIS OTC test asset |
| tARC | Existing | ARCTIS OTC test asset |
| ARCTISAgentTreasury | Scaffolded; not deployed | Bounded agent transfer policy vault |
| ARCTISAgentEscrow | Scaffolded; not deployed | Agent/service economic agreement primitive |

Arc Native USDC, EURC, CCTP and Circle Swap contracts are third-party/infrastructure assets and must never be presented as ARCTIS-owned deployments.

## 3. Treasury V1

`ARCTISAgentTreasury` is intentionally narrow.

### Roles

- **Owner:** user's controlling/admin wallet for the testnet deployment.
- **Relayer:** dedicated orchestration identity allowed to create proposals.
- **Agent:** represented by a registered `bytes32 agentId`; it does not own the treasury.
- **Executor:** anyone can submit an already-approved action, avoiding relayer custody.

### Policy

Each registered agent has:

- maximum amount per transaction;
- maximum amount per UTC-day bucket;
- active/revoked state;
- explicit allowed-token set at the treasury level.

### State machine

```text
RELAYER PROPOSES
      ↓
POLICY CHECK
      ↓
PROPOSED
      ↓
OWNER APPROVES / REJECTS
      ↓
APPROVED
      ↓
ANYONE EXECUTES
      ↓
EXECUTED
```

An action is bound to:

- contract address;
- chain ID;
- agent ID;
- token;
- recipient;
- amount;
- deadline;
- per-agent nonce.

This prevents an approval for one action from being reused for a different action.

### V1 limitation

Treasury execution is **transfer-only**. Swap and Bridge are intentionally excluded. Circle Swap and CCTP remain the settlement rails for those operations.

## 4. Escrow V1

`ARCTISAgentEscrow` models an economic job:

```text
CREATED/FUNDED
      ↓
   SUBMITTED
   ↙       ↘
RELEASED   DISPUTED
             ↙   ↘
       RELEASED  REFUNDED
```

The job stores a hash of the task specification rather than storing the full task onchain.

V1 supports:

- payer funding;
- provider submission;
- payer release;
- payer refund after the defined condition;
- dispute;
- explicit testnet owner arbitration;
- deadline;
- pause.

The arbitration model is intentionally centralized for the testnet prototype and must not be described as decentralized dispute resolution.

## 5. Existing rails remain isolated

```text
MANUAL TRANSFER
user wallet ───────────────→ recipient

CIRCLE SWAP
user / ARCTIS flow ────────→ Circle Swap rail

CCTP BRIDGE
source wallet ─────────────→ Circle CCTP

OPTIONAL AGENT TREASURY
agent proposal → policy → human approval → Treasury

OPTIONAL AGENT ESCROW
job → fund → work → submit → release/refund
```

No existing transaction route should depend on Treasury or Escrow merely because the contracts exist.

## 6. Integration gate

The application may integrate these contracts only after:

1. Solidity compilation succeeds with `0.8.24`.
2. Unit tests cover all happy paths and failure paths.
3. Replay, deadline, pause, revoke and spending-limit cases are tested.
4. Token transfer failure behavior is tested.
5. Deployment constructor parameters are reviewed.
6. Contracts are deployed to Arc Testnet using a dedicated test wallet.
7. Sources are verified on ArcScan.
8. A small testnet deposit/action/withdraw cycle succeeds.
9. Existing ARCTIS Transfer/Swap/Bridge regression tests remain green.
10. The feature is enabled behind an explicit application flag.

## 7. Deployment parameters

### Treasury

```text
initialOwner  = the owner's Arc Testnet wallet
initialRelayer = a dedicated relayer/orchestration wallet
```

Do not use the user's main wallet as an application relayer key. Do not commit either private key.

### Escrow

```text
initialOwner = the owner's Arc Testnet wallet
```

## 8. Security posture

These contracts are **not audited**. They are a testnet engineering scaffold and must not hold meaningful funds.

Before mainnet consideration, use audited dependencies/patterns where practical, add comprehensive automated testing, conduct an independent security review, and review the custody/authorization model with the threat model for the final product.
