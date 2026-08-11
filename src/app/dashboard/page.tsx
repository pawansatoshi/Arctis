'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccount } from 'wagmi';
import {
  ArrowUpRight, RefreshCw, AlertCircle, XCircle, UserCircle,
  CheckCircle2, Clock, Bot, Building2, ArrowLeftRight, GitMerge,
  Coins, Zap, Activity, Wallet, Sparkles, ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import { useUSDCBalance } from '@/lib/hooks/useUSDCBalance';
import { useTARCBalance } from '@/lib/hooks/useTARCBalance';
import { useAppStore } from '@/lib/store';
import { formatAddress, formatRelative, txUrl, cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/Skeleton';
import type { TransactionRecord } from '@/types';
import PassportIdentityCard, { type PassportData } from "@/components/passport/PassportIdentityCard";

/* ── Motion variants ───────────────────────────────────────── */
const page = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.02 } },
};
const row = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
};

/* ── Tiny helpers ──────────────────────────────────────────── */
function StatusIcon({ status }: { status: TransactionRecord['status'] }) {
  if (status === 'confirmed') return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />;
  if (status === 'pending')   return <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 animate-pulse" />;
  if (status === 'failed')    return <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />;
  return <AlertCircle className="w-3.5 h-3.5 text-surface-600" />;
}

