# ARCTIS Network Isolation

## Rule

Arc Testnet and Arc Mainnet are separate runtime profiles. A selected network must determine the chain ID, RPC, explorer, token contracts, wallet switch target, and executable feature set.

The browser selection is stored in `arctis-network-env`. Server routes must receive the selected network explicitly; they must not infer browser state from `NEXT_PUBLIC_NETWORK_ENV`.

## Source of truth

- `src/lib/contracts.ts` — immutable network profile definitions and server/build defaults
- `src/lib/network/profile.ts` — explicit runtime profile selection helpers
- `src/lib/chain/wagmi.ts` — static wallet chain definitions for both Arc networks
- `src/components/ui/NetworkSelector.tsx` — user-selected environment

## Non-negotiable boundaries

### Testnet

- Chain ID: 5042002
- RPC: `https://rpc.testnet.arc.io`
- Test assets and ARCTIS Testnet Treasury are allowed.
- OTC swap and Circle CCTP bridge are currently Testnet-only.

### Mainnet

- Chain ID: 5042
- RPC: `https://rpc.mainnet.arc.io`
- Only verified production contracts/features may be enabled.
- Testnet assets, testnet RPCs, and Testnet-only settlement routes must never execute.

## Future Testnet retirement

Testnet must not be removed by deleting constants from shared code first.

Use this sequence:

1. Disable Testnet UI availability with an explicit release/configuration change.
2. Keep the Mainnet profile and all Mainnet chain definitions intact.
3. Remove Testnet-only features (tUSDC, tARC, OTC routes, Testnet CCTP routes) behind their own feature boundary.
4. Update or remove Testnet regression assertions intentionally.
5. Run the Mainnet-only build, type-check, lint, and transaction/network regression suite.
6. Only then remove obsolete Testnet profile code.

The Mainnet implementation must not depend on Testnet-only modules.

## Regression guarantee

CI runs `npm run network-regression`. The gate checks that:

- build-time configuration cannot read browser localStorage;
- Wagmi keeps independent Testnet and Mainnet RPC definitions;
- transfer/balance/chain switching use the selected profile;
- Testnet-only tARC is never queried on Mainnet;
- bridge and OTC swap APIs require explicit Testnet selection;
- client execution passes the selected network to server routes.

This prevents another Mainnet merge from silently changing Testnet behavior, and it gives us a controlled path to retire Testnet later without rewriting Mainnet code.
