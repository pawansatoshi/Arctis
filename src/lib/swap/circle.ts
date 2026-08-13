// ============================================================
// Circle App Kit Swap rail — Arc Testnet
// ============================================================
// ARCTIS exposes the stablecoin swap route only for USDC and EURC.
// cirBTC remains a Circle-supported Arc Testnet asset, but is intentionally
// excluded from the ARCTIS Manual and Economic Agent swap surfaces.

export const CIRCLE_SWAP_TOKENS = ['USDC', 'EURC'] as const;
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
