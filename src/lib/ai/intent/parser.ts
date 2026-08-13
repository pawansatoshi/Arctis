import type { PendingFinancialAction } from '@/lib/store';
import { getRouteId, getSwapRoute } from '@/lib/swap/service';
import type { SwapToken } from '@/lib/swap/types';
import { isCircleSwapPair } from '@/lib/swap/circle';
import { CCTP_BRIDGE_CHAINS } from '@/lib/contracts';

const SWAP_TOKENS = ['USDC', 'tUSDC', 'tARC', 'EURC'] as const;
type AgentSwapToken = typeof SWAP_TOKENS[number];
const ADDRESS_RE = '0x[a-fA-F0-9]{40}';
const PASSPORT_RE = '@?[a-z0-9_-]{3,20}(?:\\.arc)?';
const AMOUNT_RE = '\\d+(?:\\.\\d+)?';
const TOKEN_RE = '(usdc|tusdc|tarc|eurc)';

function normalizeSwapToken(raw?: string): AgentSwapToken | undefined {
  if (!raw) return undefined;
  const value = raw.toLowerCase();
  return SWAP_TOKENS.find((t) => t.toLowerCase() === value);
}

function isSupportedSwapPair(fromToken?: string, toToken?: string): boolean {
  if (!fromToken || !toToken || fromToken === toToken) return false;
  if (isCircleSwapPair(fromToken, toToken)) return true;
  if (fromToken === 'tUSDC' || fromToken === 'tARC' || toToken === 'tUSDC' || toToken === 'tARC') {
    const routeId = getRouteId(fromToken as SwapToken, toToken as SwapToken);
    return !!(routeId && getSwapRoute(routeId)?.enabled);
  }
  return false;
}

function normalizePassportRecipient(value: string): string { const username = value.trim().toLowerCase().replace(/^@/, '').replace(/\\.arc$/, ''); return `${username}.arc`; }
function isPassportRecipient(value: string): boolean { return new RegExp(`^${PASSPORT_RE}$`, 'i').test(value.trim()); }
interface BridgeChainMatch { name: string; chainId: number; domain: number }
const BRIDGE_CHAIN_LIST: BridgeChainMatch[] = Object.entries(CCTP_BRIDGE_CHAINS).map(([chainId, chain]) => ({ name: chain.name, chainId: Number(chainId), domain: chain.domain }));
function matchBridgeChain(text: string): BridgeChainMatch | null { const lower = text.toLowerCase(); for (const chain of BRIDGE_CHAIN_LIST) if (lower.includes(chain.name.toLowerCase())) return chain; const SHORTHANDS: Record<string, string> = { arc: 'Arc Testnet', ethereum: 'Ethereum Sepolia', eth: 'Ethereum Sepolia', sepolia: 'Ethereum Sepolia', base: 'Base Sepolia', arbitrum: 'Arbitrum Sepolia', arb: 'Arbitrum Sepolia' }; for (const [short, full] of Object.entries(SHORTHANDS)) if (new RegExp(`\\b${short}\\b`, 'i').test(lower)) return BRIDGE_CHAIN_LIST.find((c) => c.name === full) ?? null; return null; }
export function listSourceChainNames(): string[] { return BRIDGE_CHAIN_LIST.map((c) => c.name); }

