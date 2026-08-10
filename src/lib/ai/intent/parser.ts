import type { PendingFinancialAction } from '@/lib/store';
import { CCTP_SOURCE_CHAINS } from '@/lib/contracts';
import { getRouteId } from '@/lib/swap/service';
import type { SwapToken } from '@/lib/swap/types';

const SWAP_TOKENS = ['USDC', 'tUSDC', 'tARC'] as const;
type Token = typeof SWAP_TOKENS[number];

function normalizeToken(raw?: string): Token | undefined {
  if (!raw) return undefined;
  return SWAP_TOKENS.find((t) => t.toLowerCase() === raw.toLowerCase());
}

const SOURCE_CHAIN_ALIASES: Record<string, number> = {
  'ethereum sepolia': 11155111,
  sepolia: 11155111,
  'base sepolia': 84532,
  base: 84532,
  'arbitrum sepolia': 421614,
  arbitrum: 421614,
  arb: 421614,
};

const ADDRESS_RE = '0x[a-fA-F0-9]{40}';
const AMOUNT_RE = '\\d+(?:\\.\\d+)?';
const TOKEN_RE = '(usdc|tusdc|tarc)';

export interface ClarificationRequest {
  action: 'transfer' | 'swap' | 'bridge';
  question: string;
  missing: 'recipient' | 'toToken' | 'sourceChain' | 'token' | 'route';
  partial: Partial<PendingFinancialAction>;
}

export function parseFinancialIntent(message: string): PendingFinancialAction | null {
  const result = parseFinancialRequest(message);
  return result && 'action' in result && !('question' in result) ? result : null;
}

export function parseFinancialRequest(message: string): PendingFinancialAction | ClarificationRequest | null {
  const text = message.trim();
  const lower = text.toLowerCase();

  const transferFull = text.match(new RegExp(`\\b(?:send|transfer)\\s+(${AMOUNT_RE})\\s*${TOKEN_RE}?\\s+to\\s+(${ADDRESS_RE})`, 'i'));
  if (transferFull) {
    const token = normalizeToken(transferFull[2]) ?? 'USDC';
    if (token !== 'USDC') return { action: 'transfer', question: 'Transfers currently support USDC only on Arc Testnet. Please enter a USDC transfer amount and recipient.', missing: 'token', partial: { action: 'transfer', amount: transferFull[1], fromToken: token, recipient: transferFull[3], createdAt: Date.now() } };
    return { action: 'transfer', amount: transferFull[1], fromToken: 'USDC', recipient: transferFull[3], createdAt: Date.now() };
  }
  const transferPartial = text.match(new RegExp(`\\b(?:send|transfer)\\s+(${AMOUNT_RE})\\s*${TOKEN_RE}?\\b`, 'i'));
  if (transferPartial) return { action: 'transfer', question: 'Who should receive this USDC transfer? Please provide a 0x recipient address.', missing: 'recipient', partial: { action: 'transfer', amount: transferPartial[1], fromToken: normalizeToken(transferPartial[2]) ?? 'USDC', createdAt: Date.now() } };

  const swapFull = text.match(new RegExp(`\\bswap\\s+(${AMOUNT_RE})\\s*${TOKEN_RE}\\s+(?:to|for|into)\\s*${TOKEN_RE}`, 'i'));
  if (swapFull) {
    const fromToken = normalizeToken(swapFull[2]); const toToken = normalizeToken(swapFull[3]);
    if (fromToken && toToken && fromToken !== toToken && getRouteId(fromToken as SwapToken, toToken as SwapToken)) return { action: 'swap', amount: swapFull[1], fromToken, toToken, createdAt: Date.now() };
    return { action: 'swap', question: 'That swap route is not enabled. Choose one of USDC, tUSDC, or tARC as a different receive token.', missing: 'route', partial: { action: 'swap', amount: swapFull[1], fromToken, toToken, createdAt: Date.now() } };
  }
  const swapPartial = text.match(new RegExp(`\\bswap\\s+(${AMOUNT_RE})\\s*${TOKEN_RE}\\b`, 'i'));
  if (swapPartial) return { action: 'swap', question: `Which token should you receive for this swap (${SWAP_TOKENS.filter(t => t !== normalizeToken(swapPartial[2])).join(', ')})?`, missing: 'toToken', partial: { action: 'swap', amount: swapPartial[1], fromToken: normalizeToken(swapPartial[2]), createdAt: Date.now() } };

  const bridge = text.match(new RegExp(`\\bbridge\\s+(${AMOUNT_RE})\\s*${TOKEN_RE}?`, 'i'));
  if (bridge) {
    const token = normalizeToken(bridge[2]) ?? 'USDC';
    const alias = Object.keys(SOURCE_CHAIN_ALIASES).find((a) => lower.includes(a));
    if (token !== 'USDC') return { action: 'bridge', question: 'CCTP inbound bridge supports USDC only. Please bridge USDC from a supported source chain.', missing: 'token', partial: { action: 'bridge', amount: bridge[1], fromToken: token, createdAt: Date.now() } };
    if (!alias) return { action: 'bridge', question: `Which source chain should bridge from (${Object.values(CCTP_SOURCE_CHAINS).map((c) => c.name).join(', ')})?`, missing: 'sourceChain', partial: { action: 'bridge', amount: bridge[1], fromToken: 'USDC', createdAt: Date.now() } };
    return { action: 'bridge', amount: bridge[1], fromToken: 'USDC', sourceChainId: SOURCE_CHAIN_ALIASES[alias], createdAt: Date.now() } as PendingFinancialAction;
  }
  return null;
}

export function describeIntent(intent: PendingFinancialAction): string {
  switch (intent.action) {
    case 'transfer': return `Send ${intent.amount} USDC to ${intent.recipient?.slice(0, 6)}…${intent.recipient?.slice(-4)} on Arc Testnet`;
    case 'swap': return `Swap ${intent.amount} ${intent.fromToken} → ${intent.toToken} on Arc Testnet`;
    case 'bridge': { const chain = intent.sourceChainId ? CCTP_SOURCE_CHAINS[String(intent.sourceChainId) as keyof typeof CCTP_SOURCE_CHAINS]?.name : 'a supported source chain'; return `Bridge ${intent.amount} USDC from ${chain} to Arc Testnet`; }
    default: return 'Review this action';
  }
}
