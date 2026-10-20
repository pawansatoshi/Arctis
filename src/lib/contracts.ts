// ============================================================
// ARCTIS — Centralized Contract Configuration
// Single source of truth. Never hardcode addresses elsewhere.
// ============================================================

export type NetworkEnv = 'testnet' | 'mainnet';

// Build/runtime configuration is server-side only.
// Client code must select a profile explicitly through src/lib/network/profile.ts.
// This prevents browser localStorage from silently changing module-level constants.
const ENV: NetworkEnv = process.env.NEXT_PUBLIC_NETWORK_ENV === 'mainnet' ? 'mainnet' : 'testnet';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;
const MAINNET_TREASURY = '0xb467F683764593316fAEbB0709127E90791Fe47F' as const;

// ─── Arc Testnet ────────────────────────────────────────────
// Token addresses verified from docs.arc.io/arc/references/contract-addresses (2026-10-20)
// EURC testnet:   0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a
// cirBTC testnet: 0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF
const TESTNET = {
  chainId: 5042002,
  rpc: 'https://rpc.testnet.arc.io',
  explorer: 'https://testnet.arcscan.app',
  networkName: 'Arc Testnet',
  contracts: {
    USDC:   '0x3600000000000000000000000000000000000000',
    EURC:   '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a',
    cirBTC: '0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF',
    tUSDC:  '0x28E49B36C1c6fD16ad81aB152488f37C93b3D8CA',
    tARC:   '0xe66a11cb4b147F208e6d81B7540bfc83E1680c78',
    AGENT_TREASURY: '0xf28541094031BD34bA08Ae98982F4348C9ADB94c',
  },
  decimals: { USDC: 6, EURC: 6, cirBTC: 8, tUSDC: 6, tARC: 18 },
  treasury: '0xf28541094031BD34bA08Ae98982F4348C9ADB94c',
} as const;

// ─── Arc Mainnet ────────────────────────────────────────────
// Token addresses verified from docs.arc.io/arc/references/contract-addresses (2026-10-20)
// USDC:   native precompile — same address on testnet and mainnet by design
// EURC:   0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1
// cirBTC: 0x171A4217b86A807A64eB94757Db6849fb4bDbAA0
const MAINNET = {
  chainId: 5042,
  rpc: 'https://rpc.mainnet.arc.io',
  explorer: 'https://explorer.arc.io',
  networkName: 'Arc Mainnet',
  contracts: {
    USDC:   '0x3600000000000000000000000000000000000000',
    EURC:   '0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1',
    cirBTC: '0x171A4217b86A807A64eB94757Db6849fb4bDbAA0',
    tUSDC:  ZERO_ADDRESS,
    tARC:   ZERO_ADDRESS,
    AGENT_TREASURY: ZERO_ADDRESS,
  },
  decimals: { USDC: 6, EURC: 6, cirBTC: 8, tUSDC: 6, tARC: 18 },
  treasury: (process.env.NEXT_PUBLIC_ARCTIS_MAINNET_TREASURY || MAINNET_TREASURY) as `0x${string}`,
} as const;

