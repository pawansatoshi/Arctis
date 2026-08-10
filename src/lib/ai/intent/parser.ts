import type { PendingFinancialAction } from '@/lib/store';
import { getRouteId, getSwapRoute } from '@/lib/swap/service';
import type { SwapToken } from '@/lib/swap/types';
import { CCTP_BRIDGE_CHAINS } from '@/lib/contracts';

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
const PASSPORT_RE = '@?[a-z0-9_-]{3,20}(?:\\.arc)?';
const AMOUNT_RE = '\\d+(?:\\.\\d+)?';
const TOKEN_RE = '(usdc|tusdc|tarc)';

function normalizePassportRecipient(value: string): string {
  return value.trim().toLowerCase().replace(/^@/, '').replace(/\\.arc$/, '');
}

function isPassportRecipient(value: string): boolean {
  return new RegExp(`^${PASSPORT_RE}$`, 'i').test(value.trim());
}

// ── Bridge source chains: the real CCTP config is the source of
// truth (src/lib/contracts.ts), never a hard-coded guess. ───────
interface BridgeChainMatch { name: string; chainId: number; domain: number }

const BRIDGE_CHAIN_LIST: BridgeChainMatch[] = Object.entries(CCTP_BRIDGE_CHAINS).map(
  ([chainId, chain]) => ({
    name: chain.name,
    chainId: Number(chainId),
    domain: chain.domain,
  })
);

/** Loose match against the actual configured CCTP source chains — accepts
 * the full name ("Base Sepolia") or a short form ("base", "arbitrum", "eth"). */
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

/**
 * Parses a user message into a financial action.
 * - Returns a complete PendingFinancialAction (no `missing`) when every
 *   required field is present and valid.
 * - Returns a PendingFinancialAction with `missing` set when the action
 *   is recognized but a required field (amount / recipient / destination
 *   token / source chain) is absent — the caller should ask only for the
 *   next missing field rather than asking for multiple fields at once.
 * - Returns null when no financial action is recognized at all.
 */
