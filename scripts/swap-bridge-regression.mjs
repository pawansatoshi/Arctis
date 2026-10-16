#!/usr/bin/env node
/**
 * ARCTIS Swap + Bridge Mainnet Regression
 *
 * Verifies:
 * 1. Atomic swap record — createSwapRecord uses runTransaction (race condition fix)
 * 2. Mainnet swap — Circle App Kit "Arc" chain identifier enabled
 * 3. Mainnet bridge — CCTP_BRIDGE_CHAINS_MAINNET present with correct chain IDs
 * 4. Testnet swap/bridge — unchanged, still present
 * 5. Network isolation — OTC swap stays testnet-only; mainnet swap uses App Kit
 * 6. USDC↔NATIVE no-op guard — documented on Arc (same asset)
 * 7. Mainnet bridge chain registry — Arc domain 25, correct USDC addresses
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

console.log('\n1. Atomic swap record (race condition fix)');
check('createSwapRecord uses db.runTransaction()', () => {
  assert.match(service, /db\.runTransaction\s*\(/);
});
check('atomic block: snap.exists throws swap_already_processed', () => {
  assert.match(service, /snap\.exists[\s\S]{0,60}swap_already_processed/);
});
check('no non-atomic db.collection().doc().set() pattern in createSwapRecord', () => {
  // The old pattern was: await db.collection(COL).doc(data.id).set({...})
  // The transaction wraps the set; verify the bare .set( is inside runTransaction
  const txBlock = service.match(/runTransaction[\s\S]*?\}\s*\)/)?.[0] ?? '';
  assert.ok(txBlock.includes('tx.set('), 'tx.set() should be inside the transaction block');
  assert.ok(!service.match(/await\s+db\.collection\(COL\)\.doc\(data\.id\)\.set\s*\(/),
    'direct non-transactional .set() should not exist for createSwapRecord');
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
check('swap page uses ARC_APPKIT_CHAIN[networkEnv] for estimateSwap', () => {
  assert.match(swapPage, /ARC_APPKIT_CHAIN\[networkEnv\]/);
});
check('swap page uses ARC_APPKIT_CHAIN[networkEnv] for kit.swap()', () => {
  // Should appear at least twice (estimate + execute)
  const hits = [...swapPage.matchAll(/ARC_APPKIT_CHAIN\[networkEnv\]/g)];
  assert.ok(hits.length >= 2, `Expected ≥2 uses of ARC_APPKIT_CHAIN[networkEnv], found ${hits.length}`);
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
check('OTC swap still gated to testnet only on server', () => {
  // body.network !== 'testnet' guard must exist and a 503 response must follow
  assert.match(swapExecute, /body\.network !== 'testnet'/);
  assert.match(swapExecute, /status: 503/);
});

console.log('\n3. Mainnet bridge — CCTP chains');
check('CCTP_BRIDGE_CHAINS_MAINNET exported from contracts.ts', () => {
  assert.match(contracts, /CCTP_BRIDGE_CHAINS_MAINNET/);
});
check('Arc Mainnet domain 25 in CCTP_BRIDGE_CHAINS_MAINNET', () => {
  assert.match(contracts, /domain\s*:\s*25/);
});
check('Arc Mainnet appKitChain: "Arc" in CCTP_BRIDGE_CHAINS_MAINNET', () => {
  // Find the mainnet block
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

console.log('\n4. Testnet preservation');
check('CCTP_BRIDGE_CHAINS (testnet) still present and unchanged', () => {
  assert.match(contracts, /CCTP_BRIDGE_CHAINS\s*=\s*\{/);
  assert.match(contracts, /'5042002'\s*:/);
  assert.match(contracts, /Arc_Testnet/);
});
check('testnet bridge chains: Arc Testnet domain 26', () => {
  // Should be in the testnet block (before the mainnet block)
  const testnetIdx = contracts.indexOf('CCTP_BRIDGE_CHAINS =');
  const mainnetIdx = contracts.indexOf('CCTP_BRIDGE_CHAINS_MAINNET');
  const testnetBlock = contracts.slice(testnetIdx, mainnetIdx);
  assert.match(testnetBlock, /domain\s*:\s*26/);
});
check('swap OTC routes remain testnet-only (server-side gate unchanged)', () => {
  assert.match(swapExecute, /network !== 'testnet'/);
});

console.log('\n5. USDC↔NATIVE no-op guard (Arc-specific)');
check('Circle swap pair guard (isCircleSwapPair) prevents same-token swap', () => {
  // isCircleSwapPair returns false when fromToken === toToken
  const circleTs = readFileSync('src/lib/swap/circle.ts', 'utf8');
  assert.match(circleTs, /fromToken !== toToken/);
});

console.log('\n─────────────────────────────────────────');
console.log(`Passed: ${pass.length} / ${pass.length + fail.length}`);
if (fail.length) {
  console.error(`\nFailed: ${fail.join(', ')}`);
  process.exit(1);
}
console.log('All assertions passed.\n');
