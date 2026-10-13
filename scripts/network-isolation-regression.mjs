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
const paymentVerifier = read('src/lib/chain/verify.ts');
const membershipApi = read('src/app/api/membership/route.ts');
const creditsApi = read('src/app/api/credits/route.ts');
const membershipPage = read('src/app/membership/page.tsx');
const creditsPage = read('src/app/credits/page.tsx');

assert.doesNotMatch(contracts, /localStorage|getItem\(['"]arctis-network-env/,
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
assert.match(switcher, /getNetworkProfile\(network\)/);

assert.match(bridgeRoute, /network.*mainnet/);
assert.match(bridgeQuote, /network.*testnet/);
assert.match(bridgeRecord, /network !== 'testnet'/);
assert.match(bridgeRecord, /rpc\.testnet\.arc\.io/);
assert.match(bridgePage, /networkEnv !== 'testnet'/);
assert.match(bridgePage, /network: networkEnv/);

assert.match(swapPage, /network: networkEnv/);
assert.match(swapExecute, /body\.network !== 'testnet'/);

// Financial APIs must reject absent/unknown network context and bind payment to
// the authenticated sender, network-specific token and treasury, and exact amount.
assert.match(paymentVerifier, /verifyUSDCPayment\\([\\s\\S]*network: NetworkEnv,[\\s\\S]*expectedSender: string/);
assert.match(paymentVerifier, /clients\\[network\\]/);
assert.match(paymentVerifier, /tx\\.from\\.toLowerCase\\(\\) !== expectedSender\\.toLowerCase\\(\\)/);
assert.match(paymentVerifier, /value === expectedAmount/);
assert.match(paymentVerifier, /process\\.env\\.NEXT_PUBLIC_ARCTIS_MAINNET_TREASURY/);
assert.match(contracts, /NEXT_PUBLIC_ARCTIS_MAINNET_TREASURY \\|\\| ZERO_ADDRESS/);
assert.match(membershipApi, /!network/);
assert.match(membershipApi, /plan\\.priceUSDC, network, walletAddress/);
assert.match(creditsApi, /!network/);
assert.match(creditsApi, /pkg\\.usdcAmount, network, walletAddress/);
assert.match(membershipPage, /network: pendingNetworkRef\\.current/);
assert.match(creditsPage, /network: pendingNetworkRef\\.current/);
assert.match(membershipPage, /getNetworkProfile\\(pendingNetworkRef\\.current\\)\\.treasury/);
assert.match(creditsPage, /getNetworkProfile\\(pendingNetworkRef\\.current\\)\\.treasury/);

console.log('network isolation and payment verification regression checks passed');
