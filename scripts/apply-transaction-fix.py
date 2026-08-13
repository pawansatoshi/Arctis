from pathlib import Path

# One-time source edit for the remaining swap-page fixes.
p = Path('src/app/swap/page.tsx')
s = p.read_text()

replacements = {
    "type SwapToken = 'USDC' | 'EURC' | 'cirBTC' | 'tUSDC' | 'tARC';": "type SwapToken = 'USDC' | 'EURC' | 'tUSDC' | 'tARC';",
    "const TOKENS: SwapToken[] = ['USDC', 'EURC', 'cirBTC', 'tUSDC', 'tARC'];": "const TOKENS: SwapToken[] = ['USDC', 'EURC', 'tUSDC', 'tARC'];",
    "const TOKEN_DECIMALS: Record<SwapToken, number> = { USDC: 6, EURC: 6, cirBTC: 8, tUSDC: 6, tARC: 18 };": "const TOKEN_DECIMALS: Record<SwapToken, number> = { USDC: 6, EURC: 6, tUSDC: 6, tARC: 18 };",
    'Insufficient ARC for the swap transaction.': 'Insufficient USDC for the swap transaction.',
    'Approximately ${formatEther(requiredGas)} ARC is required.': 'Approximately ${formatEther(requiredGas)} USDC is required.',
    "const OTC_TOKENS: readonly SwapToken[] = ['USDC', 'tUSDC', 'tARC'];": "const OTC_TOKENS: readonly SwapToken[] = ['USDC', 'tUSDC', 'tARC'];\nconst CIRCLE_KIT_KEY = process.env.NEXT_PUBLIC_CIRCLE_KIT_KEY ?? '';",
    "if (circlePair) {\n        const provider": "if (circlePair) {\n        if (!CIRCLE_KIT_KEY) throw new Error('Circle App Kit key is not configured. Set NEXT_PUBLIC_CIRCLE_KIT_KEY in Vercel.');\n        const provider",
    "config: { slippageBps: 100 }": "config: { kitKey: CIRCLE_KIT_KEY, slippageBps: 100 }",
    "if (quote.rail === 'circle') {\n        const estimate": "if (quote.rail === 'circle') {\n        if (!CIRCLE_KIT_KEY) throw new Error('Circle App Kit key is not configured. Set NEXT_PUBLIC_CIRCLE_KIT_KEY in Vercel.');\n        const estimate",
}

for old, new in replacements.items():
    if old not in s:
        raise SystemExit(f'missing swap-page target: {old}')
    s = s.replace(old, new)

p.write_text(s)
print('swap page fix applied')
