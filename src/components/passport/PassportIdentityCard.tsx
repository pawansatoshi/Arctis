'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAccount } from 'wagmi';
import { CheckCircle2, Copy, Wallet, CalendarDays, Clock3, ExternalLink, RefreshCw, Droplets, Pencil } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn, formatAddress } from '@/lib/utils';
import { useExternalBalances } from '@/lib/hooks/useExternalBalances';

export interface PassportData {
  username: string;
  walletAddress: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  verified?: boolean;
  createdAt?: string;
}

function daysSince(date?: string) {
  if (!date) return 0;
  const created = new Date(date).getTime();
  if (!Number.isFinite(created)) return 0;
  return Math.max(0, Math.floor((Date.now() - created) / 86_400_000));
}

function InitialAvatar({ username, avatarUrl }: { username: string; avatarUrl?: string | null }) {
  const [failed, setFailed] = useState(false);
  if (avatarUrl && !failed) {
    return <img src={avatarUrl} alt={`${username}.arc avatar`} onError={() => setFailed(true)} className="w-16 h-16 rounded-2xl object-cover ring-2 ring-white/70 shadow-xl" />;
  }
  return (
    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-500 via-blue-600 to-violet-600 text-white flex items-center justify-center text-2xl font-bold ring-2 ring-white/70 shadow-xl">
      {username?.charAt(0).toUpperCase() || 'A'}
    </div>
  );
}

interface PassportIdentityCardProps {
  passport: PassportData | null;
  refreshKey?: number;
}