export function parseFinancialIntent(message: string): PendingFinancialAction | null {
  const text = message.trim();
  if (/\b(?:send|transfer)\s+usdc\s+(?:to\s+)?(?:a\s+)?passport\b/i.test(text)) return { action: 'transfer', amount: '', fromToken: 'USDC', missing: 'amount', createdAt: Date.now() };
  if (/\b(?:send|transfer)\s+usdc\s+to\s+(?:a\s+)?wallet\s+address\b/i.test(text)) return { action: 'transfer', amount: '', fromToken: 'USDC', missing: 'amount', createdAt: Date.now() };
  const swapSelection = text.match(new RegExp(`\\bswap\\s+${TOKEN_RE}\\s+(?:to|for|into)\\s+${TOKEN_RE}\\b`, 'i'));
  if (swapSelection) { const fromToken = normalizeSwapToken(swapSelection[1]); const toToken = normalizeSwapToken(swapSelection[2]); if (fromToken && toToken && isSupportedSwapPair(fromToken, toToken)) return { action: 'swap', amount: '', fromToken, toToken, missing: 'amount', createdAt: Date.now() }; }
  const bridgeSelection = text.match(/\bbridge\s+usdc\s+from\s+(.+?)\s+to\s+(.+?)\s*$/i);
  if (bridgeSelection) { const source = matchBridgeChain(bridgeSelection[1]); const destination = matchBridgeChain(bridgeSelection[2]); if (source && destination && source.chainId !== destination.chainId) return { action: 'bridge', amount: '', fromToken: 'USDC', sourceChain: source.name, sourceChainId: source.chainId, destinationChain: destination.name, destinationChainId: destination.chainId, missing: 'amount', createdAt: Date.now() }; }
  const transferFull = text.match(new RegExp(`\\b(?:send|transfer)\\s+(${AMOUNT_RE})\\s*usdc\\s+to\\s+(${ADDRESS_RE}|${PASSPORT_RE})`, 'i'));
  if (transferFull) return { action: 'transfer', amount: transferFull[1], fromToken: 'USDC', recipient: isPassportRecipient(transferFull[2]) ? normalizePassportRecipient(transferFull[2]) : transferFull[2], createdAt: Date.now() };
  const transferPartial = text.match(new RegExp(`\\b(?:send|transfer)\\s+(${AMOUNT_RE})\\s*usdc\\b`, 'i'));
  if (transferPartial) return { action: 'transfer', amount: transferPartial[1], fromToken: 'USDC', missing: 'recipient', createdAt: Date.now() };
  const swapFull = text.match(new RegExp(`\\bswap\\s+(${AMOUNT_RE})\\s*${TOKEN_RE}\\s+(?:to|for|into)\\s*${TOKEN_RE}`, 'i'));
  if (swapFull) { const fromToken = normalizeSwapToken(swapFull[2]); const toToken = normalizeSwapToken(swapFull[3]); if (fromToken && toToken && fromToken !== toToken) { if (isSupportedSwapPair(fromToken, toToken)) return { action: 'swap', amount: swapFull[1], fromToken, toToken, createdAt: Date.now() }; return { action: 'swap', amount: swapFull[1], fromToken, missing: 'toToken', createdAt: Date.now(), error: `That pair is not available yet. Choose a supported asset: ${SWAP_TOKENS.join(', ')}.` }; } }
  const swapPartial = text.match(new RegExp(`\\bswap\\s+(${AMOUNT_RE})\\s*${TOKEN_RE}\\b`, 'i'));
  if (swapPartial) { const fromToken = normalizeSwapToken(swapPartial[2]); if (fromToken) return { action: 'swap', amount: swapPartial[1], fromToken, missing: 'toToken', createdAt: Date.now() }; }
  const bridgeAmountOnly = text.match(new RegExp(`\\bbridge\\s+(${AMOUNT_RE})\\s*usdc\\s*$`, 'i'));
  if (bridgeAmountOnly) return { action: 'bridge', amount: bridgeAmountOnly[1], fromToken: 'USDC', missing: 'sourceChain', createdAt: Date.now() };
  const bridge = text.match(new RegExp(`\\bbridge\\s+(${AMOUNT_RE})\\s*usdc\\s+from\\s+(.+?)\\s+to\\s+(.+?)\\s*$`, 'i'));
  if (bridge) { const source = matchBridgeChain(bridge[2]); const destination = matchBridgeChain(bridge[3]); const base: PendingFinancialAction = { action: 'bridge', amount: bridge[1], fromToken: 'USDC', createdAt: Date.now() }; if (!source) return { ...base, missing: 'sourceChain', error: 'I could not identify that source network. Please choose one of the supported networks below.' }; if (!destination) return { ...base, sourceChain: source.name, sourceChainId: source.chainId, missing: 'destinationChain', error: 'I could not identify that destination network. Please choose one of the supported networks below.' }; if (source.chainId === destination.chainId) return { ...base, sourceChain: source.name, sourceChainId: source.chainId, missing: 'destinationChain', error: 'The destination must be different from the source. Choose another network.' }; return { ...base, sourceChain: source.name, sourceChainId: source.chainId, destinationChain: destination.name, destinationChainId: destination.chainId }; }
  return null;
}

