import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatUnits, parseUnits } from 'viem';
import { PRIMARY_DECIMALS, txUrl as _txUrl, addressUrl } from '@/lib/contracts';
import { format, formatDistanceToNow } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// USDC — always 6 decimals
export function formatUSDC(raw: bigint | string): string {
  const value = typeof raw === 'string' ? BigInt(raw) : raw;
  const formatted = formatUnits(value, PRIMARY_DECIMALS);
  const num = parseFloat(formatted);
  if (num === 0) return '0.00';
  if (num < 0.01) return '<0.01';
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function parseUSDC(amount: string): bigint {
  return parseUnits(amount, PRIMARY_DECIMALS);
}

// Address
export function formatAddress(address: string, chars = 4): string {
  if (!address) return '';
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

export function isValidAddress(address: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(address);
}

// Dates
export function formatDate(date: string | Date): string {
  return format(new Date(date), 'MMM d, yyyy');
}

export function formatDateTime(date: string | Date): string {
  return format(new Date(date), 'MMM d, yyyy HH:mm');
}

export function formatRelative(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

// Re-export explorer URL helpers from contracts (single source of truth)
export { txUrl, addressUrl } from '@/lib/contracts';

// ─── Network-aware explorer URL helper ──────────────────────────────────────
// Use this for client-side components that must respect the runtime-selected
// network, NOT the build-time EXPLORER_URL constant from contracts.ts.
//
// When a transaction record already carries an explorerUrl field, prefer it —
// it was stamped at write time with the correct chain-specific URL.
// Fall back to a chain-ID lookup only when the record has no explorerUrl.
const EXPLORER_BY_CHAIN: Record<number, string> = {
  5042002: 'https://testnet.arcscan.app',   // Arc Testnet
  5042:    'https://explorer.arc.io',        // Arc Mainnet
  11155111: 'https://sepolia.etherscan.io',  // Ethereum Sepolia
  84532:   'https://sepolia.basescan.org',   // Base Sepolia
  421614:  'https://sepolia.arbiscan.io',    // Arbitrum Sepolia
  1:       'https://etherscan.io',           // Ethereum Mainnet
  8453:    'https://basescan.org',           // Base Mainnet
  42161:   'https://arbiscan.io',            // Arbitrum One
  10:      'https://optimistic.etherscan.io',// OP Mainnet
  137:     'https://polygonscan.com',        // Polygon PoS
};

/**
 * Returns an explorer transaction URL derived from the chain ID.
 * Prefer passing the stored explorerUrl from a record directly — only
 * call this function when the record has no pre-stamped explorerUrl.
 */
export function getTxUrlByChainId(chainId: number | undefined, txHash: string): string {
  const base = (chainId !== undefined ? EXPLORER_BY_CHAIN[chainId] : undefined)
    ?? 'https://testnet.arcscan.app';
  return `${base}/tx/${txHash}`;
}

/**
 * Resolves the explorer URL for a transaction record that may or may not
 * carry a pre-stamped explorerUrl. Correctly handles both legacy records
 * (no explorerUrl) and new records (explorerUrl present).
 *
 * Never displays a Testnet transaction link on a Mainnet page, and vice
 * versa — chain ID is used as the authoritative discriminant.
 */
export function resolveExplorerUrl(
  txHash: string | undefined,
  chainId: number | undefined,
  storedExplorerUrl?: string | undefined,
): string | undefined {
  if (!txHash) return undefined;
  // If we have a chain-specific explorer URL already stamped on the record,
  // use it directly — it is more reliable than re-deriving from chain ID.
  if (storedExplorerUrl && storedExplorerUrl.startsWith('http')) {
    return storedExplorerUrl;
  }
  // Derive from chain ID — never assume testnet when chain ID is unknown.
  if (chainId !== undefined) {
    return getTxUrlByChainId(chainId, txHash);
  }
  // Unknown chain: do not fabricate an explorer URL.
  return undefined;
}

// Legacy aliases (keep backward compat)
export function getTxExplorerUrl(hash: string): string {
  return _txUrl(hash);
}

export function getAddressExplorerUrl(addr: string): string {
  return addressUrl(addr);
}

// Error parsing
export function parseTransactionError(error: unknown): string {
  if (!error) return 'Unknown error';
  const err = error as { message?: string; shortMessage?: string; code?: number };
  if (err.shortMessage) return err.shortMessage;
  if (err.code === 4001) return 'Transaction rejected by user';
  if (err.code === -32603) return 'Internal RPC error';
  if (err.message?.includes('insufficient')) return 'Insufficient USDC balance';
  if (err.message?.includes('nonce')) return 'Nonce error — please try again';
  if (err.message?.includes('gas')) return 'Gas estimation failed';
  if (err.message) return err.message.slice(0, 120);
  return 'Transaction failed — please try again';
}

// Clipboard
export async function copyToClipboard(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

// ID generation
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// Number formatting
export function formatNumber(n: number, decimals = 2): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(decimals);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
