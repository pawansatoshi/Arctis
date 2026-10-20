#!/usr/bin/env node
/**
 * ARCTIS Swap + Bridge Regression
 *
 * Verifies:
 * 1. Atomic swap record — createSwapRecord uses runTransaction + tx.create (race condition fix)
 * 2. Mainnet swap — Circle App Kit "Arc" chain identifier enabled
 * 3. Mainnet bridge — CCTP_BRIDGE_CHAINS_MAINNET with CORRECT domain (26, not 25)
 * 4. Testnet swap/bridge — unchanged, still present
 * 5. Network isolation — OTC swap stays testnet-only; mainnet swap uses App Kit
 * 6. USDC↔NATIVE no-op guard — documented on Arc (same asset)
 * 7. Mainnet bridge API routes handle network=mainnet
 *
 * DOMAIN SAFETY NOTE: Arc Mainnet CCTP domain is 26.
 * Domain 25 = Starknet. Never use 25 for Arc — funds would route to Starknet.
 */

import { readFileSync } from 'fs';
import { strict as assert } from 'assert';

const pass = [];
const fail = [];

function check(name, fn) {
  try {
    fn();
    pass.push(name);
    console.log(`  ✓ ${name}`);
  } catch (e) {
    fail.push(name);
    console.error(`  ✗ ${name}: ${e.message}`);
  }
}

const service = readFileSync('src/lib/swap/service.ts', 'utf8');
const contracts = readFileSync('src/lib/contracts.ts', 'utf8');
const swapPage = readFileSync('src/app/swap/page.tsx', 'utf8');
const bridgePage = readFileSync('src/app/bridge/page.tsx', 'utf8');
const bridgeRoute = readFileSync('src/app/api/bridge/route.ts', 'utf8');
const bridgeQuote = readFileSync('src/app/api/bridge/quote/route.ts', 'utf8');
const swapExecute = readFileSync('src/app/api/swap/execute/route.ts', 'utf8');
const circleTs = readFileSync('src/lib/swap/circle.ts', 'utf8');