export const TESTNET_NETWORK = TESTNET;
export const MAINNET_NETWORK = MAINNET;
export const NETWORK_PROFILES = { testnet: TESTNET, mainnet: MAINNET } as const;
export const NETWORK = ENV === 'mainnet' ? MAINNET : TESTNET;
export const CHAIN_ID = NETWORK.chainId;
export const RPC_URL = NETWORK.rpc;
export const EXPLORER_URL = NETWORK.explorer;
export const NETWORK_NAME = NETWORK.networkName;
export const CONTRACTS = NETWORK.contracts;
export const DECIMALS = NETWORK.decimals;
export const TREASURY_WALLET = NETWORK.treasury as `0x${string}`;
export const AGENT_TREASURY = NETWORK.contracts.AGENT_TREASURY as `0x${string}`;
export const PRIMARY_TOKEN = 'USDC' as const;
export const PRIMARY_DECIMALS = DECIMALS.USDC;
export const PRIMARY_CONTRACT = CONTRACTS.USDC as `0x${string}`;
export const TUSDC_CONTRACT = CONTRACTS.tUSDC as `0x${string}`;
export const TARC_CONTRACT = CONTRACTS.tARC as `0x${string}`;
export const txUrl = (hash: string) => `${EXPLORER_URL}/tx/${hash}`;
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
  '84532': { name: 'Base Sepolia', domain: 6, usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', explorer: 'https://sepolia.basescan.org' },
  '421614': { name: 'Arbitrum Sepolia', domain: 3, usdc: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d', explorer: 'https://sepolia.arbiscan.io' },
} as const;

// Testnet CCTP routes (Arc_Testnet as source or destination)
export const CCTP_BRIDGE_CHAINS = {
  '5042002': { name: 'Arc Testnet',      domain: 26, usdc: '0x3600000000000000000000000000000000000000', explorer: 'https://explorer.testnet.arc.io', appKitChain: 'Arc_Testnet' },
  '11155111': { name: 'Ethereum Sepolia', domain: 0,  usdc: '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238', explorer: 'https://sepolia.etherscan.io',     appKitChain: 'Ethereum_Sepolia' },
  '84532':    { name: 'Base Sepolia',     domain: 6,  usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', explorer: 'https://sepolia.basescan.org',    appKitChain: 'Base_Sepolia' },
  '421614':   { name: 'Arbitrum Sepolia', domain: 3,  usdc: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d', explorer: 'https://sepolia.arbiscan.io',     appKitChain: 'Arbitrum_Sepolia' },
} as const;

// Mainnet CCTP routes — Circle App Kit chain identifier "Arc" for Arc Mainnet.
// All domains and USDC addresses verified against:
//   https://developers.circle.com/cctp/concepts/supported-chains-and-domains
//   https://docs.arc.io/integrate/exchanges/cctp-bridging
// CRITICAL: Arc Mainnet CCTP domain is 26 (same as testnet by design).
//   Domain 25 = Starknet. Never use 25 for Arc — funds would route to Starknet.
// Arc USDC: the precompile 0x3600...0000 is the same on both Mainnet and Testnet.
export const CCTP_BRIDGE_CHAINS_MAINNET = {
  '5042':  { name: 'Arc',         domain: 26, usdc: '0x3600000000000000000000000000000000000000', explorer: 'https://explorer.arc.io',           appKitChain: 'Arc' },
  '1':     { name: 'Ethereum',    domain: 0,  usdc: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', explorer: 'https://etherscan.io',              appKitChain: 'Ethereum' },
  '8453':  { name: 'Base',        domain: 6,  usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', explorer: 'https://basescan.org',              appKitChain: 'Base' },
  '42161': { name: 'Arbitrum',    domain: 3,  usdc: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', explorer: 'https://arbiscan.io',               appKitChain: 'Arbitrum' },
  '10':    { name: 'OP Mainnet',  domain: 2,  usdc: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', explorer: 'https://optimistic.etherscan.io',   appKitChain: 'Optimism' },
  '137':   { name: 'Polygon PoS', domain: 7,  usdc: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', explorer: 'https://polygonscan.com',           appKitChain: 'Polygon' },
} as const;

// Circle App Kit chain identifier for Arc networks.
// "Arc" (mainnet) is runtime-valid; @circle-fin/app-kit@1.12.0 types lag behind.
// Cast to string/never at call sites until the package types are updated.
export const ARC_APPKIT_CHAIN = {
  testnet: 'Arc_Testnet' as const,
  mainnet: 'Arc' as const,
} as const;

export const MEMO_CONTRACT = '0x5294E9927c3306DcBaDb03fe70b92e01cCede505' as const;
export const MULTICALL3_FROM = '0x522fAf9A91c41c443c66765030741e4AaCe147D0' as const;
export const CCTP_TOKEN_MESSENGER_ABI = [{ inputs: [{ name: 'amount', type: 'uint256' }, { name: 'destinationDomain', type: 'uint32' }, { name: 'mintRecipient', type: 'bytes32' }, { name: 'burnToken', type: 'address' }, { name: 'destinationCaller', type: 'bytes32' }, { name: 'maxFee', type: 'uint256' }, { name: 'minFinalityThreshold', type: 'uint32' }], name: 'depositForBurn', outputs: [], stateMutability: 'nonpayable', type: 'function' }] as const;
export const MEMO_ABI = [{ inputs: [{ name: 'data', type: 'bytes' }], name: 'memo', outputs: [], stateMutability: 'nonpayable', type: 'function' }] as const;
