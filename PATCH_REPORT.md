# PATCH REPORT — ARCTIS Economic Agent + Stablecoin OS

## Files changed
- src/app/bridge/page.tsx
- src/lib/agents/executor.ts
- src/lib/agents/service.ts
- src/lib/ai/intent/parser.ts
- src/lib/bridge/types.ts
- src/lib/chain/wagmi.ts
- src/lib/hooks/useTARCBalance.ts
- src/lib/hooks/useUSDCBalance.ts
- src/lib/store/index.ts
- src/types/index.ts
- CHANGELOG.md
- CHANGES.diff
- PATCH_REPORT.md

## Root causes found
- Firestore `update()` received optional `undefined` fields from agent execution updates.
- Financial parser could produce non-executable transfer proposals and sent incomplete financial intents toward normal proposal behavior without an explicit structured clarification payload.
- wagmi was configured only with Arc Testnet while the bridge UI writes approval/burn transactions on Sepolia, Base Sepolia, and Arbitrum Sepolia.
- Bridge amount floor was application-side at 1 USDC, not traced to a protocol constant in the repository.
- Arc token balance reads were not explicitly pinned to Arc Testnet after adding source chains.

## Fixes implemented
- Added `stripUndefined()` in the agent service and applied it to `updateExecution()`/`updateAgent()` update payloads.
- Reworked deterministic parser to:
  - allow transfer proposals only for USDC,
  - validate swaps through the existing `DEFAULT_ROUTES` registry via `getRouteId()`,
  - parse supported CCTP source-chain aliases from the actual configured source-chain list,
  - return structured clarification requests for missing recipient, receive token, source chain, unsupported token, or disabled route.
- Preserved mandatory human approval: financial proposals still only set `requiresWalletAction`; wallet signing remains in the Transfer/Swap/Bridge modules.
- Registered Ethereum Sepolia, Base Sepolia, and Arbitrum Sepolia in RainbowKit/wagmi.
- Improved bridge source-chain handoff from agent proposals and wallet-switch messaging for already-correct, rejected, unsupported, unconfigured, and generic wallet-switch failures.
- Changed bridge minimum amount to 0.000001 USDC (the smallest 6-decimal USDC unit represented by the app), and changed the input step accordingly.
- Pinned USDC/tARC Arc balance reads with `chainId: CHAIN_ID`.

## Build/typecheck/lint/test results
- `npm run type-check`: PASS.
- `npm run build`: FAIL without required environment variables; PASS with placeholder non-secret env values for required build-time variables.
- `npm run lint`: PASS with existing warnings.
- `npm test`: unavailable; package.json has no test script.

## Real transaction verification results
- No real wallet/private key or funded test wallet was available in this non-interactive environment, so no blockchain transaction was submitted and no tx hash was fabricated.
- Static and build verification confirmed the wallet-signing paths remain client-side and require human wallet confirmation.

## Remaining blockers
- Production/demo environment must provide Firebase, OpenRouter, WalletConnect, and swap-wallet env vars.
- End-to-end transfer/swap/bridge transaction execution requires a connected funded wallet and live CCTP/Circle services.
- Full agent memory architecture was not expanded beyond existing agent persistence due hackathon-critical focus on financial execution safety/buildability.

## Deployment notes
- Set required env vars: `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `OPENROUTER_API_KEY`, `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`.
- Set swap settlement env vars before demonstrating OTC swaps: `SWAP_WALLET_PRIVATE_KEY`, `NEXT_PUBLIC_SWAP_WALLET_ADDRESS`.
- Source-chain users need real testnet USDC on the selected source chain and gas ETH only for fees.
