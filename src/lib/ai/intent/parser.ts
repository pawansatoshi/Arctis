import type { PendingFinancialAction } from '@/lib/store';

// ============================================================
// ARCTIS Financial Intent Parser
// ============================================================
// Deliberately deterministic (regex, not an LLM call) — extracting
// an amount, token, or destination address for a financial action
// is exactly the kind of detail an LLM can subtly get wrong or
// hallucinate. This never executes anything; it only produces a
// *proposed* plan that the user must review and confirm on the
// existing Transfer/Swap/Bridge page before any wallet signature.
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

export function parseFinancialIntent(message: string): PendingFinancialAction | null {
  const text = message.trim();

  // ── Transfer: "send/transfer 5 USDC to 0x..." ──────────────
  const transferRe = new RegExp(
    `\\b(?:send|transfer)\\s+(${AMOUNT_RE})\\s*${TOKEN_RE}?\\s+to\\s+(${ADDRESS_RE})`, 'i'
  );
  const transferMatch = text.match(transferRe);
  if (transferMatch) {
    return {
      action: 'transfer',
      amount: transferMatch[1],
      fromToken: normalizeToken(transferMatch[2]) ?? 'USDC',
      recipient: transferMatch[3],
      createdAt: Date.now(),
    };
  }

  // ── Swap: "swap 10 USDC to/for tARC" ────────────────────────
  const swapRe = new RegExp(
    `\\bswap\\s+(${AMOUNT_RE})\\s*${TOKEN_RE}\\s+(?:to|for|into)\\s*${TOKEN_RE}`, 'i'
  );
  const swapMatch = text.match(swapRe);
  if (swapMatch) {
    const fromToken = normalizeToken(swapMatch[2]);
    const toToken = normalizeToken(swapMatch[3]);
    if (fromToken && toToken && fromToken !== toToken) {
      return {
        action: 'swap',
        amount: swapMatch[1],
        fromToken,
        toToken,
        createdAt: Date.now(),
      };
    }
  }

  // ── Bridge: "bridge 5 USDC" (destination is always Arc Testnet) ──
  const bridgeRe = new RegExp(`\\bbridge\\s+(${AMOUNT_RE})\\s*${TOKEN_RE}?`, 'i');
  const bridgeMatch = text.match(bridgeRe);
  if (bridgeMatch) {
    return {
      action: 'bridge',
      amount: bridgeMatch[1],
      fromToken: normalizeToken(bridgeMatch[2]) ?? 'USDC',
      createdAt: Date.now(),
    };
  }

  return null;
}

/** Human-readable one-line summary of a parsed plan, for the confirmation card. */
export function describeIntent(intent: PendingFinancialAction): string {
  switch (intent.action) {
    case 'transfer':
      return `Send ${intent.amount} ${intent.fromToken} to ${intent.recipient?.slice(0, 6)}…${intent.recipient?.slice(-4)}`;
    case 'swap':
      return `Swap ${intent.amount} ${intent.fromToken} for ${intent.toToken}`;
    case 'bridge':
      return `Bridge ${intent.amount} ${intent.fromToken} to Arc Testnet`;
    default:
      return 'Review this action';
  }
}