console.log('\n1. Atomic swap record (race condition fix — PR #34 pattern)');
check('createSwapRecord uses db.runTransaction()', () => {
  assert.match(service, /db\.runTransaction\s*\(/);
});
check('atomic block uses tx.create() not tx.set()', () => {
  const txBlock = service.match(/runTransaction[\s\S]*?\}\s*\)\s*;/)?.[0] ?? '';
  assert.ok(txBlock.includes('tx.create('), 'tx.create() should be used inside runTransaction');
  assert.ok(!txBlock.includes('tx.set('), 'tx.set() inside runTransaction is the PR #26 pattern — PR #34 uses tx.create');
});
check('atomic block returns false when existing.exists', () => {
  assert.match(service, /existing\.exists.*return false/s);
});
check('atomic block returns true after tx.create', () => {
  assert.match(service, /return true/);
});
check('createSwapRecord return type is Promise<boolean>', () => {
  assert.match(service, /Promise<boolean>/);
});
check('execute route captures createSwapRecord return value', () => {
  assert.match(swapExecute, /const created = await createSwapRecord\(/);
});
check('execute route returns 409 when !created', () => {
  assert.match(swapExecute, /if \(!created\)/);
  assert.match(swapExecute, /status: 409/);
});
check('no bare non-transactional .set() for createSwapRecord', () => {
  assert.doesNotMatch(service, /await\s+db\.collection\(COL\)\.doc\(data\.id\)\.set\s*\(/);
});

console.log('\n2. Mainnet swap — Circle App Kit "Arc" chain');
check('ARC_APPKIT_CHAIN exported from contracts.ts', () => {
  assert.match(contracts, /ARC_APPKIT_CHAIN/);
  assert.match(contracts, /'Arc'\s*as\s*const/);
  assert.match(contracts, /'Arc_Testnet'\s*as\s*const/);
});
check('swap page imports ARC_APPKIT_CHAIN', () => {
  assert.match(swapPage, /ARC_APPKIT_CHAIN/);
});
check('swap page uses arcChain from ARC_APPKIT_CHAIN[networkEnv]', () => {
  assert.match(swapPage, /ARC_APPKIT_CHAIN\[networkEnv\]/);
});
check('swap page uses arcChain as never (type cast for App Kit lag)', () => {
  assert.match(swapPage, /arcChain as never/);
});
check('swap page no longer has mainnet-disabled static screen', () => {
  assert.ok(
    !swapPage.includes('Swap is not enabled'),
    'old "Swap is not enabled" mainnet block should be removed',
  );
});
check('swap page shows mainnet disclaimer banner', () => {
  assert.match(swapPage, /Arc Mainnet.*Circle App Kit swap only/s);
});
check('swap page filters to USDC/EURC on mainnet (availableTokens)', () => {
  assert.match(swapPage, /availableTokens/);
  assert.match(swapPage, /networkEnv === 'mainnet'[\s\S]*USDC.*EURC/s);
});

console.log('\n3. Mainnet bridge — CCTP chains (DOMAIN SAFETY)');
check('CCTP_BRIDGE_CHAINS_MAINNET exported from contracts.ts', () => {
  assert.match(contracts, /CCTP_BRIDGE_CHAINS_MAINNET/);
});
check('Arc Mainnet CCTP domain is 26 (NOT 25 — 25 = Starknet)', () => {
  const mainnetIdx = contracts.indexOf('CCTP_BRIDGE_CHAINS_MAINNET');
  assert.ok(mainnetIdx !== -1, 'CCTP_BRIDGE_CHAINS_MAINNET must exist');
  const mainnetBlock = contracts.slice(mainnetIdx, mainnetIdx + 800);
  // 5042 entry should have domain: 26
  const arcEntry = mainnetBlock.match(/'5042'[\s\S]*?domain\s*:\s*(\d+)/)?.[1];
  assert.strictEqual(arcEntry, '26', `Arc Mainnet domain must be 26, got ${arcEntry}. Domain 25 = Starknet.`);
});
check('Arc Mainnet appKitChain: "Arc" in CCTP_BRIDGE_CHAINS_MAINNET', () => {
  const mainnetBlock = contracts.match(/CCTP_BRIDGE_CHAINS_MAINNET[\s\S]*?^} as const;/m)?.[0] ?? '';
  assert.match(mainnetBlock, /appKitChain\s*:\s*'Arc'/);
});
check('Arc Mainnet chain ID 5042 in CCTP_BRIDGE_CHAINS_MAINNET', () => {
  assert.match(contracts, /'5042'\s*:/);
});
check('Mainnet USDC addresses (EIP-55 checksummed) present', () => {
  assert.match(contracts, /0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/); // Ethereum USDC
  assert.match(contracts, /0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913/); // Base USDC
  assert.match(contracts, /0xaf88d065e77c8cC2239327C5EDb3A432268e5831/); // Arbitrum USDC
});
check('bridge API route handles mainnet', () => {
  assert.match(bridgeRoute, /CCTP_BRIDGE_CHAINS_MAINNET/);
  assert.match(bridgeRoute, /network === 'mainnet'/);
});
check('bridge quote route handles mainnet', () => {
  assert.match(bridgeQuote, /CCTP_BRIDGE_CHAINS_MAINNET/);
  assert.match(bridgeQuote, /network === 'mainnet'/);
});
check('bridge page no longer has mainnet-disabled static screen', () => {
  assert.ok(
    !bridgePage.includes('Bridge is not enabled'),
    'old "Bridge is not enabled" mainnet block should be removed',
  );
});
check('bridge page shows mainnet disclaimer banner', () => {
  assert.match(bridgePage, /Arc Mainnet.*Circle CCTP V2 bridge/s);
});
check('bridge page chains default to Arc Mainnet (5042) on mainnet', () => {
  assert.match(bridgePage, /arcChainId = networkEnv === 'mainnet' \? 5042 : 5042002/);
});
check('bridge loadQuote casts appKitChain as never', () => {
  assert.match(bridgePage, /appKitChain as never/);
});

console.log('\n4. Testnet preservation');
check('CCTP_BRIDGE_CHAINS (testnet) still present', () => {
  assert.match(contracts, /export const CCTP_BRIDGE_CHAINS\s*=/);
  assert.match(contracts, /'5042002'\s*:/);
  assert.match(contracts, /Arc_Testnet/);
});
check('testnet bridge chains: Arc Testnet domain 26', () => {
  const testnetIdx = contracts.indexOf('CCTP_BRIDGE_CHAINS =');
  const mainnetIdx = contracts.indexOf('CCTP_BRIDGE_CHAINS_MAINNET');
  const testnetBlock = contracts.slice(testnetIdx, mainnetIdx);
  assert.match(testnetBlock, /domain\s*:\s*26/);
});
check('swap OTC execute route is still testnet-gated', () => {
  assert.match(swapExecute, /network !== 'testnet'/);
});

console.log('\n5. USDC↔NATIVE no-op guard (Arc-specific)');
check('Circle swap pair guard (isCircleSwapPair) prevents same-token swap', () => {
  assert.match(circleTs, /fromToken !== toToken/);
});

console.log('\n─────────────────────────────────────────');
console.log(`Passed: ${pass.length} / ${pass.length + fail.length}`);
if (fail.length) {
  console.error(`\nFailed assertions: ${fail.join(', ')}`);
  process.exit(1);
}
console.log('All assertions passed.\n');
