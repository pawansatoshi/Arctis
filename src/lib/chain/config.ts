// Backward compat re-exports — all values sourced from lib/contracts.ts
export {
  PRIMARY_CONTRACT as ARC_USDC_ADDRESS,
  PRIMARY_DECIMALS as ARC_USDC_DECIMALS,
  CHAIN_ID as ARC_CHAIN_ID,
  ERC20_ABI,
  txUrl as getTxExplorerUrl,
  addressUrl as getAddressExplorerUrl,
  NETWORK_NAME,
  EXPLORER_URL,
} from '@/lib/contracts';

export const ARC_USDC_SYMBOL = 'USDC';

export { arcTestnet } from '@/lib/chain/arcChain';
