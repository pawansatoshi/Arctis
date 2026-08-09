// ============================================================
// ARCTIS — Centralized Contract Configuration
// Single source of truth. Never hardcode addresses elsewhere.
// ============================================================

export type NetworkEnv = 'testnet' | 'mainnet';

const ENV: NetworkEnv =
  (process.env.NEXT_PUBLIC_NETWORK_ENV as NetworkEnv) ?? 'testnet';

// ─── Arc Testnet ────────────────────────────────────────────
const TESTNET = {
  chainId: 5042002,
  rpc: 'https://rpc.testnet.arc.network',
  explorer: 'https://testnet.arcscan.app',           // ✅ CORRECTED
  networkName: 'Arc Testnet',
  contracts: {
    // Arc Native USDC — system precompile, primary payment asset
    USDC:  '0x3600000000000000000000000000000000000000',
    // Swap-layer assets (NOT used for payments)
    tUSDC: '0x28E49B36C1c6fD16ad81aB152488f37C93b3D8CA',  // ✅ CORRECTED
    tARC:  '0xe66a11cb4b147F208e6d81B7540bfc83E1680c78',  // ✅ CORRECTED
  },
  decimals: {
    USDC:  6,
    tUSDC: 6,
    tARC:  18,
  },
  // Temporary testnet treasury wallet
  treasury: '0xb467F683764593316fAEbB0709127E90791Fe47F',  // ✅ REAL WALLET
} as const;

// ─── Arc Mainnet (future) ───────────────────────────────────
const MAINNET = {
  chainId: 42069,
  rpc: 'https://rpc.arc.network',
  explorer: 'https://arcscan.app',
  networkName: 'Arc Mainnet',
  contracts: {
    USDC:  '0x3600000000000000000000000000000000000000',
    tUSDC: '0x0000000000000000000000000000000000000000', // set on mainnet launch
    tARC:  '0x0000000000000000000000000000000000000000', // set on mainnet launch
  },
  decimals: {
    USDC:  6,
    tUSDC: 6,
    tARC:  18,
  },
  treasury: '0x0000000000000000000000000000000000000000', // set before mainnet
} as const;

export const NETWORK = ENV === 'mainnet' ? MAINNET : TESTNET;

// ─── Convenience exports ─────────────────────────────────────
export const CHAIN_ID        = NETWORK.chainId;
export const RPC_URL         = NETWORK.rpc;

// Fallback RPC endpoints (Phase 18 hardening). If the primary RPC
// is unresponsive, viem/wagmi's transport layer falls back to these
// in order. All target the same Arc Testnet chain — no chain ID
// or explorer change involved.
export const RPC_FALLBACK_URLS = [
  RPC_URL,
  'https://rpc.drpc.testnet.arc.network',
  'https://rpc.quicknode.testnet.arc.network',
].filter(Boolean);
export const EXPLORER_URL    = NETWORK.explorer;
export const NETWORK_NAME    = NETWORK.networkName;
export const CONTRACTS       = NETWORK.contracts;
export const DECIMALS        = NETWORK.decimals;
export const TREASURY_WALLET = NETWORK.treasury as `0x${string}`;

// Primary payment asset — Arc Native USDC
export const PRIMARY_TOKEN    = 'USDC' as const;
export const PRIMARY_DECIMALS = DECIMALS.USDC;
export const PRIMARY_CONTRACT = CONTRACTS.USDC as `0x${string}`;

// Swap layer
export const TUSDC_CONTRACT = CONTRACTS.tUSDC as `0x${string}`;
export const TARC_CONTRACT  = CONTRACTS.tARC  as `0x${string}`;

// Explorer URL builders — always use ArcScan
export const txUrl      = (hash: string) => `${EXPLORER_URL}/tx/${hash}`;
export const addressUrl = (addr: string) => `${EXPLORER_URL}/address/${addr}`;

// ─── ERC-20 ABI (covers USDC, tUSDC, tARC) ──────────────────
export const ERC20_ABI = [
  { inputs: [{ name: 'account', type: 'address' }], name: 'balanceOf', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], name: 'transfer', outputs: [{ name: '', type: 'bool' }], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], name: 'approve', outputs: [{ name: '', type: 'bool' }], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], name: 'allowance', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'decimals', outputs: [{ name: '', type: 'uint8' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'symbol', outputs: [{ name: '', type: 'string' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'name', outputs: [{ name: '', type: 'string' }], stateMutability: 'view', type: 'function' },
  { anonymous: false, inputs: [{ indexed: true, name: 'from', type: 'address' }, { indexed: true, name: 'to', type: 'address' }, { indexed: false, name: 'value', type: 'uint256' }], name: 'Transfer', type: 'event' },
] as const;

// ─── CCTP V2 — Arc Testnet (destination domain 26) ──────────
// Source: ARC_VERIFIED_ADDRESSES.md / docs.arc.io
export const ARC_CCTP = {
  domain:                26,
  tokenMessengerV2:      '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
  messageTransmitterV2:  '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275',
  tokenMinterV2:         '0xb43db544E2c27092c107639Ad201b3dEfAbcF192',
} as const;

// CCTP V2 source chains (testnet, verified)
export const CCTP_SOURCE_CHAINS = {
  '11155111': { name: 'Ethereum Sepolia', domain: 0,  usdc: '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238', tokenMessengerV2: '0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa', explorer: 'https://sepolia.etherscan.io' },
  '84532':    { name: 'Base Sepolia',     domain: 6,  usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', tokenMessengerV2: '0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa', explorer: 'https://sepolia.basescan.org' },
  '421614':   { name: 'Arbitrum Sepolia', domain: 3,  usdc: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d', tokenMessengerV2: '0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa', explorer: 'https://sepolia.arbiscan.io' },
} as const;

export const CCTP_IRIS_API = 'https://iris-api-sandbox.circle.com';
export const CCTP_FEES_API = (srcDomain: number, dstDomain: number) =>
  `${CCTP_IRIS_API}/v2/burn/USDC/fees/${srcDomain}/${dstDomain}?forward=true`;
export const CCTP_STATUS_API = (srcDomain: number, txHash: string) =>
  `${CCTP_IRIS_API}/v2/messages/${srcDomain}?transactionHash=${txHash}`;

// Memo contract (ARC_VERIFIED_ADDRESSES.md)
export const MEMO_CONTRACT          = '0x5294E9927c3306DcBaDb03fe70b92e01cCede505' as const;
export const MULTICALL3_FROM        = '0x522fAf9A91c41c443c66765030741e4AaCe147D0' as const;

// CCTP TokenMessenger ABI — depositForBurn only (Forwarding Service flow)
export const CCTP_TOKEN_MESSENGER_ABI = [
  {
    inputs: [
      { name: 'amount',                type: 'uint256' },
      { name: 'destinationDomain',     type: 'uint32'  },
      { name: 'mintRecipient',         type: 'bytes32' },
      { name: 'burnToken',             type: 'address' },
      { name: 'destinationCaller',     type: 'bytes32' },
      { name: 'maxFee',                type: 'uint256' },
      { name: 'minFinalityThreshold',  type: 'uint32'  },
    ],
    name: 'depositForBurn',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

// Memo ABI
export const MEMO_ABI = [
  { inputs: [{ name: 'data', type: 'bytes' }], name: 'memo', outputs: [], stateMutability: 'nonpayable', type: 'function' },
] as const;
