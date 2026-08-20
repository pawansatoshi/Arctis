# ARCTIS Contract Deployment — Step by Step

These steps are for **Arc Testnet only**. Do not use a mainnet key or meaningful funds.

## Step 0 — Current safety point

The new contracts are not connected to existing ARCTIS Transfer, Swap or Bridge flows. Deploying them does not change those routes.

## Step 1 — Deployment wallet

The current ARCTIS testnet owner/deployer wallet is:

```text
0xb467F683764593316fAEbB0709127E90791Fe47F
```

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

Do not compile or deploy the legacy `contracts/ARCTISAgentTreasury.sol` source. It is deprecated and should be removed from the repository to avoid deployment/source confusion.

## Step 4 — Run tests

Before deployment:

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

A future relayer can be introduced only when there is a concrete automation requirement and a separate security model has been reviewed.

## Step 6 — Treasury deployment

The canonical Treasury has now been deployed successfully on Arc Testnet.

```text
Contract: ARCTISAgentTreasury
Address:  0xf28541094031BD34bA08Ae98982F4348C9ADB94c
Deploy tx: 0xc4447c1044327ee4eac001816161ce61c1f5d146f6e7404bd56a3889c66e820d
ArcScan: https://testnet.arcscan.app/address/0xf28541094031BD34bA08Ae98982F4348C9ADB94c
```

The deployment transaction succeeded at block `56815151`. The deployed source is verified on ArcScan as an exact match using Solidity `0.8.24`, optimizer enabled with 200 runs.

For a fresh deployment, use:

```bash
export ARC_TESTNET_RPC_URL="<Arc Testnet RPC>"
export DEPLOYER_PRIVATE_KEY="<DO NOT COMMIT>"

forge create contracts/ARCTISAgentTreasury_ARC_USDC_FIX.sol:ARCTISAgentTreasury \
  --rpc-url "$ARC_TESTNET_RPC_URL" \
  --private-key "$DEPLOYER_PRIVATE_KEY" \
  --constructor-args "0xb467F683764593316fAEbB0709127E90791Fe47F"
```

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

After verification, the owner wallet should configure, in this order:

1. `setAllowedToken(testnet token, true)`
2. `registerAgent(agentId)`
3. `setPolicy(agentId, maxPerTransaction, maxDaily, true)`
4. deposit a very small testnet amount

For Arc USDC, use the canonical precompile address supported by the deployed source.

## Step 9 — Treasury test transaction

The owner wallet creates a small proposal, explicitly approves it, then executes it.

Verify all transactions/events and the final recipient balance.

Also test:

- amount above per-tx limit → revert;
- daily limit exceeded → revert;
- revoked agent → revert;
- disallowed token → revert;
- expired deadline → revert;
- execute before approval → revert;
- execute twice → revert;
- pause → financial action blocked.

## Step 10 — Deploy Escrow separately

Only after Treasury passes its isolated test:

```bash
forge create contracts/ARCTISAgentEscrow.sol:ARCTISAgentEscrow \
  --rpc-url "$ARC_TESTNET_RPC_URL" \
  --private-key "$DEPLOYER_PRIVATE_KEY" \
  --constructor-args "0xb467F683764593316fAEbB0709127E90791Fe47F"
```

Verify the Escrow source on ArcScan using the same compiler settings.

**Current status:** Escrow source exists in the repository, but no deployed Arc Testnet Escrow address is currently documented or claimed.

## Step 11 — Escrow test

Use a very small testnet amount:

```text
createJob → fund → submit → release
```

Then separately test:

```text
createJob → fund → refund after deadline
createJob → fund → submit → dispute → owner resolve
expired job behavior
pause behavior
```

## Step 12 — Application integration gate

Do **not** connect the new contracts to production UI until:

- both sources are verified;
- isolated test transactions pass;
- existing ARCTIS transaction regression tests pass;
- contract addresses are added to the central configuration;
- feature flag defaults to OFF;
- a small end-to-end agent test passes.

## Important

A successful deployment is not an audit. These contracts are testnet-stage scaffolding. Mainnet use requires comprehensive testing, independent security review and a final authorization/custody design review.
