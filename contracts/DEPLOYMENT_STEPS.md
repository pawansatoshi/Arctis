# ARCTIS Contract Deployment — Step by Step

These steps are for **Arc Testnet only**. Do not use a mainnet key or meaningful funds.

## Step 0 — Current safety point

The ARCTISAgentTreasury deployment is additive and does not replace the existing ARCTIS Transfer, Swap or Bridge routes. **Do not deploy or integrate Escrow as part of the current demo/H1 state.** Escrow remains a future optional contract until separately authorized and verified.

## Step 1 — Deployment wallet

The current ARCTIS testnet owner/deployer wallet is:

```text
0xb467F683764593316fAEbB0709127E90791Fe47F
```

This same wallet is currently configured as the normal ARCTIS payment/revenue treasury wallet. It is **not** the Agent Treasury contract address.

Use only Arc Testnet gas/test assets.

Never paste the private key into GitHub, this chat, the repository, or `NEXT_PUBLIC_*` environment variables.

## Step 2 — Install Foundry

Install Foundry from the official Foundry documentation, then verify:

```bash
forge --version
cast --version
```

## Step 3 — Compile

From the repository root:

```bash
forge build
```

The repository pins Solidity `0.8.24` in `foundry.toml`.

**Canonical Treasury source:** `contracts/ARCTISAgentTreasury_ARC_USDC_FIX.sol`

Do not compile or deploy the legacy `contracts/ARCTISAgentTreasury.sol` source. It is deprecated and should not be used for the current deployment.

## Step 4 — Run tests

Before any future deployment:

```bash
forge test -vvv
```

Deployment must stop if tests fail.

The repository must not claim a successful test run until the command has actually been executed in a Foundry environment.

## Step 5 — Treasury constructor

The canonical V1 Treasury requires **only `initialOwner`**.

For the current testnet deployment:

```text
initialOwner = 0xb467F683764593316fAEbB0709127E90791Fe47F
```

There is intentionally **no separate relayer in V1**. The owner's wallet is the proposal, approval and governance boundary. The Economic Agent prepares intent/quote offchain; the owner submits and explicitly approves the onchain action.

## Step 6 — Verified Treasury deployment

The canonical Treasury has been deployed successfully on Arc Testnet.

```text
Contract: ARCTISAgentTreasury
Address:  0xf28541094031BD34bA08Ae98982F4348C9ADB94c
Deploy tx: 0xc4447c1044327ee4eac001816161ce61c1f5d146f6e7404bd56a3889c66e820d
ArcScan: https://testnet.arcscan.app/address/0xf28541094031BD34bA08Ae98982F4348C9ADB94c
```

The deployment transaction succeeded at block `56815151`. The deployed source is verified on ArcScan as an exact match using Solidity `0.8.24`, optimizer enabled with 200 runs.

## Step 7 — Verify Treasury on ArcScan

The current deployment is verified. Verification settings:

- Source: `ARCTISAgentTreasury_ARC_USDC_FIX.sol`
- Solidity: `0.8.24`
- Optimizer: enabled
- Optimizer runs: `200`
- Via IR: disabled

The canonical Arc USDC precompile is:

```text
0x3600000000000000000000000000000000000000
```

## Step 8 — Configure Treasury

Any further Treasury configuration must use only small testnet amounts and the documented owner wallet. Existing ARCTIS Transfer/Swap/Bridge flows must remain unchanged.

## Step 9 — Treasury isolated test gate

Before any future application integration, verify:

- amount above per-tx limit → revert;
- daily limit exceeded → revert;
- revoked agent → revert;
- disallowed token → revert;
- expired deadline → revert;
- execute before approval → revert;
- execute twice → revert;
- pause → financial action blocked.

Preserve the existing demo and application regression behavior.

## Step 10 — Escrow is intentionally postponed

**Do not deploy Escrow for the current H1/demo state.**

`contracts/ARCTISAgentEscrow.sol` remains in the repository as a future/testnet-stage primitive. It is **not deployed, not integrated into the current UI/API, and has no claimed ArcScan address**.

If Escrow is resumed in a future phase, it must use a separate deployment/integration gate:

1. compile the canonical source;
2. run unit/fuzz/invariant/security tests;
3. deploy with the secured testnet deployment wallet;
4. record the deployment transaction and address;
5. verify exact source on ArcScan;
6. run isolated `createJob → fund → submit → release` and refund/dispute tests;
7. confirm existing ARCTIS regression tests remain green;
8. integrate only behind an explicit feature flag.

## Step 11 — Application integration gate

The Agent Treasury must not replace existing Transfer, Swap or Bridge rails. Any future Treasury application integration must be additive and feature-flagged after isolated verification and regression testing.

Escrow remains outside the current application/demo until its own deployment and verification gates are complete.

## Important

A successful deployment is not an audit. These contracts are testnet-stage engineering work. Mainnet use requires comprehensive testing, independent security review and a final authorization/custody design review.
