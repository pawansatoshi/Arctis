import { CONTRACTS, DECIMALS, NETWORK_NAME, CHAIN_ID } from '@/lib/contracts';

export type AssetRail = 'arc-native' | 'arctis-otc' | 'circle-cctp' | 'future';
export interface AssetDefinition { symbol: string; name: string; decimals: number; address?: string; chainId?: number; rail: AssetRail; purpose: string; executable: boolean; }

const IS_ARC_TESTNET = CHAIN_ID === 5042002;

/** Canonical registry for assets currently configured for execution. */
export const ARCTIS_ASSETS: Record<string, AssetDefinition> = {
  USDC: { symbol: 'USDC', name: 'Arc Native USDC', decimals: DECIMALS.USDC, address: CONTRACTS.USDC, chainId: CHAIN_ID, rail: 'arc-native', purpose: `Primary payment and gas asset on ${NETWORK_NAME}`, executable: true },
  tUSDC: { symbol: 'tUSDC', name: 'ARCTIS Test USDC', decimals: DECIMALS.tUSDC, address: CONTRACTS.tUSDC, chainId: CHAIN_ID, rail: 'arctis-otc', purpose: 'ARCTIS OTC test asset; executable only on Arc Testnet', executable: IS_ARC_TESTNET },
  tARC: { symbol: 'tARC', name: 'ARCTIS Test ARC', decimals: DECIMALS.tARC, address: CONTRACTS.tARC, chainId: CHAIN_ID, rail: 'arctis-otc', purpose: 'ARCTIS OTC test asset; executable only on Arc Testnet and not an official Arc native token', executable: IS_ARC_TESTNET },
};

/** Circle-rail assets not executable until their active network contracts are explicitly verified. */
export const CIRCLE_RAIL_ASSET_NOTES = {
  EURC: { status: 'integration-dependent', executable: false },
  cirBTC: { status: 'integration-dependent', executable: false },
} as const;

export const EXECUTABLE_ASSETS = Object.values(ARCTIS_ASSETS).filter((asset) => asset.executable);
export function getAsset(symbol: string): AssetDefinition | undefined { return ARCTIS_ASSETS[symbol]; }
