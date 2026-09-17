# ARCTIS — Arc Mainnet Migration

## Current state

The mainnet core migration is isolated on `feat/arc-mainnet-migration`.

### Arc Mainnet

- Chain ID: `5042`
- RPC: `https://rpc.mainnet.arc.io`
- Explorer: `https://explorer.arc.io`
- Native gas asset: USDC
- Native gas units: 18 decimals
- ERC-20 USDC interface: `0x3600000000000000000000000000000000000000`
- ERC-20 USDC decimals: 6

## Included in the migration

1. Environment-aware Arc network configuration.
2. Correct Arc Mainnet chain ID/RPC/explorer.
3. Mainnet USDC configuration.
4. Mainnet production treasury supplied through `NEXT_PUBLIC_ARCTIS_MAINNET_TREASURY` instead of being committed to source.
5. Direct wallet-controlled USDC transfer using viem rather than a hardcoded `Arc_Testnet` App Kit send identifier.
6. Automatic network switching to the selected Arc network before transfer.
7. USDC balance and native-USDC gas preflight before wallet approval.
8. Test assets `tUSDC` and `tARC` are marked non-executable when `CHAIN_ID === 5042`.

## Deliberately not enabled for the first mainnet release

- ARCTIS OTC `tUSDC` / `tARC` swaps
- Testnet Memo/Passport contract
- Testnet CCTP bridge routes
- ARCTIS Agent Treasury deployment
- Any unaudited contract holding meaningful mainnet funds

## Vercel configuration

For the mainnet deployment, set:

```text
NEXT_PUBLIC_NETWORK_ENV=mainnet
NEXT_PUBLIC_ARCTIS_MAINNET_TREASURY=<production receiving wallet>
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=<walletconnect project id>
NEXT_PUBLIC_APP_URL=<production app url>
```

Keep server-side secrets in Vercel's server-only environment variables. Never commit private keys.

## Pre-submission verification

- [ ] Vercel deployment uses `NEXT_PUBLIC_NETWORK_ENV=mainnet`.
- [ ] Frontend reports Arc Mainnet / chain ID 5042.
- [ ] Wallet can switch to Arc Mainnet.
- [ ] User can read their USDC balance.
- [ ] User can submit a small USDC transfer to a controlled recipient.
- [ ] Wallet approval is shown before execution.
- [ ] Transaction receipt confirms on Arc Mainnet.
- [ ] Explorer link opens on `explorer.arc.io`.
- [ ] Transaction history records the confirmed transaction.
- [ ] No testnet asset or testnet-only route is presented as a mainnet capability.
- [ ] Mainnet deployment has been manually tested before the Microgrant submission.

## Important safety rule

Arc Mainnet uses real USDC and transactions are irreversible. Do not use the mainnet deployment for testing until the Vercel environment and wallet network have been independently verified.
