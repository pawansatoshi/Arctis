'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Coins, Zap, ShoppingCart, CheckCircle2, RefreshCw, ExternalLink, Wallet } from 'lucide-react';
import { useAccount } from 'wagmi';
import { useWalletAuth } from '@/lib/auth/useWalletAuth';
import { useTransfer } from '@/lib/hooks/useTransfer';
import { useUSDCBalance } from '@/lib/hooks/useUSDCBalance';
import { useAppStore } from '@/lib/store';
import { CREDIT_PACKAGES, CREDITS_PER_1K_TOKENS } from '@/lib/memberships/plans';
import { cn, formatRelative, txUrl } from '@/lib/utils';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonList } from '@/components/ui/Skeleton';
import toast from 'react-hot-toast';
import type { CreditLedgerEntry } from '@/types';
import { TREASURY_WALLET } from '@/lib/contracts';

export default function CreditsPage() {
  const { address, isConnected } = useAccount();
  const { getAuthHeaders } = useWalletAuth();
  const { formatted: balance } = useUSDCBalance();
  const { creditBalance, setCreditBalance } = useAppStore();
  const [history, setHistory] = useState<CreditLedgerEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [selectedPkg, setSelectedPkg] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // One useTransfer instance per purchase — reset between purchases
  const {
    transfer, isPending, isConfirming, isSuccess, txHash, error, reset,
  } = useTransfer();

  // Track which package is being purchased to grant credits on confirmation
  const pendingPkgRef = useRef<string | null>(null);
  const grantedRef    = useRef<Set<string>>(new Set());

  const fetchCredits = useCallback(async () => {
    if (!address) return;
    try {
      const res = await fetch(`/api/credits?wallet=${address}`);
      const data = await res.json();
      if (data.balance) setCreditBalance(data.balance);
      if (data.history) setHistory(data.history);
    } catch {
      toast.error('Could not load credit history — please try refreshing');
    } finally {
      setHistoryLoading(false);
    }
  }, [address, setCreditBalance]);

  useEffect(() => { fetchCredits(); }, [fetchCredits]);

  // ── P1-3: Watch for real on-chain confirmation ──────────
  useEffect(() => {
    if (!isSuccess || !txHash || !address || !pendingPkgRef.current) return;
    if (grantedRef.current.has(txHash)) return; // prevent double-grant
    grantedRef.current.add(txHash);

    const pkgId = pendingPkgRef.current;
    const pkg   = CREDIT_PACKAGES.find((p) => p.id === pkgId);
    if (!pkg) return;

        getAuthHeaders().then((authHeaders) => fetch('/api/credits', {
        method: 'POST',
        headers: authHeaders,
      body: JSON.stringify({ walletAddress: address, packageId: pkgId, txHash }),
    }))
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          toast.success(`${pkg.credits + pkg.bonus} credits added!`);
          fetchCredits();
        } else {
          toast.error(data.error ?? 'Credit grant failed');
        }
      })
      .catch(() => toast.error('Network error confirming credits'))
      .finally(() => {
        pendingPkgRef.current = null;
        setSelectedPkg(null);
        reset();
      });
  }, [isSuccess, txHash, address, fetchCredits, reset]);

  // Show transfer errors
  useEffect(() => {
    if (error) {
      setSelectedPkg(null);
      pendingPkgRef.current = null;
    }
  }, [error]);

  const handlePurchase = useCallback(async (pkgId: string) => {
    const pkg = CREDIT_PACKAGES.find((p) => p.id === pkgId);
    if (!pkg || !address || selectedPkg) return;

    pendingPkgRef.current = pkgId;
    setSelectedPkg(pkgId);

    await transfer({
      to: TREASURY_WALLET,
      amount: pkg.usdcAmount.toString(),
      note: `ARCTIS credit purchase — ${pkg.id}`,
    });
    // On failure, useTransfer fires error state → useEffect above clears
  }, [address, selectedPkg, transfer]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchCredits();
    setTimeout(() => setRefreshing(false), 600);
  };

  const usagePercent = creditBalance
    ? Math.round((creditBalance.used / Math.max(creditBalance.total, 1)) * 100)
    : 0;

  return (
    <div className="max-w-4xl space-y-6 safe-bottom">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1"><span className="text-surface-500 text-xs font-semibold uppercase tracking-widest">Finance</span></div>
          <h1 className="text-2xl font-bold tracking-tight text-surface-950">Credits</h1>
          <p className="text-surface-600 text-sm mt-1">AI usage credits — purchased with USDC on Arc</p>
        </div>
        <button onClick={handleRefresh} aria-label="Refresh" className={cn('btn-ghost', refreshing && 'opacity-50')}>
          <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
        </button>
      </motion.div>

      {/* Balance */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }} className="glass-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-surface-600 text-xs uppercase tracking-wider mb-2">Available Credits</div>
            <div className="text-5xl font-bold text-surface-950 font-mono">
              {creditBalance ? creditBalance.remaining.toLocaleString() : '—'}
            </div>
            {creditBalance && (
              <div className="text-surface-600 text-sm mt-1">
                {creditBalance.used.toLocaleString()} used · {creditBalance.total.toLocaleString()} total
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="text-surface-600 text-xs uppercase tracking-wider mb-1">USDC Balance</div>
            <div className="text-xl font-bold text-surface-950 font-mono">{balance}</div>
            <div className="text-surface-500 text-xs mt-1">Arc Native USDC</div>
          </div>
        </div>
        {creditBalance && creditBalance.total > 0 && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-surface-600 mb-1.5">
              <span>Usage</span><span>{usagePercent}%</span>
            </div>
            <div className="h-1.5 bg-surface-300 rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all',
                  usagePercent > 80 ? 'bg-rose-500' : 'bg-blue-500')}
                style={{ width: `${usagePercent}%` }}
              />
            </div>
          </div>
        )}
      </motion.div>

      {/* Packages */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}>
        <h2 className="text-surface-950 font-semibold mb-4">Purchase Credits</h2>
        {!isConnected ? (
          <div className="glass-card p-10 text-center">
            <Wallet className="w-10 h-10 text-surface-600 mx-auto mb-3" />
            <p className="text-surface-700 text-sm">Connect your wallet to purchase credits</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {CREDIT_PACKAGES.map((pkg) => (
              <div key={pkg.id} className={cn(
                'glass-card-hover p-5 flex flex-col gap-3 transition-all',
                pkg.label === 'Best Value' && 'border-blue-500/30 ring-1 ring-blue-500/20',
              )}>
                {pkg.label && (
                  <div className={cn('self-start px-2 py-0.5 rounded-full text-xs font-medium',
                    pkg.label === 'Best Value' ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400' :
                    pkg.label === 'Popular'    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                    'bg-surface-300/50 text-surface-600'
                  )}>
                    {pkg.label}
                  </div>
                )}
                <div>
                  <div className="text-2xl font-bold text-surface-950 font-mono">
                    {(pkg.credits + pkg.bonus).toLocaleString()}
                  </div>
                  <div className="text-surface-600 text-xs mt-0.5">
                    credits{pkg.bonus > 0 && <span className="text-emerald-600 dark:text-emerald-400"> (+{pkg.bonus} bonus)</span>}
                  </div>
                </div>
                <div className="text-surface-700 text-sm font-medium">{pkg.usdcAmount} USDC</div>
                <div className="text-surface-500 text-xs">
                  ~{((pkg.credits + pkg.bonus) / pkg.usdcAmount).toFixed(0)} credits/USDC
                </div>
                <button
                  onClick={() => handlePurchase(pkg.id)}
                  disabled={!!selectedPkg || isPending || isConfirming}
                  className={cn('mt-auto btn-primary w-full text-sm py-2',
                    selectedPkg === pkg.id && 'opacity-70'
                  )}
                >
                  {selectedPkg === pkg.id ? (
                    isPending ? 'Confirm in wallet…' :
                    isConfirming ? 'Confirming on Arc…' :
                    isSuccess ? <><CheckCircle2 className="w-3.5 h-3.5" /> Confirmed!</> :
                    'Processing…'
                  ) : (
                    <><ShoppingCart className="w-3.5 h-3.5" /> Buy for {pkg.usdcAmount} USDC</>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Credit costs */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }} className="glass-card p-6">
        <h2 className="text-surface-950 font-semibold mb-2">How Credits Work</h2>
        <p className="text-surface-600 text-sm leading-relaxed">
          ARCTIS AI uses a simple, flat rate — <span className="text-surface-950 font-medium inline-flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />{CREDITS_PER_1K_TOKENS} credit per 1,000 tokens
          </span> of conversation, no matter which ARCTIS AI feature you use. ARCTIS Copilot is always free
          and never consumes credits.
        </p>
      </motion.div>

      {/* History */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }} className="glass-card overflow-hidden">
        <div className="px-6 py-4 border-b border-black/[0.05] dark:border-white/[0.05]">
          <h2 className="text-surface-950 font-semibold">Credit History</h2>
        </div>
        {historyLoading ? (
          <SkeletonList count={4} />
        ) : history.length === 0 ? (
          <EmptyState icon={Coins} title="No credit activity yet" description="Purchases and AI usage will show up here" />
        ) : (
          <div className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
            {history.map((entry) => (
              <div key={entry.id} className="flex items-center gap-4 px-6 py-3 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                <div className={cn('w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                  entry.type === 'purchase' || entry.type === 'bonus' ? 'bg-emerald-500/10' : 'bg-rose-500/10'
                )}>
                  {entry.type === 'deduct'
                    ? <Zap className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                    : <Coins className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-surface-950 text-sm">{entry.description}</div>
                  <div className="text-surface-500 text-xs">{formatRelative(entry.createdAt)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn('font-mono font-bold text-sm',
                    entry.credits > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                  )}>
                    {entry.credits > 0 ? '+' : ''}{entry.credits.toLocaleString()}
                  </span>
                  {entry.txHash && (
                    <a href={txUrl(entry.txHash)} target="_blank" rel="noopener noreferrer"
                      className="text-surface-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