function TxTypePill({ type }: { type?: string }) {
  const map: Record<string, string> = {
    transfer:        'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    swap:            'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    bridge:          'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
    credit_purchase: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    membership:      'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  };
  const label = type ? type.replace('_', ' ') : 'tx';
  const cls   = map[type ?? ''] ?? 'bg-surface-300/30 text-surface-600';
  return (
    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-medium capitalize', cls)}>
      {label}
    </span>
  );
}

/* ── OS Pillars data ───────────────────────────────────────── */
const PILLARS = [
  { id: 'ai',      label: 'AI OS',           sub: 'Copilot & Chat',    href: '/ai',       icon: Bot,          from: 'from-violet-500/20', border: 'border-violet-500/20', iconColor: 'text-violet-600 dark:text-violet-400', dot: 'bg-violet-400' },
  { id: 'swap',    label: 'Stablecoin OS',   sub: 'Transfer · Swap · Bridge', href: '/swap', icon: ArrowLeftRight, from: 'from-blue-500/20',   border: 'border-blue-500/20',   iconColor: 'text-blue-600 dark:text-blue-400',   dot: 'bg-blue-400' },
  { id: 'agents',  label: 'Economic Agents', sub: 'Approve & Deploy',  href: '/agents',   icon: GitMerge,     from: 'from-emerald-500/20',border: 'border-emerald-500/20',iconColor: 'text-emerald-600 dark:text-emerald-400',dot: 'bg-emerald-400' },
  { id: 'knowledge', label: 'Knowledge OS', sub: 'Sessions & Prompts', href: '/workspace',icon: Sparkles,     from: 'from-amber-500/20',  border: 'border-amber-500/20',  iconColor: 'text-amber-600 dark:text-amber-400',  dot: 'bg-amber-400' },
] as const;

/* ── Quick actions ─────────────────────────────────────────── */
const QUICK = [
  { label: 'AI Workspace', href: '/ai',       icon: Bot,           color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-500/10' },
  { label: 'Swap',         href: '/swap',     icon: ArrowLeftRight, color: 'text-blue-600 dark:text-blue-400',  bg: 'bg-blue-500/10'  },
  { label: 'Agents',       href: '/agents',   icon: GitMerge,      color: 'text-emerald-600 dark:text-emerald-400',bg: 'bg-emerald-500/10'},
  { label: 'Treasury',     href: '/treasury', icon: Building2,     color: 'text-amber-600 dark:text-amber-400',  bg: 'bg-amber-500/10' },
] as const;

/* ══════════════════════════════════════════════════════════════
   DASHBOARD PAGE
══════════════════════════════════════════════════════════════ */
export default function DashboardPage() {
  const { address, isConnected } = useAccount();
  const { formatted: balance, isLoading: balanceLoading, refetch } = useUSDCBalance();
  const { formatted: tarcBalance } = useTARCBalance();
  const { transactions, creditBalance } = useAppStore();

  const [proposals, setProposals] = useState<Array<{
    proposalId: string; agentName: string; task: string;
  }>>([]);
  const [hasPassport, setHasPassport] = useState<boolean | null>(null);
  const [passportProfile, setPassportProfile] = useState<PassportData | null>(null);
  const [passportRefreshKey, setPassportRefreshKey] = useState(0);
  const [passportLoading, setPassportLoading] = useState(false);

  const loadPassport = useCallback(async (wallet: string) => {
    setPassportLoading(true);

    try {
      const response = await fetch(
        `/api/passport/by-wallet?walletAddress=${encodeURIComponent(wallet)}`,
        {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        },
      );

      if (response.status === 404) {
        setHasPassport(false);
        setPassportProfile(null);
        return;
      }

      if (!response.ok) throw new Error('Passport lookup failed');

      const data = (await response.json()) as PassportData;
      setHasPassport(true);
      setPassportProfile(data);
    } catch {
      setHasPassport(null);
      setPassportProfile(null);
    } finally {
      setPassportLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!address) {
      setProposals([]);
      setHasPassport(null);
      setPassportProfile(null);
      return;
    }

    let cancelled = false;

    fetch(`/api/agents/proposals?wallet=${encodeURIComponent(address)}`, {
      cache: 'no-store',
    })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setProposals(d.proposals ?? []);
      })
      .catch(() => {});

    void loadPassport(address);

    return () => {
      cancelled = true;
    };
  }, [address, loadPassport]);

  const handleRefreshAll = async () => {
    setPassportRefreshKey((key) => key + 1);
    await Promise.allSettled([
      refetch(),
      address ? loadPassport(address) : Promise.resolve(),
    ]);
  };

  const recentTxs = transactions.slice(0, 8);
  const failedTxs = transactions.filter((t: TransactionRecord) => t.status === 'failed').slice(0, 3);

  const actionItems = [
    ...proposals.map((p: { proposalId: string; agentName: string; task: string }) => ({
      key:  `proposal-${p.proposalId}`,
      tone: 'amber' as const,
      icon: GitMerge,
      title: `Agent approval: ${p.agentName}`,
      sub:  p.task.length > 60 ? p.task.slice(0, 60) + '…' : p.task,
      cta:  'Review',
      href: '/agents',
    })),
    ...failedTxs.map((t: TransactionRecord) => ({
      key:  `failed-${t.id}`,
      tone: 'rose' as const,
      icon: XCircle,
      title: 'Transaction failed',
      sub:  `${t.amountFormatted} ${t.token ?? 'USDC'}`,
      cta:  'Retry',
      href: '/transfer',
    })),
    ...(hasPassport === false ? [{
      key:  'passport',
      tone: 'blue' as const,
      icon: UserCircle,
      title: 'Claim your Passport',
      sub:  'Set your username.arc identity',
      cta:  'Claim',
      href: '/passport',
    }] : []),
  ];

  /* ── Unconnected state ───────────────────────────────────── */
  if (!isConnected) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="min-h-[70vh] flex flex-col items-center justify-center text-center px-6"
      >
        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full opacity-[0.06]"
            style={{ background: 'radial-gradient(ellipse, #3b82f6 0%, transparent 70%)' }} />
        </div>

        <div className="relative">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-500/20 to-violet-500/20 border border-black/[0.08] dark:border-white/[0.08] flex items-center justify-center mx-auto mb-6 shadow-xl">
            <Wallet className="w-9 h-9 text-blue-600 dark:text-blue-400" />
          </div>
          <h1 className="text-3xl font-bold text-surface-950 mb-3 tracking-tight">
            Welcome to ARCTIS
          </h1>
          <p className="text-surface-600 text-base max-w-xs mx-auto leading-relaxed mb-8">
            Connect your wallet to access the AI + Stablecoin Operating System — built on Arc.
          </p>

          {/* OS Pillars preview */}
          <div className="grid grid-cols-2 gap-2 max-w-xs mx-auto mb-8">
            {PILLARS.map((p: typeof PILLARS[number]) => (
              <div key={p.id}
                className={cn('glass-card p-3 flex items-center gap-2.5 border', p.border)}>
                <div className={cn('w-6 h-6 rounded-lg flex items-center justify-center', `bg-gradient-to-br ${p.from}`)}>
                  <p.icon className={cn('w-3 h-3', p.iconColor)} />
                </div>
                <span className="text-surface-700 text-xs font-medium">{p.label}</span>
              </div>
            ))}
          </div>

          <p className="text-surface-600 text-xs">
            Connect via the button in the top-right corner
          </p>
        </div>
      </motion.div>
    );
  }

  /* ── Connected ───────────────────────────────────────────── */
  return (
    <motion.div variants={page} initial="hidden" animate="show" className="max-w-5xl space-y-8 pb-12">

      {/* ── HEADER ─────────────────────────────────────────── */}
      <motion.div variants={row} className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-surface-950 tracking-tight leading-tight">
            Command Center
          </h1>
          {address && (
            <div className="flex items-center gap-2 mt-1">
              <span className="status-dot-online" />
              <span className="text-surface-500 text-xs font-mono">
                {formatAddress(address, 6)}
              </span>
              <span className="text-surface-600 text-xs">· Arc Testnet</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => void handleRefreshAll()}
            aria-label="Refresh dashboard"
            className="p-2.5 rounded-xl text-surface-600 hover:text-surface-950 hover:bg-black/[0.07] dark:hover:bg-white/[0.07] transition-all duration-200 active:scale-95"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <Link href="/transfer" className="btn-primary shadow-lg shadow-blue-500/20">
            <ArrowUpRight className="w-4 h-4" />
            <span className="hidden sm:inline">Send USDC</span>
            <span className="sm:hidden">Send</span>
          </Link>
        </div>
      </motion.div>

      <motion.div variants={row}>
        {passportLoading && !passportProfile ? (
          <div className="glass-card p-5 text-sm text-surface-500">
            Loading Passport identity…
          </div>
        ) : passportProfile ? (
          <PassportIdentityCard
            passport={passportProfile}
            refreshKey={passportRefreshKey}
          />
        ) : null}
      </motion.div>

      {/* ── BALANCE ROW ────────────────────────────────────── */}
      <motion.div variants={row} className="grid grid-cols-1 sm:grid-cols-3 gap-3">

        {/* USDC — primary, full-width on mobile */}
        <div className="sm:col-span-2 glass-card p-6 relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.12) 0%, rgba(139,92,246,0.06) 100%)' }}>
          {/* Subtle glow orb */}
          <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)' }}
            aria-hidden />

          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-500/20 border border-blue-500/20 flex items-center justify-center">
                  <Activity className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="text-surface-500 text-xs font-medium uppercase tracking-wider">USDC Balance</span>
              </div>
              <span className="text-surface-600 text-xs">Arc Testnet</span>
            </div>

            {balanceLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-11 w-48 rounded-xl" />
                <Skeleton className="h-3.5 w-24 rounded" />
              </div>
            ) : (
              <>
                <div className="text-[2.75rem] font-bold text-surface-950 font-mono leading-none tracking-tight mb-1">
                  {balance}
                </div>
                <div className="text-surface-500 text-xs">Arc Native USDC · Built on Arc</div>
              </>
            )}
          </div>
        </div>

        {/* Secondary balances stacked */}
        <div className="flex flex-col gap-3">
          {/* tARC */}
          <div className="metric-card flex-1"
            style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.08) 0%, transparent 100%)' }}>
            <div className="flex items-center justify-between">
              <span className="text-surface-500 text-xs uppercase tracking-wider">tARC</span>
              <div className="w-6 h-6 rounded-lg bg-violet-500/15 flex items-center justify-center">
                <Zap className="w-3 h-3 text-violet-600 dark:text-violet-400" />
              </div>
            </div>
            <div className="text-xl font-bold text-surface-950 font-mono">{tarcBalance}</div>
            <div className="text-surface-500 text-[10px]">Swap token</div>
          </div>

          {/* Credits */}
          <div className="metric-card flex-1"
            style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.08) 0%, transparent 100%)' }}>
            <div className="flex items-center justify-between">
              <span className="text-surface-500 text-xs uppercase tracking-wider">AI Credits</span>
              <div className="w-6 h-6 rounded-lg bg-amber-500/15 flex items-center justify-center">
                <Coins className="w-3 h-3 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
            <div className="text-xl font-bold text-surface-950 font-mono">
              {creditBalance ? creditBalance.remaining.toLocaleString() : '—'}
            </div>
            <div className="text-surface-500 text-[10px]">remaining</div>
          </div>
        </div>
      </motion.div>

      {/* ── ACTION REQUIRED ─────────────────────────────────── */}
      <AnimatePresence>
        {actionItems.length > 0 && (
          <motion.div
            key="action-required"
            variants={row}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-2"
          >
            <div className="flex items-center gap-2 px-1">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-surface-950 text-xs font-semibold uppercase tracking-widest">
                Action Required
              </span>
              <span className="ml-auto text-surface-600 text-xs">{actionItems.length} item{actionItems.length !== 1 ? 's' : ''}</span>
            </div>

            {actionItems.map((a, i) => {
              const Icon = a.icon;
              const toneMap = {
                amber: { card: 'border-amber-500/25 bg-amber-500/[0.06]', icon: 'bg-amber-500/15 border-amber-500/20', iconColor: 'text-amber-600 dark:text-amber-400', cta: 'text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/15' },
                rose:  { card: 'border-rose-500/25 bg-rose-500/[0.06]',   icon: 'bg-rose-500/15 border-rose-500/20',   iconColor: 'text-rose-600 dark:text-rose-400',   cta: 'text-rose-700 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/15' },
                blue:  { card: 'border-blue-500/25 bg-blue-500/[0.06]',   icon: 'bg-blue-500/15 border-blue-500/20',   iconColor: 'text-blue-600 dark:text-blue-400',   cta: 'text-blue-700 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/15' },
              };
              const t = toneMap[a.tone as keyof typeof toneMap];
              return (
                <motion.div
                  key={a.key}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={cn('glass-card p-4 flex items-center gap-3.5 border', t.card)}
                >
                  <div className={cn('w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0', t.icon)}>
                    <Icon className={cn('w-4 h-4', t.iconColor)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-surface-950 text-sm font-semibold truncate leading-snug">{a.title}</p>
                    <p className="text-surface-500 text-xs mt-0.5 truncate">{a.sub}</p>
                  </div>
                  <Link
                    href={a.href}
                    className={cn(
                      'flex-shrink-0 flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all duration-200',
                      t.cta
                    )}
                  >
                    {a.cta}
                    <ChevronRight className="w-3 h-3" />
                  </Link>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── OS PILLARS / QUICK ACTIONS ──────────────────────── */}
      <motion.div variants={row}>
        <div className="flex items-center gap-2 px-1 mb-3">
          <span className="text-surface-600 text-xs font-semibold uppercase tracking-widest">Quick Access</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {QUICK.map((q) => (
            <Link
              key={q.href}
              href={q.href}
              className="glass-card-hover group p-4 flex flex-col gap-3"
            >
              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center transition-transform duration-200 group-hover:scale-105', q.bg)}>
                <q.icon className={cn('w-5 h-5', q.color)} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-surface-950 text-sm font-medium group-hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200">
                  {q.label}
                </span>
                <ArrowUpRight className="w-3.5 h-3.5 text-surface-600 group-hover:text-blue-600 dark:hover:text-blue-400 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-all duration-200" />
              </div>
            </Link>
          ))}
        </div>
      </motion.div>

      {/* ── OS OVERVIEW ─────────────────────────────────────── */}
      <motion.div variants={row}>
        <div className="flex items-center gap-2 px-1 mb-3">
          <span className="text-surface-600 text-xs font-semibold uppercase tracking-widest">Operating Systems</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {PILLARS.map((p: typeof PILLARS[number]) => (
            <Link
              key={p.id}
              href={p.href}
              className={cn(
                'glass-card group p-3.5 flex items-center gap-2.5 border transition-all duration-200',
                'hover:border-black/[0.12] dark:hover:border-white/[0.12]',
                p.border,
              )}
            >
              <div className={cn(
                'w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-110',
                `bg-gradient-to-br ${p.from}`,
              )}>
                <p.icon className={cn('w-3.5 h-3.5', p.iconColor)} />
              </div>
              <div className="min-w-0">
                <div className="text-surface-950 text-xs font-semibold truncate">{p.label}</div>
                <div className="text-surface-500 text-[10px] truncate">{p.sub}</div>
              </div>
            </Link>
          ))}
        </div>
      </motion.div>

      {/* ── RECENT ACTIVITY ─────────────────────────────────── */}
      <motion.div variants={row}>
        <div className="glass-card overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.05] dark:border-white/[0.05]">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-surface-600" />
              <h2 className="text-surface-950 font-semibold text-sm">Recent Activity</h2>
            </div>
            <Link
              href="/history"
              className="text-blue-600 dark:text-blue-400 text-xs font-medium hover:text-blue-700 dark:hover:text-blue-300 transition-colors flex items-center gap-1"
            >
              View all <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          {/* Empty state */}
          {recentTxs.length === 0 ? (
            <div className="py-16 flex flex-col items-center text-center px-6">
              <div className="w-14 h-14 rounded-2xl bg-surface-300/40 flex items-center justify-center mx-auto mb-4">
                <Clock className="w-6 h-6 text-surface-600 opacity-60" />
              </div>
              <p className="text-surface-700 font-medium text-sm mb-1">No transactions yet</p>
              <p className="text-surface-600 text-xs mb-6 max-w-[200px] leading-relaxed">
                Send your first USDC or start a swap to see activity here.
              </p>
              <div className="flex gap-2 flex-wrap justify-center">
                <Link href="/transfer" className="btn-primary text-xs px-4 py-2">
                  <ArrowUpRight className="w-3.5 h-3.5" /> Send USDC
                </Link>
                <Link href="/swap" className="btn-ghost text-xs px-4 py-2">
                  <ArrowLeftRight className="w-3.5 h-3.5" /> Swap tokens
                </Link>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-black/[0.035] dark:divide-white/[0.035]">
              {recentTxs.map((tx: TransactionRecord, i: number) => (
                <motion.div
                  key={tx.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.05 + i * 0.03 }}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-black/[0.025] dark:hover:bg-white/[0.025] transition-colors duration-150 group"
                >
                  {/* Status icon */}
                  <div className="w-8 h-8 rounded-full bg-surface-300/50 border border-black/[0.05] dark:border-white/[0.05] flex items-center justify-center flex-shrink-0">
                    <StatusIcon status={tx.status} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-surface-950 text-sm font-medium truncate">
                        {formatAddress(tx.toAddress ?? '', 5)}
                      </span>
                      <TxTypePill type={tx.type} />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-surface-600 text-xs">{formatRelative(tx.createdAt)}</span>
                      {tx.txHash && (
                        <a
                          href={txUrl(tx.txHash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 dark:text-blue-400/70 text-[10px] hover:text-blue-800 dark:hover:text-blue-400 transition-colors font-mono"
                          aria-label={`View transaction ${tx.txHash} on ArcScan`}
                        >
                          {formatAddress(tx.txHash, 3)} ↗
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Amount */}
                  <div className="text-right flex-shrink-0">
                    <div className={cn(
                      'text-sm font-mono font-semibold',
                      tx.status === 'failed' ? 'text-rose-600 dark:text-rose-400' : 'text-surface-950',
                    )}>
                      -{tx.amountFormatted}
                    </div>
                    <div className="text-surface-500 text-[10px]">{tx.token ?? 'USDC'}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </motion.div>

      {/* ── FOOTER ATTRIBUTION ──────────────────────────────── */}
      <motion.div variants={row}>
        <p className="text-center text-surface-600 text-xs">
          ARCTIS · Built on Arc · Powered by Arc Native USDC
        </p>
      </motion.div>

    </motion.div>
  );
}
