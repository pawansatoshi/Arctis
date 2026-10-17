# ARCTIS — Arc Hackathon Submission

**Date:** 2026-10-13
**Branch:** `feat/hackathon-final`
**Base:** `main` at commit `548f039` (PR #23 merged)

---

## Demo URL

**https://arctis-zeta.vercel.app** (production — Testnet mode)

Preview (feat/hackathon-final Vercel CI): available after PR #24 CI completes.

---

## GitHub Repository

**https://github.com/pawansatoshi/Arctis**

| Branch | Purpose |
|--------|---------|
| `main` | Production codebase (PR #23 merged) |
| `feat/hackathon-final` | This submission — contract fixes + deployment script |
| `backup/ARCTIS-TESTNET-KNOWN-GOOD-2026-10-13` | Protected Testnet backup |

---

## Smart Contract

### Contract: ARCTISAgentEscrow

**Path:** `contracts/ARCTISAgentEscrow.sol`
**Purpose:** Trustless USDC escrow for AI agent economic agreements.
An AI agent (payer) posts a job by depositing USDC; a provider completes the work and submits a result hash; the payer releases payment or reclaims after the deadline. Disputes escalate to the contract owner for V1 arbitration.

**Compiler:** Solidity `0.8.24`
**Toolchain:** Foundry forge `1.7.1`
**Optimizer:** enabled, 200 runs
**Target chain:** Arc Mainnet — chain ID `5042`
**Constructor:** `ARCTISAgentEscrow(address initialOwner)`

### What changed in this branch (vs. original)

| Fix | Reason |
|-----|--------|
| Arc USDC precompile exemption in `createJob` | Arc USDC at `0x3600...0000` has `code.length == 0` but is a valid ERC-20. Without this, every `createJob` with USDC would revert `InvalidTokenContract` on mainnet. Fix mirrors existing Treasury contract pattern. |
| `transferOwnership(address)` added | SEV-I from audit. Owner rotation was impossible post-deploy; now the deployer can hand off to a multisig or contract without redeploying. |
| `owner` changed from `immutable` to mutable `address` | Required to support `transferOwnership`. |

### Test results (actual, run this session)

```
forge test -vv
Compiling 4 files with Solc 0.8.24
Compiler run successful!

Ran 11 tests for test/ARCTISAgentEscrow.t.sol:ARCTISAgentEscrowTest
[PASS] testArcUsdcPrecompileIsAccepted()          (gas: 551696)
[PASS] testCreateSubmitReleaseLifecycle()          (gas: 231846)
[PASS] testDisputeAndOwnerResolution()             (gas: 211019)
[PASS] testERC20FalseReturnAndRevertAreRejected()  (gas: 735773)
[PASS] testInvalidTokenContractAndJobHashAreRejected() (gas: 23088)
[PASS] testPauseBlocksLifecycleMutations()         (gas: 239793)
[PASS] testProviderSubmissionIsDeadlineBound()     (gas: 217134)
[PASS] testRefundRequiresDeadline()                (gas: 202143)
[PASS] testTerminalStateCannotBeReused()           (gas: 220765)
[PASS] testTransferOwnershipToZeroReverts()        (gas: 11366)
[PASS] testTransferOwnershipWorks()                (gas: 14723)
Suite result: ok. 11 passed; 0 failed

Ran 12 tests for test/ARCTISAgentTreasury.t.sol:ARCTISAgentTreasuryTest
[PASS] testAllowlistChangeBlocksApprovedAction()   (gas: 216998)
[PASS] testDailyLimitAcrossExecutedActions()       (gas: 272493)
[PASS] testExpiredActionCannotExecute()            (gas: 215594)
[PASS] testFuzz_DailyLimitEnforced(uint96,uint96)  (runs: 256)
[PASS] testOwnerOnlyBoundary()                     (gas: 170476)
[PASS] testPauseBlocksMutatingEconomicActions()    (gas: 240864)
[PASS] testPolicyUpdatePreservesSameDaySpent()     (gas: 283045)
[PASS] testProposalApprovalExecutionAndReplayProtection() (gas: 272869)
[PASS] testRejectAndApprovalAreMutuallyExclusive() (gas: 213588)
[PASS] testRevokedAgentCannotExecuteApprovedAction() (gas: 211688)
[PASS] testRevokedTokenCanStillBeWithdrawn()       (gas: 45621)
[PASS] testWithdrawRequiresPositiveAmount()        (gas: 44298)
Suite result: ok. 12 passed; 0 failed

Total: 23 passed, 0 failed, 0 skipped
```

### Deployment status

| Network | Address | Tx hash | Explorer |
|---------|---------|---------|---------|
| Arc Mainnet (5042) | **PENDING — awaiting wallet approval** | — | — |
| Arc Testnet (5042002) | `0xf28541094031BD34bA08Ae98982F4348C9ADB94c` | on-chain | https://explorer.testnet.arc.io/address/0xf28541094031BD34bA08Ae98982F4348C9ADB94c |

### Deployment command (ready to execute — requires wallet approval)

```bash
# Set OWNER_ADDRESS to the wallet that will own the contract on mainnet.
# Default is the broadcast sender (deployer).
export OWNER_ADDRESS=0xb467F683764593316fAEbB0709127E90791Fe47F

forge script contracts/script/DeployARCTISAgentEscrow.s.sol \
  --rpc-url https://rpc.mainnet.arc.io \
  --broadcast \
  --verify \
  --verifier blockscout \
  --verifier-url https://explorer.arc.io/api \
  -vvvv
```

**Required wallet action:** sign one deployment transaction from the deployer wallet.
Arc Mainnet uses USDC as native gas. The deployer wallet (`0xb467...Fe47F`) has a confirmed Arc Mainnet USDC balance (on-chain verified: `eth_getBalance` → `1.006 native-USDC`). Estimated gas is minimal (~500k gas units at standard Arc gas price).

---

## Application Architecture

### Testnet / Mainnet separation

| Layer | Testnet | Mainnet |
|-------|---------|---------|
| Chain ID | 5042002 | 5042 |
| RPC | `https://rpc.testnet.arc.io` | `https://rpc.mainnet.arc.io` |
| Explorer | `https://explorer.testnet.arc.io` | `https://explorer.arc.io` |
| USDC | `0x3600000000000000000000000000000000000000` | `0x3600000000000000000000000000000000000000` |
| Treasury EOA | `0xf28541094031BD34bA08Ae98982F4348C9ADB94c` | `0xb467F683764593316fAEbB0709127E90791Fe47F` |
| Swap/Bridge | Enabled | **Disabled (503)** |
| Build-time default | `testnet` | requires `NEXT_PUBLIC_NETWORK_ENV=mainnet` |

### Network selection

The app is environment-aware at three levels:
1. **Build-time** (`contracts.ts`): `NEXT_PUBLIC_NETWORK_ENV` sets module-level exports (`CHAIN_ID`, `RPC_URL`, etc.). Defaults to `testnet` when absent.
2. **Client-side** (`network/profile.ts`): `getSelectedNetworkEnv()` reads `localStorage` → `arctis-network-env`. UI components read this; wallets switch to the selected chain.
3. **Server-side** (`verify.ts`): every payment API call passes `network` explicitly in the request body. The verifier selects the matching RPC client and asserts `tx.chainId` against the declared network.

### Payment security

Every USDC membership and credit payment is verified server-side:
- Chain ID assertion: `tx.chainId === profile.chainId`
- Sender binding: `tx.from === authenticated wallet`
- Exact ERC-20 Transfer log: from sender, to treasury, exact amount
- Mainnet treasury gate: fails closed if `NEXT_PUBLIC_ARCTIS_MAINNET_TREASURY` is unset

### Idempotency

- Credits: `addCredits` uses a Firestore transaction with a stable doc ID keyed by `txHash`. Duplicate hashes are rejected by the atomic write (throws `transaction_already_processed`).
- Memberships: `activateMembership` checks `txHash` against the existing record and all membership documents before writing. Same hash, different tier → rejected.

---

## Regression test suites

All run and pass on `feat/hackathon-final`:

| Suite | Tests | Result |
|-------|-------|--------|
| `forge test` (Solidity) | 23 | PASS |
| `mainnet-regression.mjs` | 11 groups | PASS |
| `network-isolation-regression.mjs` | 12 assertions | PASS |
| `chain-switch-regression.mjs` | 17 assertions | PASS |
| `transaction-regression.mjs` | 8 assertions | PASS |
| `tsc --noEmit` | — | exit 0 |

---

## Vercel production environment variables

**Required before mainnet payments work (do not set without explicit approval):**

```
NEXT_PUBLIC_NETWORK_ENV=mainnet
NEXT_PUBLIC_ARCTIS_MAINNET_TREASURY=0xb467F683764593316fAEbB0709127E90791Fe47F
```

Current production deployment runs in Testnet mode. No env vars have been changed.

---

## Remaining blockers

1. **Contract deployment:** ready to deploy. Requires explicit wallet approval from `0xb467...Fe47F` (or whichever wallet the deployer uses). The command above is ready to run. Once deployed, record the contract address in this file and in README.md.

2. **Vercel production env vars:** ready to set. Requires explicit approval before setting in Vercel dashboard.

3. **`createSwapRecord` atomic write (PR #22, not yet merged to main):** swap is hard-gated to testnet at the route level. This is not a mainnet blocker for this submission. Merge PR #22 before enabling mainnet swap.

4. **Firestore TTL on `used_nonces.expireAt`:** operational step, no code change required.
