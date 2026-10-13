import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');

const contracts = read('src/lib/contracts.ts');
const wagmi = read('src/lib/chain/wagmi.ts');
const transfer = read('src/lib/hooks/useTransfer.ts');
const balance = read('src/lib/hooks/useUSDCBalance.ts');
const tarc = read('src/lib/hooks/useTARCBalance.ts');
const switcher = read('src/lib/hooks/useChainSwitch.ts');
const bridgePage = read('src/app/bridge/page.tsx');
const bridgeRoute = read('src/app/api/bridge/route.ts');
const bridgeQuote = read('src/app/api/bridge/quote/route.ts');
const bridgeRecord = read('src/app/api/bridge/record/route.ts');
const swapPage = read('src/app/swap/page.tsx');
const swapExecute = read('src/app/api/swap/execute/route.ts');

assert.doesNotMatch(contracts, /localStorage\.getItem|getItem\(['"]arctis-network-env/,
  'contracts.ts must not derive module-level network constants from browser storage');

assert.match(wagmi, /id:\s*5042002[\s\S]*rpc\.testnet\.arc\.io/);
assert.match(wagmi, /id:\s*5042[\s\S]*rpc\.mainnet\.arc\.io/);
assert.doesNotMatch(contracts, /RPC_FALLBACK_URLS/);
assert.match(wagmi, /transports:\s*\{/);
assert.match(wagmi, /\[arcTestnet\.id\]: fallback\(\[/);
assert.match(wagmi, /\[arcMainnet\.id\]: http\('https:\/\/rpc\.mainnet\.arc\.io'\)/);
assert.doesNotMatch(wagmi, /\[arcMainnet\.id\][\s\S]*rpc\.testnet/);
assert.doesNotMatch(wagmi, /RPC_FALLBACK_URLS/,
  'wagmi chain definitions must not inherit a single build-time network RPC');

assert.match(transfer, /TESTNET_NETWORK.*MAINNET_NETWORK/);
assert.match(transfer, /arcTestnet.*arcMainnet/);
assert.match(transfer, /providerChainId !== network\.chainId/);

assert.match(balance, /chainId:\s*profile\.chainId/);
assert.doesNotMatch(balance, /import \{ getSelectedNetworkEnv, type NetworkEnv \}[^;]*;[\s\S]*type NetworkEnv =/,
  'USDC balance hook must not redeclare NetworkEnv after importing it');
assert.match(balance, /chainId: profile\.chainId/);
const agent = read('src/components/agent/EconomicAgentPanel.tsx');
assert.match(agent, /useBalance\(\{[\s\S]*chainId:\s*selectedNetwork\.chainId/);
assert.match(tarc, /network === 'testnet'/);
assert.match(tarc, /Never query a test asset on Mainnet/);
// useChainSwitch must derive the target chain ID from the selected network profile
// at call-time — never hardcode 5042002 (testnet) or 5042 (mainnet) as a literal.
assert.ok(
  switcher.includes('getSelectedNetworkProfile') || switcher.includes('getNetworkProfile'),
  'useChainSwitch must call getSelectedNetworkProfile() or getNetworkProfile() to derive chainId',
);
assert.doesNotMatch(
  switcher,
  /switchChainAsync\s*\(\s*\{\s*chainId\s*:\s*5042002\s*\}/,
  'useChainSwitch must not hardcode testnet chain ID 5042002 as the switch target',
);
assert.doesNotMatch(
  switcher,
  /chainId\s*:\s*5042002/,
  'useChainSwitch must not contain literal 5042002 anywhere',
);
assert.doesNotMatch(
  switcher,
  /chainId\s*:\s*5042[^0-9]/,
  'useChainSwitch must not contain literal 5042 anywhere',
);

assert.match(bridgeRoute, /network.*mainnet/);
assert.match(bridgeQuote, /network.*testnet/);
assert.match(bridgeRecord, /network !== 'testnet'/);
assert.match(bridgeRecord, /rpc\.testnet\.arc\.io/);
assert.match(bridgePage, /networkEnv !== 'testnet'/);
assert.match(bridgePage, /network: networkEnv/);

assert.match(swapPage, /network: networkEnv/);
assert.match(swapExecute, /body\.network !== 'testnet'/);

console.log('network isolation regression checks passed');
