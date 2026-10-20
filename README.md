<div align="center">
  <img src="./public/icons/logo.svg" alt="ARCTIS" width="84" height="84" />
  <h1>ARCTIS</h1>
  <p><strong>Programmable money for humans and AI agents.</strong></p>
  <p>AI · Knowledge · Stablecoins · Economic Agents · Identity · Membership</p>
  <p><strong>Built for Arc</strong> · environment-aware · wallet-controlled · USDC-native</p>
  <p><strong>🌐 Website:</strong> <a href="https://arctis-zeta.vercel.app">https://arctis-zeta.vercel.app</a></p>
</div>

---

## What is ARCTIS?

ARCTIS is an **AI operating environment for programmable money** built for Arc. It combines AI assistance, bounded knowledge context, stablecoin operations, human-readable identity, membership and Economic Agents in one product.

The core thesis is not "AI with a wallet". It is a controlled execution pipeline:

```text
Natural-language intent
        ↓
Deterministic interpretation / policy
        ↓
Proposal
        ↓
Live quote + preflight
        ↓
Human review
        ↓
Wallet approval
        ↓
Transaction submitted
        ↓
Processing / confirmation
        ↓
Onchain execution
        ↓
History / proof / accounting
```

> **ARCTIS is the application layer. Arc is the settlement infrastructure.**

### Arc Mainnet core

The mainnet-compatible transaction path uses Arc Mainnet chain ID `5042`, Arc Mainnet RPC `https://rpc.mainnet.arc.io`, Arc Explorer `https://explorer.arc.io`, and Arc's USDC interfaces. The application remains environment-aware so testnet-only routes and contracts are not silently treated as mainnet infrastructure.

See [`docs/ARC_MAINNET_MIGRATION.md`](./docs/ARC_MAINNET_MIGRATION.md) and [`docs/MAINNET_ROADMAP_STATUS.md`](./docs/MAINNET_ROADMAP_STATUS.md) for the release gates and current deployment state.

---

## Smart Contract: ARCTISAgentEscrow

**Path:** `contracts/ARCTISAgentEscrow.sol`
**Compiler:** Solidity 0.8.24 (via Foundry forge 1.7.1, optimizer 200 runs)
**Target chain:** Arc Mainnet — chain ID `5042`

### Purpose

Trustless USDC escrow for AI agent economic agreements. A payer funds a job with USDC, the provider submits work, the payer releases or the payer reclaims after the deadline. Disputes escalate to the contract owner for V1 arbitration.

### Key properties

- Accepts Arc's USDC precompile (`0x3600000000000000000000000000000000000000`) which has `code.length == 0` but is a valid ERC-20 token on Arc
- `transferOwnership` — owner can rotate control post-deployment
- `pause` / `unpause` — emergency circuit breaker
- All state transitions are terminal (no re-entry into a resolved job)
- `_safeTransfer` / `_safeTransferFrom` handle both returning and non-returning ERC-20 patterns

### Constructor

```solidity
constructor(address initialOwner)
```

`initialOwner` must be a non-zero address. On mainnet deployment, pass the treasury EOA `0xb467F683764593316fAEbB0709127E90791Fe47F` or the deployer wallet.

### Deployment

```bash
forge script contracts/script/DeployARCTISAgentEscrow.s.sol \
  --rpc-url https://rpc.mainnet.arc.io \
  --broadcast \
  --verify \
  --verifier blockscout \
  --verifier-url https://explorer.arc.io/api \
  -vvvv
```

Set `OWNER_ADDRESS` env var to override the default (broadcast sender).

### Contract address

| Network | Address | Status |
|---------|---------|--------|
| Arc Mainnet (5042) | _pending deployment approval_ | Not yet deployed |
| Arc Testnet (5042002) | `0xf28541094031BD34bA08Ae98982F4348C9ADB94c` | Deployed (ARCTISAgentEscrow v1, testnet only) |

### Test results

```
forge test -vv   →  23 passed, 0 failed, 0 skipped (Solc 0.8.24)
  ARCTISAgentEscrowTest    11/11  (includes transferOwnership + Arc USDC precompile tests)
  ARCTISAgentTreasuryTest  12/12  (unchanged)
```
