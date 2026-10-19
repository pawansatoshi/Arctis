# Network Isolation and Brave Proxy Audit Report

**Branch:** `fix/network-isolation-and-brave-proxy`  
**PR:** #31  
**Audit scope:** PRs #23–#30 residual issues identified in the post-PR-#30 audit  
**Status:** All items resolved. `tsc --noEmit` → exit 0. All regression suites pass.

---

## Summary of Fixes

| # | File(s) | Root Cause | Fix |
|---|---------|-----------|-----|
| 1 | `src/app/history/page.tsx` | Imported `EXPLORER_URL` from `contracts.ts` (build-time constant); used it as a fallback for every explorer link | Replaced with `resolveExplorerUrl(txHash, chainId, storedExplorerUrl)` from `@/lib/utils`; now derives chain from `chainId` field returned by the API |
| 2 | `src/lib/firebase/activity.ts` | `buildTransferActivity`, `buildSwapActivity`, `buildBridgeActivity` all called `txUrl()` (build-time `EXPLORER_URL`) | Replaced with `explorerTxUrl(txHash, network)` which uses `TESTNET_NETWORK.explorer` or `MAINNET_NETWORK.explorer` based on the network param passed at write time |
| 3 | `src/components/agent/ModeTabs.tsx` | `explorerFor` fell back to hardcoded `https://testnet.arcscan.app/tx/` | Uses `resolveExplorerUrl(r.txHash, r.raw.chainId, r.explorerUrl)` |
| 4 | `src/components/agent/EconomicAgentPanel.tsx` | Line 513 hardcoded `https://testnet.arcscan.app/tx/${executionTxHash}` | Uses `resolveExplorerUrl(executionTxHash, selectedNetwork.chainId)` — `selectedNetwork` is already derived from the runtime `networkEnv` state |
| 5 | `src/app/api/activity/route.ts` | No network/chainId filter — returned all records for a wallet regardless of selected network | Added `?network=testnet\|mainnet` query param. Filter uses chain ID as the authoritative discriminant (TESTNET_CHAIN_IDS / MAINNET_CHAIN_IDS sets). Legacy records without chain ID are included to avoid silent data loss |
| 6 | `src/app/api/activity/route.ts` | `ActivityItem` interface missing `chainId` | Added `chainId?: number`; transferred from tx record into each response item |
| 7 | `src/components/ui/WalletConnectionGuard.tsx` | Brave Android exposes `window.ethereum` as a Proxy where `removeListener` is a non-configurable, non-writable property on the underlying target. wagmi's injected connector calls `provider.removeListener('connect', handler)` during connect cleanup, triggering the Proxy invariant error: `"'get' on proxy: property 'removeListener' is a read-only and non-configurable data property"` | Added `wrapBraveProvider(provider)` shim that wraps all EventEmitter methods (`on`, `off`, `removeListener`, `addListener`, `emit`) with individual try/catch guards. The shim is applied to `window.ethereum` immediately before `connectAsync()` and restored in a `finally` block. The `request` method is forwarded unchanged to preserve error propagation |

---

## Helper added: `resolveExplorerUrl` in `src/lib/utils/index.ts`

```typescript
// Chain ID → explorer base mapping (both testnet and mainnet chains)
const EXPLORER_BY_CHAIN: Record<number, string> = {
  5042002: 'https://testnet.arcscan.app',   // Arc Testnet
  5042:    'https://explorer.arc.io',        // Arc Mainnet
  11155111: 'https://sepolia.etherscan.io',
  84532:   'https://sepolia.basescan.org',
  421614:  'https://sepolia.arbiscan.io',
  // ...mainnet chains...
};

export function resolveExplorerUrl(
  txHash: string | undefined,
  chainId: number | undefined,
  storedExplorerUrl?: string | undefined,
): string | undefined
```

Priority order:
1. `storedExplorerUrl` (pre-stamped at write time — most reliable)
2. `chainId` lookup in `EXPLORER_BY_CHAIN`
3. `undefined` (unknown chain — never fabricate a URL)

---

## Brave `removeListener` Root Cause (detailed)

**Error observed:** `"'get' on proxy: property 'removeListener' is a read-only and non-configurable data property"`

**Mechanism:**  
Brave Android injects `window.ethereum` as a JavaScript `Proxy` object. The proxy's underlying target has `removeListener` defined as:
```js
Object.defineProperty(target, 'removeListener', {
  value: fn, writable: false, configurable: false
})
```

ECMAScript Proxy invariant: a `get` trap must return the exact value of a non-configurable, non-writable property. Any attempt by the engine or a downstream consumer to treat the returned value differently throws the above error.

wagmi's `@wagmi/core/dist/esm/connectors/injected.js` calls:
```js
provider.removeListener('connect', connect); // cleanup in connect()
provider.removeListener('chainChanged', chainChanged); // cleanup in disconnect()
```

Because the proxy has defined `removeListener` as invariant on the underlying target, the Proxy traps around this property cause the runtime to throw when wagmi tries to use the returned function object.

**Fix mechanism:**  
`wrapBraveProvider` creates a new object that delegates all EventEmitter methods through try/catch. The critical protection is on `removeListener`:
```typescript
removeListener: (event, handler) => {
  try {
    return typeof provider.removeListener === 'function'
      ? provider.removeListener(event, handler)
      : undefined;
  } catch { return undefined; }
}
```

The shim is applied to `window.ethereum` immediately before `connectAsync()` and restored in `finally`. This avoids interfering with any other wallet code that expects the original provider reference.

---

## Remaining Known Items (not addressed in this PR)

1. **`/api/transfer/record` POST fallback** — when `network` param is absent, falls back to build-time `CHAIN_ID`/`NETWORK_NAME` (line 44-45). Legacy clients will record the wrong network. Fix: make `network` param required and return 400 when absent. Deferred to avoid breaking existing clients without migration.

2. **Swap history in `ModeTabs.tsx`** — loads from both `/api/swap/history` and `localStorage` without a network filter. All existing swaps are testnet OTC (tokens `tUSDC`/`tARC`), so filtering is not critical now. The activity API filter (`?network=testnet`) already excludes mainnet-filtered views from the swap history when called from history page. The `ModeTabs` in-panel swap view is a known gap.

3. **Vercel production lag** — production is still at commit `63c375d`. PRs #28–#31 are not yet live. Requires explicit user approval to promote.

4. **Firestore TTL on `used_nonces.expireAt`** — operational step, not done.

5. **GitHub PAT exposed** — must be revoked at https://github.com/settings/personal-access-tokens

6. **Android Brave real-device testing** — the `wrapBraveProvider` fix addresses the known Proxy invariant error, but full end-to-end verification on a physical Brave Android device is required before promoting to production.

---

## Test Evidence

```
tsc --noEmit                             → exit 0 (0 errors)
scripts/mainnet-regression.mjs           → PASS (all groups)
scripts/network-isolation-regression.mjs → PASS
scripts/wallet-connection-regression.mjs → PASS (29/29)
scripts/network-selector-regression.mjs  → PASS (34/34)
scripts/transaction-regression.mjs       → PASS
scripts/history-isolation-regression.mjs → PASS (44/44) [NEW]
forge test (contracts/)                  → PASS (20/20)
```