export function parseFinancialIntent(message: string): PendingFinancialAction | null {
  const text = message.trim();

  // ── Selection-only commands from the Economic Agent UI ──────
  // The UI may already have selected the action/pair/route.
  // Never ask for fields that are already known from that selection.

  // Transfer selection: "Transfer USDC to a Passport"
  const transferSelectionRe = new RegExp(
    `\\b(?:send|transfer)\\s+${TOKEN_RE}\\s+(?:to\\s+)?(?:a\\s+)?passport\\b`,
    'i'
  );
  const transferSelectionMatch = text.match(transferSelectionRe);
  if (transferSelectionMatch) {
    return {
      action: 'transfer',
      amount: '',
      fromToken: normalizeToken(transferSelectionMatch[1]) ?? 'USDC',
      missing: 'amount',
      createdAt: Date.now(),
    };
  }

  // Swap selection: "Swap USDC to tUSDC"
  const swapSelectionRe = new RegExp(
    `\\bswap\\s+${TOKEN_RE}\\s+(?:to|for|into)\\s+${TOKEN_RE}\\b`,
    'i'
  );
  const swapSelectionMatch = text.match(swapSelectionRe);
  if (swapSelectionMatch) {
    const fromToken = normalizeToken(swapSelectionMatch[1]);
    const toToken = normalizeToken(swapSelectionMatch[2]);

    if (fromToken && toToken && fromToken !== toToken) {
      const routeId = getRouteId(fromToken as SwapToken, toToken as SwapToken);
      const route = routeId ? getSwapRoute(routeId) : null;

      if (route?.enabled) {
        return {
          action: 'swap',
          amount: '',
          fromToken,
          toToken,
          missing: 'amount',
          createdAt: Date.now(),
        };
      }
    }
  }

  // Bridge selection:
  // "Bridge USDC from Arc Testnet to Base Sepolia"
  // Both source AND destination are captured. Never infer the destination.
  const bridgeSelectionRe = new RegExp(
    `\\bbridge\\s+${TOKEN_RE}\\s+from\\s+(.+?)\\s+to\\s+(.+?)\\s*$`,
    'i'
  );
  const bridgeSelectionMatch = text.match(bridgeSelectionRe);

  if (bridgeSelectionMatch) {
    const fromToken = normalizeToken(bridgeSelectionMatch[1]) ?? 'USDC';
    const source = matchBridgeChain(bridgeSelectionMatch[2]);
    const destination = matchBridgeChain(bridgeSelectionMatch[3]);

    if (source && destination && source.chainId !== destination.chainId) {
      return {
        action: 'bridge',
        amount: '',
        fromToken,
        sourceChain: source.name,
        sourceChainId: source.chainId,
        destinationChain: destination.name,
        destinationChainId: destination.chainId,
        missing: 'amount',
        createdAt: Date.now(),
      };
    }
  }

  // ── Transfer: "send/transfer 5 USDC to 0x..." ──────────────
  const transferFullRe = new RegExp(
    `\\b(?:send|transfer)\\s+(${AMOUNT_RE})\\s*${TOKEN_RE}?\\s+to\\s+(${ADDRESS_RE}|${PASSPORT_RE})`, 'i'
  );
  const transferFullMatch = text.match(transferFullRe);
  if (transferFullMatch) {
    return {
      action: 'transfer',
      amount: transferFullMatch[1],
      fromToken: normalizeToken(transferFullMatch[2]) ?? 'USDC',
      recipient: isPassportRecipient(transferFullMatch[3])
        ? normalizePassportRecipient(transferFullMatch[3])
        : transferFullMatch[3],
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

  // ── Bridge: "bridge 5 USDC from Arc Testnet to Base Sepolia" ──
  const bridgeRe = new RegExp(
    `\\bbridge\\s+(${AMOUNT_RE})\\s*${TOKEN_RE}?\\s+from\\s+(.+?)\\s+to\\s+(.+?)\\s*$`,
    'i'
  );
  const bridgeMatch = text.match(bridgeRe);

  if (bridgeMatch) {
    const source = matchBridgeChain(bridgeMatch[3]);
    const destination = matchBridgeChain(bridgeMatch[4]);

    const base: PendingFinancialAction = {
      action: 'bridge',
      amount: bridgeMatch[1],
      fromToken: normalizeToken(bridgeMatch[2]) ?? 'USDC',
      createdAt: Date.now(),
    };

    if (!source) return { ...base, missing: 'sourceChain' };

    if (!destination) {
      return {
        ...base,
        sourceChain: source.name,
        sourceChainId: source.chainId,
        missing: 'sourceChain',
        error: 'Please specify a supported destination chain.',
      };
    }

    if (source.chainId === destination.chainId) {
      return {
        ...base,
        sourceChain: source.name,
        sourceChainId: source.chainId,
        missing: 'sourceChain',
        error: 'Source and destination chains must be different.',
      };
    }

    return {
      ...base,
      sourceChain: source.name,
      sourceChainId: source.chainId,
      destinationChain: destination.name,
      destinationChainId: destination.chainId,
    };
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
    case 'amount': {
      const amountMatch = text.match(new RegExp(`^${AMOUNT_RE}$`));

      if (!amountMatch) {
        return {
          ...clean,
          missing: 'amount',
          error: 'Please enter a valid numeric amount.',
        };
      }

      const amount = amountMatch[0];

      // After amount is supplied, ask only for the next genuinely
      // missing field. Swap/bridge selections are already complete.
      if (pending.action === 'transfer') {
        return {
          ...clean,
          amount,
          missing: 'recipient',
          error: undefined,
        };
      }

      return {
        ...clean,
        amount,
        missing: undefined,
        error: undefined,
      };
    }

    case 'recipient': {
      const address = text.match(new RegExp(`^${ADDRESS_RE}$`, 'i'));
      if (address) return { ...clean, recipient: address[0], missing: undefined };

      const passport = text.match(new RegExp(`^${PASSPORT_RE}$`, 'i'));
      if (passport) {
        return {
          ...clean,
          recipient: normalizePassportRecipient(passport[0]),
          missing: undefined,
        };
      }

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
      const chain = matchBridgeChain(text);
      if (chain) {
        return {
          ...clean,
          sourceChain: chain.name,
          sourceChainId: chain.chainId,
          missing: undefined,
        };
      }
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
      // Legacy fallback only. New UI selections should resolve to a
      // specific action/pair/route and therefore use `missing: amount`.
      return `Please provide the details for this ${pending.action} action.`;
    case 'amount':
      if (pending.action === 'transfer') return `How much ${pending.fromToken ?? 'USDC'} would you like to send?`;
      if (pending.action === 'swap') return `How much ${pending.fromToken ?? 'USDC'} would you like to swap?`;
      return `How much ${pending.fromToken ?? 'USDC'} would you like to bridge?`;
    case 'recipient':
      return `Got it — ${pending.amount} ${pending.fromToken}. What wallet address or Passport username should this go to?`;
    case 'toToken':
      return (pending as PendingFinancialAction & { error?: string }).error
        ? `${(pending as PendingFinancialAction & { error?: string }).error} Which token would you like instead?`
        : `Got it — ${pending.amount} ${pending.fromToken}. Which token would you like to receive?`;
    case 'sourceChain':
      return `Which source and destination chains should I use? Supported: ${chains}.`;
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
      return `Bridge ${intent.amount} ${intent.fromToken} from ${intent.sourceChain ?? 'source chain'} to ${intent.destinationChain ?? 'destination chain'}`;
    default:
      return 'Review this action';
  }
}
