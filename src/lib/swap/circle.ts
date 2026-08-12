// ============================================================
// Circle App Kit Swap rail — Arc Testnet
// ============================================================
// Keep Circle-supported swap assets separate from ARCTIS-owned OTC assets.
// cirBTC is intentionally excluded: it is not part of the currently
// documented Circle/Arc swap asset set used by this application.

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
