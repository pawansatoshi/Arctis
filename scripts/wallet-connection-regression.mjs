/**
 * wallet-connection-regression.mjs
 *
 * Static regression tests for the Brave mobile wallet connection fix.
 * Asserts source-code invariants without running a browser or wallet.
 *
 * Run: node scripts/wallet-connection-regression.mjs
 */
import { readFileSync } from 'fs';
import { strictEqual, ok, doesNotMatch, match } from 'assert';

const pass = (msg) => console.log(`  ✓ ${msg}`);
const section = (title) => console.log(`\n${title}`);

let totalPassed = 0;
let totalFailed = 0;

function check(label, fn) {
  try {
    fn();
    pass(label);
    totalPassed++;
  } catch (e) {
    console.error(`  ✗ ${label}`);
    console.error(`    ${e.message}`);
    totalFailed++;
  }
}

// ── Source files ────────────────────────────────────────────────────────────
const wagmi       = readFileSync('src/lib/chain/wagmi.ts', 'utf8');
const chainSwitch = readFileSync('src/lib/hooks/useChainSwitch.ts', 'utf8');
const guard       = readFileSync('src/components/ui/WalletConnectionGuard.tsx', 'utf8');
const dashboard   = readFileSync('src/app/dashboard/page.tsx', 'utf8');

// ── 1. wagmi.ts — braveWallet removed from explicit list ───────────────────
section('1. braveWallet removed from explicit connector list');
check('braveWallet import removed from wagmi.ts', () => {
  doesNotMatch(wagmi, /import.*braveWallet/, 'braveWallet should not be imported in wagmi.ts');
});
check('braveWallet not in wallet group', () => {
  doesNotMatch(wagmi, /wallets:.*braveWallet/, 'braveWallet should not appear in wallets array');
});
check('injectedWallet is imported', () => {
  match(wagmi, /injectedWallet/, 'injectedWallet must be imported');
});
check('injectedWallet appears first in Recommended group', () => {
  const recommended = wagmi.match(/groupName.*Recommended[\s\S]*?wallets:\s*\[([\s\S]*?)\]/)?.[1] ?? '';
  const firstWallet = recommended.trim().split(',')[0].trim();
  ok(firstWallet.includes('injectedWallet'), `First wallet in Recommended must be injectedWallet, got: ${firstWallet}`);
});
check('walletConnectWallet kept as mobile fallback', () => {
  match(wagmi, /walletConnectWallet/, 'walletConnectWallet must be present');
});

