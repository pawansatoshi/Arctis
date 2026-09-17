# ARCTIS Mainnet Roadmap Status

This document is the execution checklist for the Arc Mainnet migration. It separates code-complete work from actions that require production credentials, a production wallet, third-party route verification, or an explicit live-money approval.

## 1. Core network migration

- [x] Environment-aware Arc network selection.
- [x] Arc Mainnet chain ID `5042`.
- [x] Arc Mainnet RPC `https://rpc.mainnet.arc.io`.
- [x] Arc Mainnet explorer `https://explorer.arc.io`.
- [x] Arc Native USDC configured as the native gas asset with 18-decimal native units.
- [x] Arc ERC-20 USDC interface configured at `0x3600000000000000000000000000000000000000` with 6 decimals.
- [x] Mainnet treasury is configuration-driven; no wallet address is invented or committed.

## 2. Wallet transfer rail

- [x] Remove hardcoded `Arc_Testnet` send execution from the primary transfer path.
- [x] Use the selected Arc network dynamically.
- [x] Switch wallet to the selected Arc network before signing.
- [x] Resolve direct EVM addresses and `.arc` Passport recipients.
- [x] Validate amount and recipient before execution.
- [x] Read ERC-20 USDC balance before signing.
- [x] Read native USDC gas balance before signing.
- [x] Estimate transfer gas before signing.
- [x] Record submitted/confirmed/failed lifecycle states.
- [x] Require wallet proof for transfer-record mutations.

## 3. Testnet isolation

- [x] Disable executable `tUSDC` and `tARC` assets on Arc Mainnet.
- [x] Keep testnet CCTP bridge routes testnet-only.
- [x] Keep ARCTIS OTC test-asset swap routes testnet-only.
- [x] Do not expose testnet contract addresses as mainnet contracts.
- [x] Keep unaudited Treasury/Escrow contracts out of the mainnet money path.

## 4. Swap / bridge

- [x] Mainnet API gates prevent the current testnet OTC swap from being treated as a mainnet route.
- [x] Mainnet API gates prevent the current testnet CCTP route registry from being treated as a mainnet route.
- [ ] Enable production Swap only after a production liquidity/settlement rail is verified and independently configured.
- [ ] Enable production CCTP only after production Circle route identifiers, domains, USDC addresses, App Kit identifiers, and end-to-end transactions are verified.

These are intentionally blocked rather than guessed.

## 5. Economic Agent Treasury

- [x] Canonical Treasury contract remains isolated from the manual transfer rail.
- [x] Existing testnet Treasury tests remain part of CI.
- [x] Mainnet configuration does not silently point to the testnet Treasury.
- [ ] Independent security review for the production custody/authorization model.
- [ ] Production Treasury deployment from a secured production deployer.
- [ ] Exact production source verification.
- [ ] Production contract address recorded only after onchain confirmation.
- [ ] Feature-flagged production agent execution after isolated mainnet transaction tests.

No production contract address is claimed until those gates are complete.

## 6. Escrow

- [x] Solidity source and test scaffold remain preserved.
- [x] Escrow remains out of the current production money path.
- [ ] Independent security review.
- [ ] Mainnet deployment.
- [ ] Source verification.
- [ ] Isolated create/fund/submit/release/refund/dispute tests.
- [ ] Feature-flagged UI/API integration.

## 7. CI / release gates

- [x] PR branch: `feat/arc-mainnet-migration`.
- [x] PR #14 is the isolated migration review surface.
- [ ] Latest CI run green across Solidity, TypeScript, regression, architecture truth, lint and production build.
- [ ] Latest Vercel preview deployment reaches `READY`.
- [ ] Production deployment reaches `READY` after CI is green and production environment variables are verified.

## 8. Production environment

Required production configuration:

```text
NEXT_PUBLIC_NETWORK_ENV=mainnet
NEXT_PUBLIC_ARCTIS_MAINNET_TREASURY=<production receiving wallet>
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=<project id>
NEXT_PUBLIC_APP_URL=<production app url>
```

Never place private keys or seed phrases in GitHub, browser-exposed variables, or this repository.

## 9. Live-money acceptance gate

Before the first real transaction:

1. Confirm the deployed frontend is the intended commit.
2. Confirm the environment resolves to Arc Mainnet (`5042`).
3. Confirm the wallet is on Arc Mainnet.
4. Confirm the recipient address independently.
5. Confirm the amount independently.
6. Confirm the wallet shows the intended USDC contract and recipient.
7. Send only a deliberately small controlled amount.
8. Verify the receipt on the Arc explorer.
9. Verify ARCTIS history shows the same transaction hash and final state.

A live transaction cannot be honestly marked complete until an actual receipt is observed. No transaction is submitted automatically by this repository migration.
