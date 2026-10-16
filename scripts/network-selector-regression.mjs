/**
 * network-selector-regression.mjs
 *
 * Static regression tests for the NetworkSelector restore.
 * Verifies:
 *   1. NetworkSelector component exports and contains both network options.
 *   2. Dashboard layout imports and renders NetworkSelector.
 *   3. Both chain IDs (5042002, 5042) appear in the selector.
 *   4. Testnet is the default (first option, default state).
 *   5. switchNetwork persists to localStorage AND sets a cookie.
 *   6. Page reloads on network change (prevents stale wagmi/contract state).
 *   7. getSelectedNetworkProfile returns the correct profile for each env.
 *   8. NETWORK_NAME build-time constant is no longer used in the layout
 *      (replaced by dynamic networkName from getSelectedNetworkProfile).
 *   9. Brave mobile fix (WalletConnectionGuard) is still present.
 *  10. Both Arc chains remain in wagmiConfig.
 */

import { readFileSync } from 'fs';
import { strictEqual, ok, doesNotMatch, match } from 'assert';

let passed = 0;
let failed = 0;

function section(name) { console.log(`\n${name}`); }

function check(label, fn) {
  try {
    fn();
    console.log(`  ✓ ${label}`);
    passed++;
  } catch (e) {
    console.error(`  ✗ ${label}\n    ${e.message}`);
    failed++;
  }
}

const selector  = readFileSync('src/components/ui/NetworkSelector.tsx', 'utf8');
const layout    = readFileSync('src/app/dashboard/layout.tsx', 'utf8');
const profile   = readFileSync('src/lib/network/profile.ts', 'utf8');
const wagmi     = readFileSync('src/lib/chain/wagmi.ts', 'utf8');
const guard     = readFileSync('src/components/ui/WalletConnectionGuard.tsx', 'utf8');

// ── 1. NetworkSelector component ────────────────────────────────────────────
section('1. NetworkSelector component');
check('exports default NetworkSelector function', () => {
  match(selector, /export default function NetworkSelector/);
});
check('Arc Testnet option present', () => {
  match(selector, /Arc Testnet/);
});
check('Arc Mainnet option present', () => {
  match(selector, /Arc Mainnet/);
});
check('Testnet chain ID 5042002 present', () => {
  match(selector, /5042002/);
});
check('Mainnet chain ID 5042 present', () => {
  // Must match 5042 as a standalone value, not as part of 5042002
  const matches = [...selector.matchAll(/\b5042\b/g)];
  ok(matches.length >= 1, 'chain ID 5042 must appear at least once');
});
check('localStorage key is arctis-network-env', () => {
  match(selector, /arctis-network-env/);
});
check('localStorage.setItem called on switch', () => {
  match(selector, /localStorage\.setItem/);
});
check('cookie set on switch (SSR reads)', () => {
  match(selector, /document\.cookie/);
});
check('arctis-network-changed event dispatched', () => {
  match(selector, /arctis-network-changed/);
});
check('page reloads after network change', () => {
  match(selector, /location\.reload/);
});
check('testnet is the default fallback', () => {
  // Default state is 'testnet' — it must appear as a string literal default
  match(selector, /'testnet'/);
  doesNotMatch(selector, /default.*mainnet/);
});
check('pre-hydration placeholder renders Testnet', () => {
  match(selector, /FlaskConical/);
});
check('chain ID badge rendered', () => {
  match(selector, /current\.chainId/);
});

// ── 2. Dashboard layout mounts the selector ──────────────────────────────────
section('2. Dashboard layout mounts NetworkSelector');
check('NetworkSelector imported in layout', () => {
  match(layout, /import NetworkSelector from/);
});
check('NetworkSelector rendered in JSX', () => {
  match(layout, /<NetworkSelector\s*\/>/);
});
check('NETWORK_NAME build-time constant removed from layout import', () => {
  doesNotMatch(layout, /import.*NETWORK_NAME.*from/);
});
check('getSelectedNetworkProfile imported in layout', () => {
  match(layout, /getSelectedNetworkProfile/);
});
check('networkName derived from profile (not build-time constant)', () => {
  match(layout, /networkName\s*=\s*getSelectedNetworkProfile/);
});
check('networkName used in isCorrectChain badge', () => {
  match(layout, /isCorrectChain.*networkName|networkName.*isCorrectChain/);
});
check('NetworkSelector placed in the header ml-auto group', () => {
  // Selector must appear between the ml-auto div and ConnectButton
  const mlAutoIdx  = layout.indexOf('flex items-center gap-2 ml-auto');
  const selectorIdx = layout.indexOf('<NetworkSelector');
  const connectIdx  = layout.indexOf('<ConnectButton');
  ok(mlAutoIdx > 0,   'ml-auto group must exist');
  ok(selectorIdx > mlAutoIdx, 'NetworkSelector must be inside ml-auto group');
  ok(connectIdx > selectorIdx, 'ConnectButton must follow NetworkSelector');
});

// ── 3. Network profile correctness ───────────────────────────────────────────
section('3. Network profile (profile.ts)');
check('getSelectedNetworkEnv exported', () => {
  match(profile, /export function getSelectedNetworkEnv/);
});
check('getSelectedNetworkProfile exported', () => {
  match(profile, /export function getSelectedNetworkProfile/);
});
check('normalizeNetworkEnv defaults to testnet', () => {
  match(profile, /return value === .mainnet. \? .mainnet. : .testnet./);
});
check('localStorage key is arctis-network-env', () => {
  match(profile, /arctis-network-env/);
});

// ── 4. wagmi chain config preserved ──────────────────────────────────────────
section('4. wagmi chain config');
check('Arc Testnet 5042002 defined', () => {
  match(wagmi, /id:\s*5042002/);
});
check('Arc Mainnet 5042 defined', () => {
  match(wagmi, /id:\s*5042[^0]/);
});
check('Testnet RPC endpoint present', () => {
  match(wagmi, /rpc\.testnet\.arc\.io/);
});
check('Mainnet RPC endpoint present', () => {
  match(wagmi, /rpc\.mainnet\.arc\.io/);
});
check('injectedWallet in Recommended group', () => {
  match(wagmi, /injectedWallet/);
});
check('walletConnectWallet present as fallback', () => {
  match(wagmi, /walletConnectWallet/);
});

// ── 5. Brave mobile fix preserved (PR #27) ───────────────────────────────────
section('5. Brave mobile fix preserved');
check('WalletConnectionGuard file exists and has hasBraveProvider', () => {
  match(guard, /hasBraveProvider/);
});
check('WalletConnectionGuard detects navigator.brave', () => {
  match(guard, /navigator\.brave/);
});
check('WalletConnectionGuard handles eth_requestAccounts', () => {
  match(guard, /eth_requestAccounts/);
});
check('Dashboard imports WalletConnectionGuard dynamically', () => {
  const dashboard = readFileSync('src/app/dashboard/page.tsx', 'utf8');
  match(dashboard, /WalletConnectionGuard/);
});

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(50));
console.log(`Passed: ${passed} / ${passed + failed}`);
if (failed > 0) {
  console.error(`Failed: ${failed}`);
  process.exit(1);
} else {
  console.log('All assertions passed.\n');
}
