import type { PendingFinancialAction } from '@/lib/store';
import { getRouteId, getSwapRoute } from '@/lib/swap/service';
import type { SwapToken } from '@/lib/swap/types';
import { isCircleSwapPair, isCircleSwapToken } from '@/lib/swap/circle';
import { CCTP_BRIDGE_CHAINS } from '@/lib/contracts';

// ============================================================
// ARCTIS Financial Intent Parser
// ============================================================
// Deterministic extraction only. The LLM may explain the plan, but
// amount/token/address/chain fields are parsed and validated here.
// Nothing in this module executes a transaction.
// ============================================================

const SWAP_TOKENS = ['USDC', 'tUSDC', 'tARC', 'EURC', 'cirBTC'] as const;
type AgentSwapToken = typeof SWAP_TOKENS[number];

const ADDRESS_RE = '0x[a-fA-F0-9]{40}';
const PASSPORT_RE = '@?[a-z0-9_-]{3,20}(?:\\.arc)?';
const AMOUNT_RE = '\\d+(?:\\.\\d+)?';
const TOKEN_RE = '(usdc|tusdc|tarc|eurc|cirbtc)';

function normalizeSwapToken(raw?: string): AgentSwapToken | undefined {
  if (!raw) return undefined;
  return SWAP_TOKENS.find((t) => t.toLowerCase() === raw.toLowerCase());
}

