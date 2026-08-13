# ARCTIS Contract Deployment — Step by Step

These steps are for **Arc Testnet only**. Do not use a mainnet key or meaningful funds.

## Step 0 — Current safety point

The new contracts are not connected to existing ARCTIS Transfer, Swap or Bridge flows. Deploying them does not change those routes.

## Step 1 — Use a dedicated Arc Testnet deployment wallet

Use a wallet you control and fund only with Arc Testnet gas/test assets.

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

## Step 4 — Run tests

Before deployment, add/run the contract unit and security tests:

```bash
forge test -vvv
```

Deployment must stop if tests fail.

## Step 5 — Treasury constructor

`ARCTISAgentTreasury` requires:

```text
initialOwner
initialRelayer
```

For the first isolated testnet deployment, `initialOwner` can be the owner's Arc Testnet wallet. Prefer a separate dedicated relayer wallet for `initialRelayer`.

The relayer can propose bounded actions but cannot approve, withdraw or change policy.

## Step 6 — Deploy Treasury

After setting your RPC URL and deployment key in your local shell only:

```bash
export ARC_TESTNET_RPC_URL="<Arc Testnet RPC>"
export DEPLOYER_PRIVATE_KEY="<DO NOT COMMIT>"
export OWNER_ADDRESS="<owner wallet>"
export RELAYER_ADDRESS="<relayer wallet>"

forge create contracts/ARCTISAgentTreasury.sol:ARCTISAgentTreasury \
  --rpc-url "$ARC_TESTNET_RPC_URL" \
  --private-key "$DEPLOYER_PRIVATE_KEY" \
  --constructor-args "$OWNER_ADDRESS" "$RELAYER_ADDRESS"
```

Record the resulting contract address and deployment transaction hash.

## Step 7 — Verify Treasury on ArcScan

Use ArcScan's contract verification flow with the exact compiler version/settings used by Foundry:

- Solidity: `0.8.24`
- Optimizer: enabled
- Optimizer runs: `200`
- Via IR: disabled

Do not claim the contract is verified until ArcScan confirms it.

## Step 8 — Configure Treasury

After verification, the owner wallet should configure, in this order:

1. `setAllowedToken(testnet token, true)`
2. `registerAgent(agentId)`
3. `setPolicy(agentId, maxPerTransaction, maxDaily, true)`
4. deposit a very small testnet amount

## Step 9 — Treasury test transaction

Use the dedicated relayer to create a small proposal.

Then the owner wallet must explicitly approve it.

Then execute it.

Verify all three transactions/events and the final recipient balance.

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
  --constructor-args "$OWNER_ADDRESS"
```

Verify the Escrow source on ArcScan using the same compiler settings.

## Step 11 — Escrow test

Use a very small testnet amount:

```text
createJob → fund → submit → release
```

Then separately test:

```text
createJob → fund → refund
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
