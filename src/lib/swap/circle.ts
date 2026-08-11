// ============================================================
// Circle App Kit Swap rail — Arc Testnet
// ============================================================
// Circle's current Arc Testnet Swap surface supports only these
// three assets. Keep these separate from ARCTIS-owned OTC assets.

export const CIRCLE_SWAP_TOKENS = ['USDC', 'EURC', 'cirBTC'] as const;
export type CircleSwapToken = typeof CIRCLE_SWAP_TOKENS[number];

export function isCircleSwapToken(value?: string): value is CircleSwapToken {
  return !!value && (CIRCLE_SWAP_TOKENS as readonly string[]).includes(value);
}

export function isCircleSwapPair(fromToken?: string, toToken?: string): boolean {
  return isCircleSwapToken(fromToken) && isCircleSwapToken(toToken) && fromToken !== toToken;
}

export function isArctisOtcToken(value?: string): value is 'USDC' | 'tUSDC' | 'tARC' {
  return value === 'USDC' || value === 'tUSDC' || value === 'tARC';
}