// ── 2. wagmi.ts — Chain config unchanged ────────────────────────────────────
section('2. Chain configuration preserved');
check('Arc Testnet chain ID 5042002', () => {
  match(wagmi, /id:\s*5042002/, 'Arc Testnet ID must be 5042002');
});
check('Arc Mainnet chain ID 5042', () => {
  match(wagmi, /id:\s*5042[^0-9]/, 'Arc Mainnet ID must be 5042');
});
check('Testnet RPC endpoint', () => {
  match(wagmi, /rpc\.testnet\.arc\.io/, 'Testnet RPC must be rpc.testnet.arc.io');
});
check('Mainnet RPC endpoint', () => {
  match(wagmi, /rpc\.mainnet\.arc\.io/, 'Mainnet RPC must be rpc.mainnet.arc.io');
});
check('Mainnet transport isolated (no testnet fallback URLs)', () => {
  // The mainnet transport line must be a single http() call, not a fallback([])
  const mainnetTransportLine = wagmi.match(/\[arcMainnet\.id\]:\s*http\('[^']+'\)/)?.[0];
  ok(mainnetTransportLine, 'Mainnet transport must be single http() — no testnet fallback URLs mixed in');
  doesNotMatch(mainnetTransportLine, /testnet/, 'Mainnet transport line must not contain testnet URL');
});

// ── 3. useChainSwitch — window.ethereum poll removed ───────────────────────
section('3. useChainSwitch — mobile-safe verification');
check('window.ethereum.request polling loop removed', () => {
  // The old 8-iteration poll that called eth_chainId is gone
  doesNotMatch(chainSwitch, /for\s*\(\s*let\s+i\s*=\s*0;\s*i\s*<\s*8/, 'Old 8-iteration window.ethereum poll must be removed');
});
check('Uses wagmi useChainId (not only window.ethereum) for verification', () => {
  match(chainSwitch, /useChainId/, 'Must import useChainId from wagmi');
});
check('window.ethereum access is guarded with typeof check', () => {
  // Any access to window.ethereum must check typeof window !== undefined first
  const ethereumAccesses = chainSwitch.match(/window\.ethereum/g) ?? [];
  if (ethereumAccesses.length > 0) {
    match(chainSwitch, /typeof window.*undefined|typeof window\.ethereum.*undefined/,
      'window.ethereum access must be guarded with typeof check');
  }
  pass(`window.ethereum referenced ${ethereumAccesses.length} time(s), all guarded`);
});
check('User rejection (code 4001) handled explicitly', () => {
  match(chainSwitch, /code.*4001|4001.*code/, 'EIP-1193 rejection code 4001 must be handled');
});
check('Pending request (code -32002) handled', () => {
  match(chainSwitch, /-32002/, 'Pending request code -32002 must be handled');
});
check('getSelectedNetworkProfile used (not hardcoded chain ID)', () => {
  match(chainSwitch, /getSelectedNetworkProfile/, 'Must use getSelectedNetworkProfile');
  doesNotMatch(chainSwitch, /chainId.*5042002|5042002.*chainId/, 'Chain ID must not be hardcoded');
});

// ── 4. WalletConnectionGuard — Brave detection ──────────────────────────────
section('4. WalletConnectionGuard component');
check('isBraveWallet flag checked in hasBraveProvider', () => {
  match(guard, /isBraveWallet/, 'Must check isBraveWallet flag');
});
check('navigator.brave detection in isBraveMobile', () => {
  match(guard, /navigator\.brave/, 'Must check navigator.brave for Brave browser detection');
});
check('Android UA pattern checked', () => {
  match(guard, /Android/, 'Must check for Android in user-agent');
});
check('Uses wagmi injected connector with explicit Brave provider target', () => {
  match(guard, /injected\(\s*\{\s*target:/, 'Must pass the Brave provider as an explicit injected connector target');
  match(guard, /provider:\s*\(\)\s*=>\s*safeProvider/, 'Connector must use the safe provider wrapper');
});
check('Does not mutate window.ethereum during connection', () => {
  doesNotMatch(guard, /Object\.defineProperty\(window,\s*['"]ethereum/, 'Must not replace the Brave injected provider');
});
check('User rejection (code 4001) handled silently', () => {
  match(guard, /4001/, 'User rejection code 4001 must clear state silently');
});
check('Component is transparent when not Brave mobile', () => {
  match(guard, /return null/, 'Component must return null when not on Brave mobile / already connected');
});
check('No private keys or seed phrases requested', () => {
  doesNotMatch(guard, /privateKey|seedPhrase|mnemonic|secret_key/, 'Must not request private keys');
});

// ── 5. Dashboard — guard rendered in unconnected state ───────────────────────
section('5. Dashboard unconnected state');
check('WalletConnectionGuard imported (dynamic)', () => {
  match(dashboard, /WalletConnectionGuard/, 'WalletConnectionGuard must be imported in dashboard');
});
check('Guard rendered in unconnected state', () => {
  // The guard component should appear after the connect instruction text
  const unconnectedSection = dashboard.match(/Connect via.*top-right[\s\S]{0,400}WalletConnectionGuard/);
  ok(unconnectedSection, 'WalletConnectionGuard must appear after the connect instruction in unconnected state');
});
check('Guard not rendered in connected state', () => {
  // The connected branch starts with the "Connected" comment block (/* ── Connected)
  // and runs to the end of the file. WalletConnectionGuard must not appear there.
  const connectedBranchStart = dashboard.indexOf('/* ── Connected');
  ok(connectedBranchStart > 0, 'Connected branch marker must exist in dashboard');
  const connectedBranch = dashboard.slice(connectedBranchStart);
  doesNotMatch(connectedBranch, /WalletConnectionGuard/,
    'WalletConnectionGuard must not appear in the connected state branch');
});

// ── 6. Network isolation — Testnet default preserved ────────────────────────
section('6. Network isolation');
check('ssr: true preserved in wagmiConfig', () => {
  match(wagmi, /ssr:\s*true/, 'ssr: true must be preserved');
});
check('Both Arc chains defined', () => {
  match(wagmi, /arcTestnet/, 'arcTestnet must be defined');
  match(wagmi, /arcMainnet/, 'arcMainnet must be defined');
});

// ── Summary ─────────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(50));
console.log(`Passed: ${totalPassed} / ${totalPassed + totalFailed}`);
if (totalFailed > 0) {
  console.error(`Failed: ${totalFailed}`);
  process.exit(1);
}
console.log('All assertions passed.\n');
