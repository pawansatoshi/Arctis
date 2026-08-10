import type { PendingFinancialAction } from '@/lib/store';
import { getRouteId, getSwapRoute } from '@/lib/swap/service';
import type { SwapToken } from '@/lib/swap/types';
import { CCTP_SOURCE_CHAINS } from '@/lib/contracts';

// ============================================================
// ARCTIS Financial Intent Parser
// ============================================================
// Deliberately deterministic (regex, not an LLM call) — extracting
// an amount, token, address, or chain for a financial action is
// exactly the kind of detail an LLM can subtly get wrong or
// hallucinate. This never executes anything; it only produces a
// *proposed* plan (complete) or a *clarification request*
// (missing a required field) that the user must resolve before
// any wallet signature happens on the existing Transfer/Swap/Bridge
// pages.
//
// A result with `missing` set is NOT actionable — callers (chat
// route, agent executor) must treat it as a question to ask, not
// a proposal to execute or hand off.
// ============================================================

const TOKENS = ['USDC', 'tUSDC', 'tARC'] as const;
type Token = typeof TOKENS[number];

function normalizeToken(raw?: string): Token | undefined {
  if (!raw) return undefined;
  const found = TOKENS.find((t) => t.toLowerCase() === raw.toLowerCase());
  return found;
}

const ADDRESS_RE = '0x[a-fA-F0-9]{40}';
const AMOUNT_RE = '\\d+(?:\\.\\d+)?';
const TOKEN_RE = '(usdc|tusdc|tarc)';

// ── Bridge source chains: the real CCTP config is the source of
// truth (src/lib/contracts.ts), never a hard-coded guess. ───────
interface SourceChainMatch { name: string; chainId: number; domain: number }

const SOURCE_CHAIN_LIST: SourceChainMatch[] = Object.entries(CCTP_SOURCE_CHAINS).map(
  ([chainId, chain]) => ({ name: chain.name, chainId: Number(chainId), domain: chain.domain })
);

/** Loose match against the actual configured CCTP source chains — accepts
 * the full name ("Base Sepolia") or a short form ("base", "arbitrum", "eth"). */
function matchSourceChain(text: string): SourceChainMatch | null {
  const lower = text.toLowerCase();
  for (const chain of SOURCE_CHAIN_LIST) {
    if (lower.includes(chain.name.toLowerCase())) return chain;
  }
  const SHORTHANDS: Record<string, string> = {
    eth: 'Ethereum Sepolia', ethereum: 'Ethereum Sepolia', sepolia: 'Ethereum Sepolia',
    base: 'Base Sepolia',
    arbitrum: 'Arbitrum Sepolia', arb: 'Arbitrum Sepolia',
  };
  for (const [short, full] of Object.entries(SHORTHANDS)) {
    if (new RegExp(`\\b${short}\\b`, 'i').test(lower)) {
      return SOURCE_CHAIN_LIST.find((c) => c.name === full) ?? null;
    }
  }
  return null;
}

export function listSourceChainNames(): string[] {
  return SOURCE_CHAIN_LIST.map((c) => c.name);
}

/**
 * Parses a user message into a financial action.
 * - Returns a complete PendingFinancialAction (no `missing`) when every
 *   required field is present and valid.
 * - Returns a PendingFinancialAction with `missing` set when the action
 *   is recognized but a required field (recipient / destination token /
 *   source chain) is absent — the caller should ask the corresponding
 *   clarification question rather than propose anything.
 * - Returns null when no financial action is recognized at all.
 */
export function parseFinancialIntent(message: string): PendingFinancialAction | null {
  const text = message.trim();

  // ── Transfer: "send/transfer 5 USDC to 0x..." ──────────────
  const transferFullRe = new RegExp(
    `\\b(?:send|transfer)\\s+(${AMOUNT_RE})\\s*${TOKEN_RE}?\\s+to\\s+(${ADDRESS_RE})`, 'i'
  );
  const transferFullMatch = text.match(transferFullRe);
  if (transferFullMatch) {
    return {
      action: 'transfer',
      amount: transferFullMatch[1],
      fromToken: normalizeToken(transferFullMatch[2]) ?? 'USDC',
      recipient: transferFullMatch[3],
      createdAt: Date.now(),
    };
  }

  // Partial transfer: amount + token given, no recipient yet.
  const transferPartialRe = new RegExp(`\\b(?:send|transfer)\\s+(${AMOUNT_RE})\\s*${TOKEN_RE}?\\b`, 'i');
  const transferPartialMatch = text.match(transferPartialRe);
  if (transferPartialMatch) {
    return {
      action: 'transfer',
      amount: transferPartialMatch[1],
      fromToken: normalizeToken(transferPartialMatch[2]) ?? 'USDC',
      missing: 'recipient',
      createdAt: Date.now(),
    };
  }

  // ── Swap: "swap 10 USDC to/for tARC" ────────────────────────
  const swapFullRe = new RegExp(
    `\\bswap\\s+(${AMOUNT_RE})\\s*${TOKEN_RE}\\s+(?:to|for|into)\\s*${TOKEN_RE}`, 'i'
  );
  const swapFullMatch = text.match(swapFullRe);
  if (swapFullMatch) {
    const fromToken = normalizeToken(swapFullMatch[2]);
    const toToken = normalizeToken(swapFullMatch[3]);
    if (fromToken && toToken && fromToken !== toToken) {
      const routeId = getRouteId(fromToken as SwapToken, toToken as SwapToken);
      const route = routeId ? getSwapRoute(routeId) : null;
      if (route?.enabled) {
        return { action: 'swap', amount: swapFullMatch[1], fromToken, toToken, createdAt: Date.now() };
      }
      // Recognized pair but no active route — ask for a different destination token.
      return { action: 'swap', amount: swapFullMatch[1], fromToken, missing: 'toToken', createdAt: Date.now() };
    }
  }

  // Partial swap: amount + source token given, no destination token yet.
  const swapPartialRe = new RegExp(`\\bswap\\s+(${AMOUNT_RE})\\s*${TOKEN_RE}\\b`, 'i');
  const swapPartialMatch = text.match(swapPartialRe);
  if (swapPartialMatch) {
    const fromToken = normalizeToken(swapPartialMatch[2]);
    if (fromToken) {
      return { action: 'swap', amount: swapPartialMatch[1], fromToken, missing: 'toToken', createdAt: Date.now() };
    }
  }

  // ── Bridge: "bridge 5 USDC [from <chain>]" (destination is always Arc Testnet) ──
  const bridgeRe = new RegExp(`\\bbridge\\s+(${AMOUNT_RE})\\s*${TOKEN_RE}?`, 'i');
  const bridgeMatch = text.match(bridgeRe);
  if (bridgeMatch) {
    const chain = matchSourceChain(text);
    const base: PendingFinancialAction = {
      action: 'bridge',
      amount: bridgeMatch[1],
      fromToken: normalizeToken(bridgeMatch[2]) ?? 'USDC',
      createdAt: Date.now(),
    };
    if (chain) return { ...base, sourceChain: chain.name, sourceChainId: chain.chainId };
    return { ...base, missing: 'sourceChain' };
  }

  return null;
}

