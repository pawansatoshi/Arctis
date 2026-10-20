// ============================================================
// Circle App Kit Swap rail — Arc Testnet + Arc Mainnet
// Verified supported assets: docs.arc.io/app-kit/references/supported-blockchains (2026-10-20)
// "Swap: USDC, EURC, and cirBTC on Arc"
// ============================================================

// All tokens routable through Circle App Kit on Arc (both networks).
// cirBTC is excluded on testnet because it has no testnet contract.
export const CIRCLE_SWAP_TOKENS_MAINNET = ['USDC', 'EURC', 'cirBTC'] as const;
export const CIRCLE_SWAP_TOKENS_TESTNET = ['USDC', 'EURC'] as const;
export type CircleSwapToken = 'USDC' | 'EURC' | 'cirBTC';

export const CIRCLE_SWAP_TOKENS = CIRCLE_SWAP_TOKENS_MAINNET; // full union for type purposes

export function isCircleSwapToken(value?: string, networkEnv: 'testnet' | 'mainnet' = 'testnet'): value is CircleSwapToken {
  if (!value) return false;
  const allowed = networkEnv === 'mainnet'
    ? (CIRCLE_SWAP_TOKENS_MAINNET as readonly string[])
    : (CIRCLE_SWAP_TOKENS_TESTNET as readonly string[]);
  return allowed.includes(value);
}

export function isCircleSwapPair(fromToken?: string, toToken?: string, networkEnv: 'testnet' | 'mainnet' = 'testnet'): boolean {
  return isCircleSwapToken(fromToken, networkEnv) && isCircleSwapToken(toToken, networkEnv) && fromToken !== toToken;
}

export function isArctisOtcToken(value?: string): value is 'USDC' | 'tUSDC' | 'tARC' {
  return value === 'USDC' || value === 'tUSDC' || value === 'tARC';
}