export default function PassportIdentityCard({
  passport,
  refreshKey = 0,
}: PassportIdentityCardProps) {
  const { address } = useAccount();
  const balances = useExternalBalances(address);
  const [copied, setCopied] = useState<'wallet' | 'handle' | null>(null);

  useEffect(() => {
    if (refreshKey > 0) void balances.refresh();
  }, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const age = useMemo(() => daysSince(passport?.createdAt), [passport?.createdAt]);
  const minted = passport?.createdAt ? new Date(passport.createdAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  const copyText = async (value: string, type: 'wallet' | 'handle') => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(type);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      // Clipboard permission can be unavailable in some browsers.
    }
  };

  if (!passport) return null;

  return (
    <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card overflow-hidden border border-black/[0.07] dark:border-white/[0.08]">
      <div className="relative px-5 sm:px-6 py-5 bg-gradient-to-r from-sky-500/[0.12] via-blue-500/[0.08] to-violet-500/[0.12]">
        <div className="absolute inset-0 pointer-events-none opacity-50" style={{ backgroundImage: 'radial-gradient(circle at 85% 10%, rgba(59,130,246,.18), transparent 32%), radial-gradient(circle at 15% 100%, rgba(139,92,246,.12), transparent 28%)' }} />
        <div className="relative flex items-center gap-4">
          <InitialAvatar username={passport.username} avatarUrl={passport.avatarUrl} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-bold text-surface-950 truncate">{passport.displayName || passport.username}</h2>
              {passport.verified && <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />}
            </div>
            <div className="mt-0.5 flex items-center gap-2">
              <span className="text-blue-600 dark:text-blue-400 font-mono text-sm">{passport.username}.arc</span>
              <button
                onClick={() => void copyText(`${passport.username}.arc`, 'handle')}
                aria-label="Copy Passport ID"
                className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5"
              >
                {copied === 'handle' ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
            <div className="mt-1 flex items-center gap-2 text-surface-500 text-[11px] font-mono">
              <Wallet className="w-3 h-3" />
              <span className="truncate">{formatAddress(passport.walletAddress, 6)}</span>
              <button onClick={() => void copyText(passport.walletAddress, 'wallet')} aria-label="Copy wallet address" className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5">
                {copied === 'wallet' ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          </div>
          <div className="hidden sm:flex flex-col items-end text-right">
            <span className="text-[9px] uppercase tracking-[0.18em] text-surface-500">Passport</span>
            <span className="text-xs font-semibold text-surface-800">Active Identity</span>
            <Link
              href="/passport"
              className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              <Pencil className="w-3 h-3" />
              Edit Profile
            </Link>
          </div>
        </div>
        <Link
          href="/passport"
          className="sm:hidden mt-3 inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600 dark:text-blue-400"
        >
          <Pencil className="w-3 h-3" />
          Edit Profile
        </Link>
      </div>

      <div className="p-4 sm:p-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
          <div className="metric-card">
            <div className="flex items-center gap-1.5 text-surface-500 text-[10px] uppercase tracking-wider"><CalendarDays className="w-3 h-3" /> Minted</div>
            <div className="mt-1 text-xs font-semibold text-surface-950">{minted}</div>
          </div>
          <div className="metric-card">
            <div className="flex items-center gap-1.5 text-surface-500 text-[10px] uppercase tracking-wider"><Clock3 className="w-3 h-3" /> Passport Age</div>
            <div className="mt-1 text-xs font-semibold text-surface-950">{age} day{age === 1 ? '' : 's'}</div>
          </div>
          <div className="metric-card min-w-0">
            <div className="text-surface-500 text-[10px] uppercase tracking-wider">Passport ID</div>
            <div className="mt-1 text-xs font-mono text-surface-800 truncate">{passport.username}.arc</div>
          </div>
          <div className="metric-card col-span-2 sm:col-span-1 min-w-0">
            <div className="flex items-center gap-1.5 text-surface-500 text-[10px] uppercase tracking-wider"><Wallet className="w-3 h-3" /> Wallet</div>
            <div className="mt-1 text-xs font-mono text-surface-800 truncate">{passport.walletAddress}</div>
          </div>
        </div>

        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-surface-950 text-xs font-semibold uppercase tracking-widest">Bridge & Transfer Funds</div>
            <div className="text-surface-500 text-[10px] mt-0.5">Live balances available before you execute a transaction</div>
          </div>
          <button onClick={balances.refresh} className="p-1.5 rounded-lg hover:bg-black/[0.05] dark:hover:bg-white/[0.05] text-surface-500" aria-label="Refresh external balances">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <NetworkBalance name="Base Sepolia" chain="84532" eth={balances.baseSepolia.eth} usdc={balances.baseSepolia.usdc} loading={balances.baseSepolia.loading} explorer="https://sepolia.basescan.org" />
          <NetworkBalance name="Arbitrum Sepolia" chain="421614" eth={balances.arbitrumSepolia.eth} usdc={balances.arbitrumSepolia.usdc} loading={balances.arbitrumSepolia.loading} explorer="https://sepolia.arbiscan.io" />
        </div>
        <a
          href="https://faucet.circle.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-blue-500/20 bg-blue-500/[0.07] px-4 py-3 hover:bg-blue-500/[0.11] transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-blue-500/15 flex items-center justify-center flex-shrink-0">
              <Droplets className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-surface-900 dark:text-surface-100">Need testnet USDC?</div>
              <div className="text-[10px] text-surface-500 truncate">Get supported testnet USDC from Circle Faucet</div>
            </div>
          </div>
          <ExternalLink className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
        </a>
      </div>
    </motion.section>
  );
}

function NetworkBalance({ name, chain, eth, usdc, loading, explorer }: { name: string; chain: string; eth: string; usdc: string; loading: boolean; explorer: string }) {
  return (
    <div className="rounded-2xl border border-black/[0.07] dark:border-white/[0.08] bg-surface-100/60 dark:bg-white/[0.02] p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-surface-950 text-sm font-semibold">{name}</div>
          <div className="text-surface-500 text-[10px] font-mono">Chain {chain}</div>
        </div>
        <a href={explorer} target="_blank" rel="noreferrer" className="p-1.5 rounded-lg hover:bg-black/[0.05] dark:hover:bg-white/[0.05] text-surface-500" aria-label={`${name} explorer`}><ExternalLink className="w-3.5 h-3.5" /></a>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <BalanceMini label="ETH" value={eth} loading={loading} />
        <BalanceMini label="USDC" value={usdc} loading={loading} />
      </div>
    </div>
  );
}

function BalanceMini({ label, value, loading }: { label: string; value: string; loading: boolean }) {
  return (
    <div className={cn('rounded-xl px-3 py-2.5', label === 'USDC' ? 'bg-blue-500/[0.08]' : 'bg-surface-200/70 dark:bg-white/[0.04]')}>
      <div className="text-surface-500 text-[9px] uppercase tracking-widest">{label}</div>
      <div className="text-surface-950 text-sm font-mono font-semibold mt-0.5">{loading && value === '—' ? '…' : value}</div>
    </div>
  );
}
