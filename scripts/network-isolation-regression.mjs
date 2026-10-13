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
const creditEngine = read('src/lib/credits/engine.ts');
const membershipService = read('src/lib/memberships/service.ts');

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
// String assertions avoid over-escaped regex literals breaking this test itself.
assert.ok(paymentVerifier.includes('network: NetworkEnv'));
assert.ok(paymentVerifier.includes('expectedSender: string'));
assert.ok(paymentVerifier.includes('clients[network]'));
assert.ok(paymentVerifier.includes('tx.from.toLowerCase() !== expectedSender.toLowerCase()'));
assert.ok(paymentVerifier.includes('value === expectedAmount'));
assert.ok(paymentVerifier.includes('process.env.NEXT_PUBLIC_ARCTIS_MAINNET_TREASURY'));
assert.ok(contracts.includes('NEXT_PUBLIC_ARCTIS_MAINNET_TREASURY || ZERO_ADDRESS'));
assert.ok(membershipApi.includes('!network'));
assert.ok(membershipApi.includes('plan.priceUSDC, network, walletAddress'));
assert.ok(creditsApi.includes('!network'));
assert.ok(creditsApi.includes('pkg.usdcAmount, network, walletAddress'));
assert.ok(membershipPage.includes('network: pendingNetworkRef.current'));
assert.ok(creditsPage.includes('network: pendingNetworkRef.current'));
assert.ok(membershipPage.includes('getNetworkProfile(pendingNetworkRef.current).treasury'));
assert.ok(creditsPage.includes('getNetworkProfile(pendingNetworkRef.current).treasury'));
assert.ok(membershipPage.includes('Mainnet treasury is not configured; payment is disabled'));
assert.ok(creditsPage.includes('Mainnet treasury is not configured; payment is disabled'));
assert.ok(creditEngine.includes('tx_' + '${txHash.toLowerCase()}'));
assert.ok(creditEngine.includes('transaction_already_processed'));
assert.ok(membershipService.includes("priorClaim = await db.collection(MEMBERSHIPS_COL).where('txHash', '==', txHash)"));
assert.ok(membershipService.includes('existing.tier !== tier'));

console.log('network isolation and payment verification regression checks passed');