export function resolveClarification(pending: PendingFinancialAction, replyText: string): PendingFinancialAction {
  const text = replyText.trim(); const { error: _drop, ...clean } = pending as PendingFinancialAction & { error?: string };
  switch (pending.missing) {
    case 'full': return parseFinancialIntent(`${pending.action} ${text}`) ?? clean;
    case 'amount': { const m = text.match(new RegExp(`^${AMOUNT_RE}$`)); if (!m) return { ...clean, missing: 'amount', error: 'Please enter a valid numeric amount.' }; return pending.action === 'transfer' ? { ...clean, amount: m[0], missing: 'recipient', error: undefined } : { ...clean, amount: m[0], missing: undefined, error: undefined }; }
    case 'recipient': { const address = text.match(new RegExp(`^${ADDRESS_RE}$`, 'i')); if (address) return { ...clean, recipient: address[0], missing: undefined }; const passport = text.match(new RegExp(`^${PASSPORT_RE}$`, 'i')); if (passport) return { ...clean, recipient: normalizePassportRecipient(passport[0]), missing: undefined }; return { ...clean, missing: 'recipient', error: 'That does not look like a wallet address or Passport ID. Try alice.arc or paste a 0x address.' }; }
    case 'toToken': { const toToken = normalizeSwapToken(text.match(new RegExp(TOKEN_RE, 'i'))?.[0]); if (toToken && toToken !== clean.fromToken && isSupportedSwapPair(clean.fromToken, toToken)) return { ...clean, toToken, missing: undefined, error: undefined }; return { ...clean, missing: 'toToken', error: `That token is not available for this route. Choose: ${SWAP_TOKENS.join(', ')}.` }; }
    case 'sourceChain': { const chain = matchBridgeChain(text); if (!chain) return { ...clean, missing: 'sourceChain', error: `I could not identify that network. Choose: ${listSourceChainNames().join(', ')}.` }; return { ...clean, sourceChain: chain.name, sourceChainId: chain.chainId, missing: 'destinationChain', error: undefined }; }
    case 'destinationChain': { const chain = matchBridgeChain(text); if (!chain) return { ...clean, missing: 'destinationChain', error: `I could not identify that network. Choose: ${listSourceChainNames().join(', ')}.` }; if (clean.sourceChainId === chain.chainId) return { ...clean, missing: 'destinationChain', error: 'That is the source network. Choose a different destination.' }; return { ...clean, destinationChain: chain.name, destinationChainId: chain.chainId, missing: undefined, error: undefined }; }
    default: return clean;
  }
}

export function clarificationQuestion(pending: PendingFinancialAction): string { const chains = listSourceChainNames().join(', '); const prefix = pending.error ? `${pending.error}\n\n` : ''; switch (pending.missing) { case 'full': return `${prefix}Please provide the missing details for this ${pending.action}.`; case 'amount': if (pending.action === 'transfer') return `${prefix}How much USDC would you like to send?`; if (pending.action === 'swap') return `${prefix}How much ${pending.fromToken ?? 'USDC'} would you like to swap?`; return `${prefix}How much USDC would you like to bridge?`; case 'recipient': return `${prefix}What wallet address or Passport ID should receive ${pending.amount} USDC?`; case 'toToken': return `${prefix}Which token should you receive for ${pending.amount} ${pending.fromToken}?`; case 'sourceChain': return `${prefix}Which network do you want to bridge ${pending.amount} USDC from?`; case 'destinationChain': return `${prefix}Source: ${pending.sourceChain}. Which network do you want to bridge to?`; default: return `${prefix}Could you clarify that?`; } }
export function describeIntent(intent: PendingFinancialAction): string { if (intent.action === 'transfer') return `Send ${intent.amount} USDC to ${intent.recipient?.slice(0, 6)}…${intent.recipient?.slice(-4)}`; if (intent.action === 'swap') return `Swap ${intent.amount} ${intent.fromToken} for ${intent.toToken}`; if (intent.action === 'bridge') return `Bridge ${intent.amount} USDC from ${intent.sourceChain ?? 'source chain'} to ${intent.destinationChain ?? 'destination chain'}`; return 'Review this action'; }
