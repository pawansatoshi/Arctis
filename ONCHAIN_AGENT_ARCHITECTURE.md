# ARCTIS — Onchain Agent Architecture

**Status: testnet-stage implementation; Agent Treasury V1 is deployed and source-verified on Arc Testnet. Escrow remains scaffolded and intentionally not deployed.**

> Educational architecture animation: [`docs/ONCHAIN_AGENT_FLOW.svg`](./docs/ONCHAIN_AGENT_FLOW.svg)
>
> Continuation source of truth: [`docs/SMART_CONTRACT_CONTINUATION.md`](./docs/SMART_CONTRACT_CONTINUATION.md)

This document defines the first ARCTIS-owned smart-contract layer. It is deliberately additive: existing Transfer, Swap and Bridge rails remain unchanged. The deployed Treasury is independently verifiable; Escrow is retained as an optional future/testnet extension and is not part of the current live demo.

## 1. Why an onchain layer

ARCTIS already has an off-chain agent workflow:

`intent → proposal → validation → live quote → expected receive → human review → wallet approval → execution`

The onchain layer adds enforceable economic policy and verifiable state rather than replacing the existing wallet-controlled transaction rails.

## 2. Contract set

ARCTIS currently targets the following application-layer assets/contracts:

| Contract | Status | Role |
|---|---|---|
| tUSDC | Existing | ARCTIS OTC test asset |
| tARC | Existing | ARCTIS OTC test asset |
| ARCTISAgentTreasury_ARC_USDC_FIX.sol | **Deployed + source-verified on Arc Testnet** | Bounded agent transfer policy vault |
| ARCTISAgentEscrow.sol | **Scaffolded; not deployed** | Optional agent/service economic agreement primitive |

**Verified Treasury deployment**

```text
Contract: ARCTISAgentTreasury
Address:  0xf28541094031BD34bA08Ae98982F4348C9ADB94c
ArcScan:  https://testnet.arcscan.app/address/0xf28541094031BD34bA08Ae98982F4348C9ADB94c
Deploy tx: https://testnet.arcscan.app/tx/0xc4447c1044327ee4eac001816161ce61c1f5d146f6e7404bd56a3889c66e820d
```

ArcScan confirms the deployed Treasury source as an exact match using Solidity `0.8.24` with optimizer enabled and 200 runs.

Arc Native USDC, EURC, CCTP and Circle Swap contracts are third-party/infrastructure assets and must never be presented as ARCTIS-owned deployments.

## 3. Treasury V1 — owner-only proposal boundary

`ARCTISAgentTreasury_ARC_USDC_FIX.sol` is intentionally narrow.

### Roles

- **Owner:** `0xb467F683764593316fAEbB0709127E90791Fe47F`, the current Arc Testnet deployer/owner and human approval wallet.
- **Agent:** represented by a registered `bytes32 agentId`; it does not own the treasury or receive a private key.
- **Executor:** anyone can submit an already-approved action; execution does not grant Treasury authority.
- **Separate relayer:** deliberately omitted from V1 to minimize key-management complexity.

The same testnet wallet currently also serves as the normal ARCTIS payment/revenue treasury wallet. This is an explicit testnet architecture choice; it does not make the wallet the Treasury contract itself.

### Policy

Each registered agent has:

- maximum amount per transaction;
- maximum amount per UTC-day bucket;
- active/revoked state;
- explicit allowed-token set at the treasury level.

### State machine

```text
AGENT INTENT / QUOTE
        ↓
OWNER PROPOSES
        ↓
POLICY CHECK
        ↓
PROPOSED
        ↓
OWNER APPROVES / REJECTS
      ↙       ↘
 APPROVED    REJECTED
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

## 4. Escrow V1 — future/testnet extension

`ARCTISAgentEscrow.sol` models an economic job:

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

V1 supports the intended testnet model of payer funding, provider submission, payer release, payer refund, dispute, centralized testnet arbitration, deadline and pause.

**Current status:** the Solidity source and tests exist in the repository, but the Escrow contract is **not deployed and is not integrated into the current application/demo**. Do not claim an Escrow contract address or live Escrow execution until a separate deployment and ArcScan verification are completed.

## 5. Existing rails remain isolated

```text
MANUAL TRANSFER
user wallet ───────────────→ recipient

CIRCLE SWAP
user / ARCTIS flow ────────→ Circle Swap rail

CCTP BRIDGE
source wallet ─────────────→ Circle CCTP

OPTIONAL AGENT TREASURY
agent intent → quote → policy → owner approval → Treasury

FUTURE OPTIONAL AGENT ESCROW
job → fund → work → submit → release/refund
```

No existing transaction route depends on Escrow merely because its Solidity source exists. The current recorded demo does not include Escrow.

## 6. Integration gate

The deployed Treasury remains an independently verifiable onchain foundation. It should only be connected to the application after the remaining integration gates are completed. Escrow remains behind a separate future deployment/integration gate.

For either contract, application integration requires:

1. Solidity compilation succeeds with `0.8.24`.
2. Unit tests cover happy and failure paths.
3. Replay, deadline, pause, revoke and spending-limit cases are tested where applicable.
4. Deployment constructor parameters are reviewed.
5. Arc Testnet deployment parameters and transaction are recorded.
6. Source is verified on ArcScan.
7. Small isolated testnet flows succeed.
8. Existing ARCTIS Transfer/Swap/Bridge regression tests remain green.
9. The feature is enabled behind an explicit application flag.

## 7. Deployment parameters

### Treasury

```text
source = contracts/ARCTISAgentTreasury_ARC_USDC_FIX.sol
initialOwner = 0xb467F683764593316fAEbB0709127E90791Fe47F
address = 0xf28541094031BD34bA08Ae98982F4348C9ADB94c
deployTx = 0xc4447c1044327ee4eac001816161ce61c1f5d146f6e7404bd56a3889c66e820d
```

V1 has no separate relayer constructor parameter.

### Escrow

```text
source = contracts/ARCTISAgentEscrow.sol
status = not deployed
```

Do not add an Escrow address until a real Arc Testnet deployment is performed and independently verified.

Only public wallet addresses belong in repository documentation. Never store a private key or seed phrase.

## 8. Security posture

These contracts are **not independently audited**. They are a testnet engineering implementation and must not hold meaningful funds.

Before mainnet consideration, use audited dependencies/patterns where practical, add comprehensive automated testing, conduct an independent security review, and review the custody/authorization model with the threat model for the final product.