function normalizeTransferToken(raw?: string): 'USDC' {
  // ARCTIS Transfer is intentionally USDC-only. EURC/cirBTC/tUSDC/tARC
  // belong to the Swap surface and must never be routed into Send USDC.
  return raw?.toLowerCase() === 'usdc' ? 'USDC' : 'USDC';
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

function normalizePassportRecipient(value: string): string {
  return value.trim().toLowerCase().replace(/^@/, '').replace(/\.arc$/, '');
}

function isPassportRecipient(value: string): boolean {
  return new RegExp(`^${PASSPORT_RE}$`, 'i').test(value.trim());
}

interface BridgeChainMatch { name: string; chainId: number; domain: number }

const BRIDGE_CHAIN_LIST: BridgeChainMatch[] = Object.entries(CCTP_BRIDGE_CHAINS).map(
  ([chainId, chain]) => ({ name: chain.name, chainId: Number(chainId), domain: chain.domain }),
);

function matchBridgeChain(text: string): BridgeChainMatch | null {
  const lower = text.toLowerCase();
  for (const chain of BRIDGE_CHAIN_LIST) {
    if (lower.includes(chain.name.toLowerCase())) return chain;
  }

  const SHORTHANDS: Record<string, string> = {
    arc: 'Arc Testnet',
    ethereum: 'Ethereum Sepolia',
    eth: 'Ethereum Sepolia',
    sepolia: 'Ethereum Sepolia',
    base: 'Base Sepolia',
    arbitrum: 'Arbitrum Sepolia',
    arb: 'Arbitrum Sepolia',
  };

  for (const [short, full] of Object.entries(SHORTHANDS)) {
    if (new RegExp(`\\b${short}\\b`, 'i').test(lower)) {
      return BRIDGE_CHAIN_LIST.find((c) => c.name === full) ?? null;
    }
  }
  return null;
}

export function listSourceChainNames(): string[] {
  return BRIDGE_CHAIN_LIST.map((c) => c.name);
}

export function parseFinancialIntent(message: string): PendingFinancialAction | null {
  const text = message.trim();

  // Selection-only: Transfer remains USDC-only.
  const transferSelectionRe = new RegExp(
    `\\b(?:send|transfer)\\s+usdc\\s+(?:to\\s+)?(?:a\\s+)?passport\\b`, 'i',
  );
  if (transferSelectionRe.test(text)) {
    return { action: 'transfer', amount: '', fromToken: 'USDC', missing: 'amount', createdAt: Date.now() };
  }

  const walletSelectionRe = new RegExp(
    `\\b(?:send|transfer)\\s+usdc\\s+to\\s+(?:a\\s+)?wallet\\s+address\\b`, 'i',
  );
  if (walletSelectionRe.test(text)) {
    return { action: 'transfer', amount: '', fromToken: 'USDC', missing: 'amount', createdAt: Date.now() };
  }

  // Swap selection — Circle assets and ARCTIS OTC assets share one agent
  // intent surface; the destination page chooses the correct execution rail.
  const swapSelectionRe = new RegExp(
    `\\bswap\\s+${TOKEN_RE}\\s+(?:to|for|into)\\s+${TOKEN_RE}\\b`, 'i',
  );
  const swapSelectionMatch = text.match(swapSelectionRe);
  if (swapSelectionMatch) {
    const fromToken = normalizeSwapToken(swapSelectionMatch[1]);
    const toToken = normalizeSwapToken(swapSelectionMatch[2]);
    if (fromToken && toToken && isSupportedSwapPair(fromToken, toToken)) {
      return { action: 'swap', amount: '', fromToken, toToken, missing: 'amount', createdAt: Date.now() };
    }
  }

  // Bridge selection: capture both route endpoints. Never infer destination.
  const bridgeSelectionRe = new RegExp(
    `\\bbridge\\s+usdc\\s+from\\s+(.+?)\\s+to\\s+(.+?)\\s*$`, 'i',
  );
  const bridgeSelectionMatch = text.match(bridgeSelectionRe);
  if (bridgeSelectionMatch) {
    const source = matchBridgeChain(bridgeSelectionMatch[1]);
    const destination = matchBridgeChain(bridgeSelectionMatch[2]);
    if (source && destination && source.chainId !== destination.chainId) {
      return {
        action: 'bridge', amount: '', fromToken: 'USDC',
        sourceChain: source.name, sourceChainId: source.chainId,
        destinationChain: destination.name, destinationChainId: destination.chainId,
        missing: 'amount', createdAt: Date.now(),
      };
    }
  }

  // Transfer: send/transfer 5 USDC to address or Passport.
  const transferFullRe = new RegExp(
    `\\b(?:send|transfer)\\s+(${AMOUNT_RE})\\s*usdc?\\s+to\\s+(${ADDRESS_RE}|${PASSPORT_RE})`, 'i',
  );
  const transferFullMatch = text.match(transferFullRe);
  if (transferFullMatch) {
    return {
      action: 'transfer', amount: transferFullMatch[1], fromToken: normalizeTransferToken('USDC'),
      recipient: isPassportRecipient(transferFullMatch[2])
        ? normalizePassportRecipient(transferFullMatch[2]) : transferFullMatch[2],
      createdAt: Date.now(),
    };
  }

  const transferPartialRe = new RegExp(`\\b(?:send|transfer)\\s+(${AMOUNT_RE})\\s*usdc?\\b`, 'i');
  const transferPartialMatch = text.match(transferPartialRe);
  if (transferPartialMatch) {
    return { action: 'transfer', amount: transferPartialMatch[1], fromToken: 'USDC', missing: 'recipient', createdAt: Date.now() };
  }

  // Swap: amount + pair.
  const swapFullRe = new RegExp(
    `\\bswap\\s+(${AMOUNT_RE})\\s*${TOKEN_RE}\\s+(?:to|for|into)\\s*${TOKEN_RE}`, 'i',
  );
  const swapFullMatch = text.match(swapFullRe);
  if (swapFullMatch) {
    const fromToken = normalizeSwapToken(swapFullMatch[2]);
    const toToken = normalizeSwapToken(swapFullMatch[3]);
    if (fromToken && toToken && fromToken !== toToken) {
      if (isSupportedSwapPair(fromToken, toToken)) {
        return { action: 'swap', amount: swapFullMatch[1], fromToken, toToken, createdAt: Date.now() };
      }
      return { action: 'swap', amount: swapFullMatch[1], fromToken, missing: 'toToken', createdAt: Date.now() };
    }
  }

  const swapPartialRe = new RegExp(`\\bswap\\s+(${AMOUNT_RE})\\s*${TOKEN_RE}\\b`, 'i');
  const swapPartialMatch = text.match(swapPartialRe);
  if (swapPartialMatch) {
    const fromToken = normalizeSwapToken(swapPartialMatch[2]);
    if (fromToken) return { action: 'swap', amount: swapPartialMatch[1], fromToken, missing: 'toToken', createdAt: Date.now() };
  }

  // Bridge: amount + source + destination.
  const bridgeRe = new RegExp(
    `\\bbridge\\s+(${AMOUNT_RE})\\s*usdc?\\s+from\\s+(.+?)\\s+to\\s+(.+?)\\s*$`, 'i',
  );
  const bridgeMatch = text.match(bridgeRe);
  if (bridgeMatch) {
    const source = matchBridgeChain(bridgeMatch[2]);
    const destination = matchBridgeChain(bridgeMatch[3]);
    const base: PendingFinancialAction = { action: 'bridge', amount: bridgeMatch[1], fromToken: 'USDC', createdAt: Date.now() };

    if (!source) return { ...base, missing: 'sourceChain' };
    if (!destination) {
      return { ...base, sourceChain: source.name, sourceChainId: source.chainId, missing: 'sourceChain', error: 'Please specify a supported destination chain.' };
    }
    if (source.chainId === destination.chainId) {
      return { ...base, sourceChain: source.name, sourceChainId: source.chainId, missing: 'sourceChain', error: 'Source and destination chains must be different.' };
    }
    return {
      ...base, sourceChain: source.name, sourceChainId: source.chainId,
      destinationChain: destination.name, destinationChainId: destination.chainId,
    };
  }

  return null;
}

export function resolveClarification(pending: PendingFinancialAction, replyText: string): PendingFinancialAction {
  const text = replyText.trim();
  const { error: _drop, ...clean } = pending as PendingFinancialAction & { error?: string };

  switch (pending.missing) {
    case 'full': {
      const reparsed = parseFinancialIntent(`${pending.action} ${text}`);
      return reparsed ?? clean;
    }
    case 'amount': {
      const amountMatch = text.match(new RegExp(`^${AMOUNT_RE}$`));
      if (!amountMatch) return { ...clean, missing: 'amount', error: 'Please enter a valid numeric amount.' };
      const amount = amountMatch[0];
      if (pending.action === 'transfer') return { ...clean, amount, missing: 'recipient', error: undefined };
      return { ...clean, amount, missing: undefined, error: undefined };
    }
    case 'recipient': {
      const address = text.match(new RegExp(`^${ADDRESS_RE}$`, 'i'));
      if (address) return { ...clean, recipient: address[0], missing: undefined };
      const passport = text.match(new RegExp(`^${PASSPORT_RE}$`, 'i'));
      if (passport) return { ...clean, recipient: normalizePassportRecipient(passport[0]), missing: undefined };
      return { ...clean, missing: 'recipient', error: 'Please provide a valid 0x wallet address or Passport username.' };
    }
    case 'toToken': {
      const m = text.match(new RegExp(TOKEN_RE, 'i'));
      const toToken = normalizeSwapToken(m?.[0]);
      if (toToken && toToken !== clean.fromToken && isSupportedSwapPair(clean.fromToken, toToken)) {
        return { ...clean, toToken, missing: undefined, error: undefined };
      }
      return { ...clean, missing: 'toToken', error: `That token pair is not currently supported. Choose USDC, EURC, cirBTC, tUSDC or tARC.` };
    }
    case 'sourceChain': {
      // If source is already known, the missing piece is actually destination.
      const chain = matchBridgeChain(text);
      if (!chain) return { ...clean, missing: 'sourceChain', error: 'Please provide a supported chain name.' };
      if (!clean.sourceChainId) {
        return { ...clean, sourceChain: chain.name, sourceChainId: chain.chainId, missing: undefined };
      }
      if (clean.sourceChainId === chain.chainId) {
        return { ...clean, missing: 'sourceChain', error: 'Destination must be different from the source chain.' };
      }
      return { ...clean, destinationChain: chain.name, destinationChainId: chain.chainId, missing: undefined, error: undefined };
    }
    default:
      return clean;
  }
}

export function clarificationQuestion(pending: PendingFinancialAction): string {
  const chains = listSourceChainNames().join(', ');
  switch (pending.missing) {
    case 'full': return `Please provide the details for this ${pending.action} action.`;
    case 'amount':
      if (pending.action === 'transfer') return `How much USDC would you like to send?`;
      if (pending.action === 'swap') return `How much ${pending.fromToken ?? 'USDC'} would you like to swap?`;
      return `How much USDC would you like to bridge?`;
    case 'recipient': return `Got it — ${pending.amount} USDC. What wallet address or Passport username should receive it?`;
    case 'toToken': return `Got it — ${pending.amount} ${pending.fromToken}. Which token would you like to receive? Choose USDC, EURC, cirBTC, tUSDC or tARC.`;
    case 'sourceChain':
      return pending.sourceChain
        ? `Source is ${pending.sourceChain}. Which destination chain should I use? Supported: ${chains}.`
        : `Which source and destination chains should I use? Supported: ${chains}.`;
    default: return 'Could you clarify that?';
  }
}

export function describeIntent(intent: PendingFinancialAction): string {
  switch (intent.action) {
    case 'transfer': return `Send ${intent.amount} USDC to ${intent.recipient?.slice(0, 6)}…${intent.recipient?.slice(-4)}`;
    case 'swap': return `Swap ${intent.amount} ${intent.fromToken} for ${intent.toToken}`;
    case 'bridge': return `Bridge ${intent.amount} USDC from ${intent.sourceChain ?? 'source chain'} to ${intent.destinationChain ?? 'destination chain'}`;
    default: return 'Review this action';
  }
}
