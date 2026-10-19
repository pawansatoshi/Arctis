/**
 * ARCTIS Chain-Switch and Settings RPC Regression Tests
 *
 * Verifies that:
 * 1. useChainSwitch derives the target chain ID from the selected network
 *    profile at call-time — never hardcodes 5042002 (testnet) as the target.
 * 2. The settings page shows the selected network's RPC endpoint, chain name,
 *    chain ID, and explorer — not a hardcoded testnet string.
 *
 * Run: node scripts/chain-switch-regression.mjs
 * Static analysis only — no browser, no wagmi, no on-chain calls.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const switcher  = read('src/lib/hooks/useChainSwitch.ts');
const settings  = read('src/app/settings/page.tsx');
const profile   = read('src/lib/network/profile.ts');
const contracts = read('src/lib/contracts.ts');

// ══════════════════════════════════════════════════════════════
// 1. useChainSwitch — network-aware target chain
// ══════════════════════════════════════════════════════════════

// Must import from profile, not from contracts directly for the chain ID.
assert.ok(
  switcher.includes('getSelectedNetworkProfile') || switcher.includes('getNetworkProfile'),
  'useChainSwitch: must call getSelectedNetworkProfile() or getNetworkProfile() to derive chainId',
);

// Must NOT hardcode the testnet chain ID as the switch target.
assert.doesNotMatch(
  switcher,
  /switchChainAsync\s*\(\s*\{\s*chainId\s*:\s*5042002\s*\}/,
  'useChainSwitch: must not hardcode testnet chain ID 5042002 as the switchChainAsync target',
);

// Must NOT hardcode the mainnet chain ID either — always derive.
assert.doesNotMatch(
  switcher,
  /switchChainAsync\s*\(\s*\{\s*chainId\s*:\s*5042\s*\}/,
  'useChainSwitch: must not hardcode mainnet chain ID 5042 as the switchChainAsync target',
);

// The switch target must come from a variable sourced from the profile.
assert.ok(
  switcher.match(/switchChainAsync\s*\(\s*\{\s*chainId\s*:\s*(currentTargetId|targetChainId|profile\.chainId|CHAIN_ID)\s*\}/),
  'useChainSwitch: switchChainAsync target must use a profile-derived variable, not a literal',
);

// Testnet profile chainId 5042002 must come from contracts/profile, not be literal in switcher.
assert.doesNotMatch(
  switcher,
  /chainId\s*:\s*5042002/,
  'useChainSwitch: must not contain literal chainId 5042002 anywhere',
);

// Mainnet profile chainId 5042 must come from contracts/profile, not be literal in switcher.
assert.doesNotMatch(
  switcher,
  /chainId\s*:\s*5042[^0-9]/,
  'useChainSwitch: must not contain literal chainId 5042 anywhere',
);

// returnedValue targetChainId must be profile-derived, not a literal.
assert.ok(
  switcher.includes('targetChainId') && (
    switcher.includes('profile.chainId') ||
    switcher.includes('currentProfile.chainId') ||
    switcher.includes('currentTargetId')
  ),
  'useChainSwitch: exported targetChainId must be derived from profile.chainId',
);

// ══════════════════════════════════════════════════════════════
// 2. Settings page — network-aware display
// ══════════════════════════════════════════════════════════════

// The retired Arc Testnet RPC must not remain in settings or wallet transports.
assert.doesNotMatch(
  settings,
  /rpc\.testnet\.arc\.network/,
  'Settings: must not hardcode the retired rpc.testnet.arc.network endpoint',
);
assert.doesNotMatch(
  settings,
  /rpc\.testnet\.arc\.io(?!['"])/,
  'Settings: must not hardcode rpc.testnet.arc.io as a bare string (derive from profile.rpc)',
);

// Must NOT hardcode the mainnet RPC string.
assert.doesNotMatch(
  settings,
  /rpc\.mainnet\.arc\.io(?!['"])/,
  'Settings: must not hardcode rpc.mainnet.arc.io as a bare string (derive from profile.rpc)',
);

// Must use networkProfile.rpc (or equivalent) to display the RPC endpoint.
assert.ok(
  settings.includes('networkProfile.rpc') || settings.includes('profile.rpc'),
  'Settings: RPC endpoint must be read from networkProfile.rpc, not a string literal',
);

// Must use networkProfile.chainId to display the chain ID.
assert.ok(
  settings.includes('networkProfile.chainId') || settings.includes('profile.chainId'),
  'Settings: Chain ID must be read from networkProfile.chainId',
);

// Must use networkProfile.networkName to display the network name.
assert.ok(
  settings.includes('networkProfile.networkName') || settings.includes('profile.networkName'),
  'Settings: Network name must be read from networkProfile.networkName',
);

// Must use networkProfile.explorer to display the explorer link.
assert.ok(
  settings.includes('networkProfile.explorer') || settings.includes('profile.explorer'),
  'Settings: Explorer URL must be read from networkProfile.explorer',
);

// Must import getSelectedNetworkProfile (or getNetworkProfile) from profile module.
assert.ok(
  settings.includes('getSelectedNetworkProfile') || settings.includes('getNetworkProfile'),
  'Settings: must import and call getSelectedNetworkProfile() from network/profile',
);

// Must handle hydration — either useEffect or useState initializer must call profile getter.
assert.ok(
  settings.includes('getSelectedNetworkProfile') &&
  (settings.includes('useState') || settings.includes('useEffect')),
  'Settings: must use useState/useEffect to handle SSR→CSR hydration of network profile',
);

// ══════════════════════════════════════════════════════════════
// 3. Cross-check: profile module exposes both networks correctly
// ══════════════════════════════════════════════════════════════

// testnet profile must have testnet RPC
assert.ok(
  contracts.includes("rpc: 'https://rpc.testnet.arc.io'"),
  'Contracts: testnet profile must use https://rpc.testnet.arc.io',
);

// mainnet profile must have mainnet RPC
assert.ok(
  contracts.includes("rpc: 'https://rpc.mainnet.arc.io'"),
  'Contracts: mainnet profile must use https://rpc.mainnet.arc.io',
);

// getNetworkProfile is exported from profile module
assert.ok(
  profile.includes('getNetworkProfile') && profile.includes('getSelectedNetworkProfile'),
  'Profile: getNetworkProfile and getSelectedNetworkProfile must both be exported',
);

// DEFAULT_NETWORK_ENV must be testnet
assert.ok(
  profile.includes("DEFAULT_NETWORK_ENV: NetworkEnv = 'testnet'"),
  'Profile: DEFAULT_NETWORK_ENV must be testnet',
);

// ══════════════════════════════════════════════════════════════
// 4. Testnet switch scenario (static simulation)
// ══════════════════════════════════════════════════════════════
// Simulate: TESTNET profile → chainId must be 5042002
{
  // Extract testnet chainId from contracts.ts
  const testnetMatch = contracts.match(/\/\/ ─── Arc Testnet[\s\S]*?chainId:\s*(\d+)/);
  assert.ok(testnetMatch, 'Contracts: must define testnet chainId');
  assert.equal(Number(testnetMatch[1]), 5042002, 'Contracts: testnet chainId must be 5042002');
}

// ══════════════════════════════════════════════════════════════
// 5. Mainnet switch scenario (static simulation)
// ══════════════════════════════════════════════════════════════
// Simulate: MAINNET profile → chainId must be 5042
{
  const mainnetMatch = contracts.match(/\/\/ ─── Arc Mainnet[\s\S]*?chainId:\s*(\d+)/);
  assert.ok(mainnetMatch, 'Contracts: must define mainnet chainId');
  assert.equal(Number(mainnetMatch[1]), 5042, 'Contracts: mainnet chainId must be 5042');
}

// RPC for each network is correct
{
  const testnetRpcMatch = contracts.match(/\/\/ ─── Arc Testnet[\s\S]*?rpc:\s*'([^']+)'/);
  assert.ok(testnetRpcMatch, 'Contracts: testnet RPC must be defined');
  assert.equal(testnetRpcMatch[1], 'https://rpc.testnet.arc.io', 'Contracts: testnet RPC must be https://rpc.testnet.arc.io');
}
{
  const mainnetRpcMatch = contracts.match(/\/\/ ─── Arc Mainnet[\s\S]*?rpc:\s*'([^']+)'/);
  assert.ok(mainnetRpcMatch, 'Contracts: mainnet RPC must be defined');
  assert.equal(mainnetRpcMatch[1], 'https://rpc.mainnet.arc.io', 'Contracts: mainnet RPC must be https://rpc.mainnet.arc.io');
}

console.log('');
console.log('✓ All chain-switch and settings RPC regression checks passed');
console.log('  useChainSwitch: target chain ID derived from profile, no literals');
console.log('  Settings page: RPC, chain ID, name, explorer from networkProfile');
console.log('  Testnet switch target: 5042002 (from profile)');
console.log('  Mainnet switch target: 5042 (from profile)');
console.log('  Testnet RPC: https://rpc.testnet.arc.io');
console.log('  Mainnet RPC: https://rpc.mainnet.arc.io');
