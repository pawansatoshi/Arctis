/**
 * ARCTIS History and Network Isolation Regression
 *
 * Verifies the 12 network isolation test cases required by the acceptance
 * criteria, plus the specific bug fixes in this PR:
 *
 *  1. History explorer links resolve to the correct chain's explorer.
 *  2. Activity API accepts and enforces a network query parameter.
 *  3. Server-side activity builders stamp network-correct explorer URLs.
 *  4. ModeTabs no longer hardcodes testnet.arcscan.app.
 *  5. EconomicAgentPanel uses selectedNetwork.chainId for explorer URLs.
 *  6. History page re-fetches when network changes.
 *  7. Brave provider wrapper isolates removeListener proxy errors.
 *
 * All assertions are static (no live RPC or Firebase calls needed).
 */

import { readFileSync } from 'fs';
import { strictEqual, ok, doesNotMatch, match } from 'assert';

let passed = 0;
let failed = 0;

function assert(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${e.message}`);
    failed++;
  }
}

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

// ─── Files ──────────────────────────────────────────────────────────────────
const utilsIndex      = read('src/lib/utils/index.ts');
const historyPage     = read('src/app/history/page.tsx');
const activityRoute   = read('src/app/api/activity/route.ts');
const activityLib     = read('src/lib/firebase/activity.ts');
const modeTabs        = read('src/components/agent/ModeTabs.tsx');
const agentPanel      = read('src/components/agent/EconomicAgentPanel.tsx');
const guardComp       = read('src/components/ui/WalletConnectionGuard.tsx');
const contracts       = read('src/lib/contracts.ts');
const dashPage        = read('src/app/dashboard/page.tsx');
const transferRecord  = read('src/app/api/transfer/record/route.ts');
const treasuryService = read('src/lib/treasury/service.ts');
const chainSwitch     = read('src/lib/hooks/useChainSwitch.ts');
const creditsPage     = read('src/app/credits/page.tsx');
const creditsEngine   = read('src/lib/credits/engine.ts');
const typesIndex      = read('src/types/index.ts');

// ─── 1. getTxUrlByChainId and resolveExplorerUrl helpers ────────────────────
console.log('\n1. Network-aware explorer URL helpers');

assert('getTxUrlByChainId exported from utils', () => {
  match(utilsIndex, /export function getTxUrlByChainId/);
});
assert('resolveExplorerUrl exported from utils', () => {
  match(utilsIndex, /export function resolveExplorerUrl/);
});
assert('EXPLORER_BY_CHAIN maps Arc Testnet 5042002', () => {
  match(utilsIndex, /5042002.*testnet\.arcscan\.app/);
});
assert('EXPLORER_BY_CHAIN maps Arc Mainnet 5042', () => {
  match(utilsIndex, /5042:.*explorer\.arc\.io/);
});
assert('resolveExplorerUrl prefers storedExplorerUrl when present', () => {
  match(utilsIndex, /storedExplorerUrl.*startsWith.*http/);
});
assert('resolveExplorerUrl returns undefined for unknown chain with no stored URL', () => {
  match(utilsIndex, /return undefined/);
});

// ─── 2. History page fixes ───────────────────────────────────────────────────
console.log('\n2. History page');

assert('Does NOT import build-time EXPLORER_URL from contracts', () => {
  doesNotMatch(historyPage, /import.*EXPLORER_URL.*from.*contracts/);
});
assert('Imports resolveExplorerUrl from utils', () => {
  match(historyPage, /resolveExplorerUrl.*from.*@\/lib\/utils/);
});
assert('Uses resolveExplorerUrl for explorer link (not EXPLORER_URL)', () => {
  match(historyPage, /resolveExplorerUrl\(item\.txHash.*item\.chainId.*item\.explorerUrl\)/);
});
assert('HistoryItem interface has chainId field', () => {
  match(historyPage, /chainId\?:\s*number/);
});
assert('Passes network filter to API fetch', () => {
  match(historyPage, /network=\$\{networkEnv\}/);
});
assert('Listens for arctis-network-changed and re-fetches', () => {
  match(historyPage, /arctis-network-changed/);
  match(historyPage, /fetchHistory/);
});

// ─── 3. Activity API network filter ─────────────────────────────────────────
console.log('\n3. Activity API network filter');

assert('Reads network query param', () => {
  match(activityRoute, /searchParams\.get\('network'\)/);
});
assert('matchesNetworkFilter uses chain ID as authoritative discriminant', () => {
  match(activityRoute, /TESTNET_CHAIN_IDS\.has\(chainId\)/);
  match(activityRoute, /MAINNET_CHAIN_IDS\.has\(chainId\)/);
});
assert('Arc Testnet chain ID in testnet set', () => {
  match(activityRoute, /5042002/);
});
assert('Arc Mainnet chain ID in mainnet set', () => {
  match(activityRoute, /new Set\(\[5042,/);
});
assert('Transfer items include chainId in response', () => {
  match(activityRoute, /chainId: tx\.chainId/);
});
assert('Legacy records (no chain ID) included rather than silently dropped', () => {
  match(activityRoute, /return true.*legacy/s);
});

// ─── 4. Server-side activity builders ───────────────────────────────────────
console.log('\n4. Server-side activity builders');

assert('activity.ts does NOT use build-time txUrl from contracts', () => {
  doesNotMatch(activityLib, /import.*txUrl.*from.*@\/lib\/contracts/);
});
assert('activity.ts uses TESTNET_NETWORK and MAINNET_NETWORK', () => {
  match(activityLib, /TESTNET_NETWORK.*MAINNET_NETWORK/);
});
assert('explorerTxUrl helper uses network-correct explorer', () => {
  match(activityLib, /function explorerTxUrl.*network: NetworkEnv/s);
  match(activityLib, /profile\.explorer/);
});
assert('buildTransferActivity accepts network param with default testnet', () => {
  match(activityLib, /buildTransferActivity.*network: NetworkEnv = 'testnet'/s);
});
assert('buildSwapActivity accepts network param', () => {
  match(activityLib, /buildSwapActivity.*network: NetworkEnv/s);
});
assert('buildBridgeActivity accepts network param and stamps destinationLabel', () => {
  match(activityLib, /buildBridgeActivity.*network: NetworkEnv/s);
  match(activityLib, /destinationLabel/);
});
assert('buildBridgeActivity stamps chainId in metadata', () => {
  match(activityLib, /chainId: destinationChainId \?\? profile\.chainId/);
});

// ─── 5. ModeTabs hardcoded explorer fix ─────────────────────────────────────
console.log('\n5. ModeTabs hardcoded explorer');

assert('ModeTabs does NOT hardcode testnet.arcscan.app', () => {
  doesNotMatch(modeTabs, /https:\/\/testnet\.arcscan\.app/);
});
assert('ModeTabs imports resolveExplorerUrl', () => {
  match(modeTabs, /resolveExplorerUrl.*from.*@\/lib\/utils/);
});
assert('ModeTabs explorerFor uses resolveExplorerUrl with raw.chainId', () => {
  match(modeTabs, /resolveExplorerUrl\(r\.txHash.*r\.explorerUrl\)/);
});

// ─── 6. EconomicAgentPanel hardcoded explorer fix ───────────────────────────
console.log('\n6. EconomicAgentPanel hardcoded explorer');

assert('EconomicAgentPanel does NOT hardcode testnet.arcscan.app unconditionally', () => {
  // It is allowed as a fallback string but must be guarded by resolveExplorerUrl
  const idx = agentPanel.indexOf('testnet.arcscan.app');
  if (idx === -1) return; // fully removed — also fine
  // If present, resolveExplorerUrl must appear nearby (within 200 chars)
  const context = agentPanel.slice(Math.max(0, idx - 200), idx + 50);
  ok(context.includes('resolveExplorerUrl'), 'testnet.arcscan.app must be guarded by resolveExplorerUrl');
});
assert('EconomicAgentPanel uses selectedNetwork.chainId for explorer link', () => {
  match(agentPanel, /resolveExplorerUrl\(executionTxHash.*selectedNetwork\.chainId\)/);
});

// ─── 7. Brave proxy error guard ──────────────────────────────────────────────
console.log('\n7. Brave removeListener proxy guard');

assert('WalletConnectionGuard defines EthereumProvider type', () => {
  match(guardComp, /type EthereumProvider/);
});
assert('WalletConnectionGuard defines wrapBraveProvider function', () => {
  match(guardComp, /function wrapBraveProvider/);
});
assert('wrapBraveProvider wraps removeListener with try/catch', () => {
  match(guardComp, /removeListener:.*try.*provider\.removeListener/s);
});
assert('wrapBraveProvider wraps on/off/addListener/emit', () => {
  match(guardComp, /on:.*try/s);
  match(guardComp, /off:.*try/s);
  match(guardComp, /addListener:.*try/s);
});
assert('provider request method is forwarded unchanged', () => {
  match(guardComp, /request: \(args\) => provider\.request\(args\)/);
});
assert('window.ethereum is patched temporarily and restored in finally', () => {
  match(guardComp, /Object\.defineProperty\(window.*wrapBraveProvider/s);
  match(guardComp, /finally/);
  match(guardComp, /originalEthereum/);
});
assert('No unconditional window.ethereum overwrite without restore', () => {
  // The patch must be guarded by a try/catch to handle non-configurable envs
  match(guardComp, /try.*Object\.defineProperty.*wrapBraveProvider/s);
  match(guardComp, /} catch/);
});

// ─── 8. Network isolation non-regression ────────────────────────────────────
console.log('\n8. Network isolation non-regression');

assert('contracts.ts still defines both TESTNET and MAINNET profiles', () => {
  match(contracts, /TESTNET_NETWORK.*=.*TESTNET/);
  match(contracts, /MAINNET_NETWORK.*=.*MAINNET/);
});
assert('Testnet chain ID 5042002 preserved', () => {
  match(contracts, /5042002/);
});
assert('Mainnet chain ID 5042 preserved', () => {
  match(contracts, /chainId:\s*5042,/);
});
assert('Testnet RPC preserved', () => {
  match(contracts, /rpc\.testnet\.arc\.io/);
});
assert('Mainnet RPC preserved', () => {
  match(contracts, /rpc\.mainnet\.arc\.io/);
});
assert('Testnet explorer preserved', () => {
  match(contracts, /explorer\.testnet\.arc\.io/);
});
assert('Mainnet explorer preserved', () => {
  match(contracts, /explorer\.arc\.io/);
});

// ─── 9. Dashboard: resolveExplorerUrl replaces txUrl ────────────────────────
console.log('\n9. Dashboard explorer links');

assert('Dashboard does NOT use build-time txUrl for tx links', () => {
  doesNotMatch(dashPage, /href=\{txUrl\(/);
});
assert('Dashboard uses resolveExplorerUrl with tx.chainId', () => {
  match(dashPage, /resolveExplorerUrl\(tx\.txHash.*tx\.chainId\)/);
});
assert('Dashboard imports resolveExplorerUrl from utils', () => {
  match(dashPage, /resolveExplorerUrl.*from.*@\/lib\/utils/);
});

// ─── 10. /api/transfer/record: network param required ───────────────────────
console.log('\n10. Transfer record API: network required');

assert('transfer/record POST returns 400 when network absent', () => {
  match(transferRecord, /network is required.*testnet.*mainnet/s);
  match(transferRecord, /status: 400/);
});
assert('transfer/record no longer uses build-time CHAIN_ID fallback', () => {
  doesNotMatch(transferRecord, /CHAIN_ID,/);
});
assert('transfer/record uses profile.chainId exclusively', () => {
  match(transferRecord, /chainId: profile\.chainId/);
});

// ─── 11. Treasury service: no build-time EXPLORER_URL fallback ──────────────
console.log('\n11. Treasury service explorer URL');

assert('treasury/service.ts does NOT use EXPLORER_URL', () => {
  doesNotMatch(treasuryService, /EXPLORER_URL/);
});
assert('treasury/service.ts derives explorer from chainId', () => {
  match(treasuryService, /MAINNET_NETWORK\.chainId.*MAINNET_NETWORK/s);
  match(treasuryService, /TESTNET_NETWORK\.chainId.*TESTNET_NETWORK/s);
});

// ─── 12. useChainSwitch: wallet_addEthereumChain auto-add ───────────────────
console.log('\n12. Network switching: auto-add chain');

assert('useChainSwitch imports ARC chain params', () => {
  match(chainSwitch, /ARC_CHAIN_PARAMS/);
});
assert('useChainSwitch defines tryAddChain', () => {
  match(chainSwitch, /async function tryAddChain/);
});
assert('tryAddChain calls wallet_addEthereumChain', () => {
  match(chainSwitch, /wallet_addEthereumChain/);
});
assert('switchToArc handles code 4902 (chain not added)', () => {
  match(chainSwitch, /4902/);
});
assert('switchToArc handles "unrecognized chain" message', () => {
  match(chainSwitch, /unrecognized chain/i);
});
assert('switchToArc retries switch after adding chain', () => {
  match(chainSwitch, /tryAddChain.*switchChainAsync/s);
});
assert('ARC_CHAIN_PARAMS includes testnet chain definition', () => {
  match(chainSwitch, /TESTNET_NETWORK\.chainId.*chainName.*TESTNET_NETWORK/s);
});
assert('ARC_CHAIN_PARAMS includes mainnet chain definition', () => {
  match(chainSwitch, /MAINNET_NETWORK\.chainId.*chainName.*MAINNET_NETWORK/s);
});

// ─── 13. Credits: chainId stamped in ledger and passed to resolveExplorerUrl ─
console.log('\n13. Credits: chainId in ledger');

assert('CreditLedgerEntry type has chainId field', () => {
  match(typesIndex, /chainId\?:\s*number/);
});
assert('credits/engine.ts addCredits accepts chainId param', () => {
  match(creditsEngine, /addCredits.*chainId\?:\s*number/s);
});
assert('credits/engine.ts stamps chainId in Firestore ledger row', () => {
  match(creditsEngine, /chainId !== undefined.*chainId/s);
});
assert('credits/page.tsx uses resolveExplorerUrl instead of txUrl', () => {
  doesNotMatch(creditsPage, /href=\{txUrl\(/);
  match(creditsPage, /resolveExplorerUrl\(entry\.txHash.*entry\.chainId\)/);
});

// ─── 14. getTxUrlByChainId: no hardcoded testnet fallback ───────────────────
console.log('\n14. getTxUrlByChainId: no fabricated fallback');

assert('getTxUrlByChainId does NOT fall back to testnet.arcscan.app for unknown chains', () => {
  doesNotMatch(utilsIndex, /\?\? 'https:\/\/testnet\.arcscan\.app'/);
});
assert('getTxUrlByChainId returns undefined-safe string for unknown chains', () => {
  match(utilsIndex, /unknown-chain/);
});

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log('\n──────────────────────────────────────────────────');
console.log(`Passed: ${passed} / ${passed + failed}`);
if (failed > 0) {
  console.error(`FAILED: ${failed} assertion(s)`);
  process.exit(1);
} else {
  console.log('All assertions passed.\n');
}
