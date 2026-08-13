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
  // Official Arc Testnet RPC. Source: Arc developer documentation.
  rpc: 'https://rpc.testnet.arc.io',
  explorer: 'https://testnet.arcscan.app',
  networkName: 'Arc Testnet',
  contracts: {
    // Arc Native USDC — system precompile, primary payment asset
    USDC:  '0x3600000000000000000000000000000000000000',
    // ARCTIS application swap assets (not Circle-native swap assets)
    tUSDC: '0x28E49B36C1c6fD16ad81aB152488f37C93b3D8CA',
    tARC:  '0xe66a11cb4b147F208e6d81B7540bfc83E1680c78',
  },
  decimals: {
    USDC:  6,
    tUSDC: 6,
    tARC:  18,
  },
  treasury: '0xb467F683764593316fAEbB0709127E90791Fe47F',
} as const;

// ─── Arc Mainnet (future) ──────────────────────────────────
const MAINNET = {
  chainId: 42069,
  rpc: 'https://rpc.arc.network',
  explorer: 'https://arcscan.app',
  networkName: 'Arc Mainnet',
  contracts: {
    USDC:  '0x3600000000000000000000000000000000000000',
    tUSDC: '0x0000000000000000000000000000000000000000',
    tARC:  '0x0000000000000000000000000000000000000000',
  },
  decimals: {
    USDC:  6,
    tUSDC: 6,
    tARC:  18,
  },
  treasury: '0x0000000000000000000000000000000000000000',
} as const;

export const NETWORK = ENV === 'mainnet' ? MAINNET : TESTNET;

export const CHAIN_ID        = NETWORK.chainId;
export const RPC_URL         = NETWORK.rpc;

// Official Arc Testnet RPC providers documented by Arc.
export const RPC_FALLBACK_URLS = [
  RPC_URL,
  'https://rpc.blockdaemon.testnet.arc.io',
  'https://rpc.drpc.testnet.arc.io',
  'https://rpc.quicknode.testnet.arc.io',
].filter(Boolean);

export const EXPLORER_URL    = NETWORK.explorer;
export const NETWORK_NAME    = NETWORK.networkName;
export const CONTRACTS       = NETWORK.contracts;
export const DECIMALS        = NETWORK.decimals;
export const TREASURY_WALLET = NETWORK.treasury as `0x${string}`;

export const PRIMARY_TOKEN    = 'USDC' as const;
export const PRIMARY_DECIMALS = DECIMALS.USDC;
export const PRIMARY_CONTRACT = CONTRACTS.USDC as `0x${string}`;

export const TUSDC_CONTRACT = CONTRACTS.tUSDC as `0x${string}`;
export const TARC_CONTRACT  = CONTRACTS.tARC  as `0x${string}`;

export const txUrl      = (hash: string) => `${EXPLORER_URL}/tx/${hash}`;
export const addressUrl = (addr: string) => `${EXPLORER_URL}/address/${addr}`;

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

export const CCTP_SOURCE_CHAINS = {
  '11155111': { name: 'Ethereum Sepolia', domain: 0, usdc: '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238', explorer: 'https://sepolia.etherscan.io' },
  '84532':    { name: 'Base Sepolia',     domain: 6, usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', explorer: 'https://sepolia.basescan.org' },
  '421614':   { name: 'Arbitrum Sepolia', domain: 3, usdc: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d', explorer: 'https://sepolia.arbiscan.io' },
} as const;

export const CCTP_BRIDGE_CHAINS = {
  '5042002': {
    name: 'Arc Testnet',
    domain: 26,
    usdc: CONTRACTS.USDC,
    explorer: EXPLORER_URL,
    appKitChain: 'Arc_Testnet',
  },
  '11155111': {
    name: 'Ethereum Sepolia',
    domain: 0,
    usdc: '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238',
    explorer: 'https://sepolia.etherscan.io',
    appKitChain: 'Ethereum_Sepolia',
  },
  '84532': {
    name: 'Base Sepolia',
    domain: 6,
    usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    explorer: 'https://sepolia.basescan.org',
    appKitChain: 'Base_Sepolia',
  },
  '421614': {
    name: 'Arbitrum Sepolia',
    domain: 3,
    usdc: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
    explorer: 'https://sepolia.arbiscan.io',
    appKitChain: 'Arbitrum_Sepolia',
  },
} as const;

export const MEMO_CONTRACT   = '0x5294E9927c3306DcBaDb03fe70b92e01cCede505' as const;
export const MULTICALL3_FROM = '0x522fAf9A91c41c443c66765030741e4AaCe147D0' as const;

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

export const MEMO_ABI = [
  { inputs: [{ name: 'data', type: 'bytes' }], name: 'memo', outputs: [], stateMutability: 'nonpayable', type: 'function' },
] as const;
