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
