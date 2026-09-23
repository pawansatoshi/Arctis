# ARCTIS Network Isolation

ARCTIS keeps Arc Testnet and Arc Mainnet as two independent network profiles.

## Stable baselines

- `testnet-stable` is pinned to the last known-good complete Testnet application state before the Mainnet migration work.
- `mainnet-stable` is pinned to the Mainnet migration baseline.
- Do not force-push either baseline branch.

## Runtime rule

The network selector chooses exactly one complete profile:

- chain ID
- RPC
- explorer
- USDC / swap assets
- Agent Treasury
- treasury wallet
- decimals
- network name

The application must never compose Testnet contracts with Mainnet RPCs or vice versa.

## Removal rule

If Testnet is retired later:

1. Keep `testnet-stable` as the rollback archive.
2. Remove the Testnet entry from the network profile registry and selector.
3. Remove Testnet-only routes/assets only after confirming no Mainnet dependency references them.
4. Mainnet profile files and addresses are not edited as part of Testnet removal.

## Rollback rule

If Mainnet work needs to be discarded, the Testnet baseline remains available from `testnet-stable`. Mainnet changes must not be used as the source of truth for Testnet recovery.

## Important

The stable branches are historical anchors; the production `main` branch contains the unified application shell plus isolated network profiles. Network-specific execution code must continue to consume the selected profile rather than hard-coded cross-network values.