/**
 * Merges a follow-up reply into a partial (`missing`-flagged) pending
 * action. Returns an updated pending action — either complete (no
 * `missing`), still incomplete (ask again), or carrying `error` if the
 * reply resolved to something invalid (e.g. an unsupported swap route).
 */
export function resolveClarification(pending: PendingFinancialAction, replyText: string): PendingFinancialAction {
  const text = replyText.trim();
  const { error: _drop, ...clean } = pending as PendingFinancialAction & { error?: string };

  switch (pending.missing) {
    case 'full': {
      // Re-run the full parser with the action verb prepended so the
      // existing regexes can match naturally against the reply alone.
      const reparsed = parseFinancialIntent(`${pending.action} ${text}`);
      return reparsed ?? clean;
    }
    case 'recipient': {
      const m = text.match(new RegExp(ADDRESS_RE, 'i'));
      if (m) return { ...clean, recipient: m[0], missing: undefined };
      return clean;
    }
    case 'toToken': {
      const m = text.match(new RegExp(TOKEN_RE, 'i'));
      const toToken = normalizeToken(m?.[0]);
      if (toToken && toToken !== clean.fromToken) {
        const routeId = getRouteId(clean.fromToken as SwapToken, toToken as SwapToken);
        const route = routeId ? getSwapRoute(routeId) : null;
        if (route?.enabled) return { ...clean, toToken, missing: undefined };
        return { ...clean, missing: 'toToken', error: `No active swap route from ${clean.fromToken} to ${toToken} right now.` };
      }
      return clean;
    }
    case 'sourceChain': {
      const chain = matchSourceChain(text);
      if (chain) return { ...clean, sourceChain: chain.name, sourceChainId: chain.chainId, missing: undefined };
      return clean;
    }
    default:
      return clean;
  }
}

/** The question to show the user for a partial (`missing`-flagged) pending action. */
export function clarificationQuestion(pending: PendingFinancialAction): string {
  const chains = listSourceChainNames().join(', ');
  switch (pending.missing) {
    case 'full':
      if (pending.action === 'transfer') return "How much would you like to send, and to which wallet address?";
      if (pending.action === 'swap') return "How much would you like to swap, and into which token?";
      return `How much would you like to bridge, and from which source chain (${chains})?`;
    case 'recipient':
      return `Got it — ${pending.amount} ${pending.fromToken}. What wallet address should this go to?`;
    case 'toToken':
      return (pending as PendingFinancialAction & { error?: string }).error
        ? `${(pending as PendingFinancialAction & { error?: string }).error} Which token would you like instead?`
        : `Got it — ${pending.amount} ${pending.fromToken}. Which token would you like to receive?`;
    case 'sourceChain':
      return `Got it — ${pending.amount} ${pending.fromToken} to Arc Testnet. Which source chain are you bridging from (${chains})?`;
    default:
      return 'Could you clarify that?';
  }
}

/** Human-readable one-line summary of a parsed plan, for the confirmation card. */
export function describeIntent(intent: PendingFinancialAction): string {
  switch (intent.action) {
    case 'transfer':
      return `Send ${intent.amount} ${intent.fromToken} to ${intent.recipient?.slice(0, 6)}…${intent.recipient?.slice(-4)}`;
    case 'swap':
      return `Swap ${intent.amount} ${intent.fromToken} for ${intent.toToken}`;
    case 'bridge':
      return `Bridge ${intent.amount} ${intent.fromToken} from ${intent.sourceChain ?? 'source chain'} to Arc Testnet`;
    default:
      return 'Review this action';
  }
}
