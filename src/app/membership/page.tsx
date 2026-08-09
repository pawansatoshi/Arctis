'use client';

import { useEffect, useCallback, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Sparkles, Zap, CreditCard, Clock, RefreshCw, ExternalLink } from 'lucide-react';
import { useAccount } from 'wagmi';
import { useTransfer } from '@/lib/hooks/useTransfer';
import { useAppStore } from '@/lib/store';
import { MEMBERSHIP_PLANS } from '@/lib/memberships/plans';
import { cn, formatDate, txUrl } from '@/lib/utils';
import toast from 'react-hot-toast';
import type { MembershipTier } from '@/types';
import { TREASURY_WALLET } from '@/lib/contracts';

const TIER_STYLES: Record<MembershipTier, { border: string; badge: string; highlight: boolean }> = {
  free:       { border: 'border-black/[0.06] dark:border-white/[0.06]',   badge: 'bg-surface-300/50 text-surface-600', highlight: false },
  student:    { border: 'border-emerald-500/20', badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', highlight: false },
  pro:        { border: 'border-blue-500/30',    badge: 'bg-blue-500/20 text-blue-600 dark:text-blue-400',       highlight: true  },
  enterprise: { border: 'border-violet-500/20', badge: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',   highlight: false },
};

export default function MembershipPage() {
  const { address, isConnected } = useAccount();
  const { membership, setMembership } = useAppStore();
  const { transfer, isPending, isConfirming, isSuccess, txHash, error, reset } = useTransfer();
  const [purchasing, setPurchasing] = useState<MembershipTier | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const pendingTierRef = useRef<MembershipTier | null>(null);
  const grantedRef     = useRef<Set<string>>(new Set());

  const fetchMembership = useCallback(async () => {
    if (!address) return;
    try {
      const res = await fetch(`/api/membership?wallet=${address}`);
      const data = await res.json();
      if (data.membership) setMembership(data.membership);
    } catch {}
  }, [address, setMembership]);

  useEffect(() => { fetchMembership(); }, [fetchMembership]);

  // ── P1-4: Watch real on-chain confirmation ─────────────
  useEffect(() => {
    if (!isSuccess || !txHash || !address || !pendingTierRef.current) return;
    if (grantedRef.current.has(txHash)) return;
    grantedRef.current.add(txHash);

    const tier = pendingTierRef.current;
    const plan = MEMBERSHIP_PLANS.find((p) => p.id === tier)!;

    fetch('/api/membership', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress: address, tier, txHash }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          toast.success(`${plan.name} membership activated!`);
          fetchMembership();
        } else {
          toast.error(data.error ?? 'Membership activation failed');
        }
      })
      .catch(() => toast.error('Network error activating membership'))
      .finally(() => {
        pendingTierRef.current = null;
        setPurchasing(null);
        reset();
      });
  }, [isSuccess, txHash, address, fetchMembership, reset]);

  useEffect(() => {
    if (error) { setPurchasing(null); pendingTierRef.current = null; }
  }, [error]);

  const handleSubscribe = useCallback(async (tier: MembershipTier) => {
    const plan = MEMBERSHIP_PLANS.find((p) => p.id === tier);
    if (!plan || !address || plan.priceUSDC === 0 || purchasing) return;

    pendingTierRef.current = tier;
    setPurchasing(tier);

    await transfer({
      to: TREASURY_WALLET,
      amount: plan.priceUSDC.toString(),
      note: `ARCTIS ${plan.name} membership`,
    });
  }, [address, purchasing, transfer]);

  const currentTier = membership?.tier ?? 'free';

  return (
    <div className="max-w-5xl space-y-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1"><span className="text-surface-500 text-xs font-semibold uppercase tracking-widest">Platform</span></div>
          <h1 className="text-2xl font-bold tracking-tight text-surface-950">Membership</h1>
          <p className="text-surface-600 text-sm mt-1">USDC subscriptions — verified on Arc chain</p>
        </div>
        <button onClick={() => { setRefreshing(true); fetchMembership().finally(() => setRefreshing(false)); }}
          className={cn('btn-ghost', refreshing && 'opacity-50')}>
          <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
        </button>
      </motion.div>

      {/* Current status */}
      {membership && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }} className="glass-card p-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <div className="text-surface-950 font-semibold">
                  {membership.tier.charAt(0).toUpperCase() + membership.tier.slice(1)} Plan
                </div>
                <div className="text-surface-600 text-xs flex items-center gap-2 mt-0.5">
                  <span className={cn('status-dot',
                    membership.status === 'active' ? 'status-dot-online' : 'status-dot-offline'
                  )} />
                  {membership.status}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {membership.txHash && (
                <a href={txUrl(membership.txHash)} target="_blank" rel="noopener noreferrer"
                  className="text-surface-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
              <div className="text-right">
                <div className="text-surface-600 text-xs">Renews</div>
                <div className="text-surface-950 text-sm font-medium flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-surface-600" />
                  {formatDate(membership.renewalDate)}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Plans */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {MEMBERSHIP_PLANS.map((plan) => {
          const style = TIER_STYLES[plan.id];
          const isCurrent = currentTier === plan.id;
          return (
            <div key={plan.id} className={cn(
              'glass-card flex flex-col gap-4 p-5 transition-all',
              style.border, style.highlight && 'ring-1 ring-blue-500/20',
            )}>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className={cn('px-2.5 py-0.5 rounded-full text-xs font-medium', style.badge)}>
                    {plan.name}
                  </span>
                  {isCurrent && (
                    <span className="text-emerald-600 dark:text-emerald-400 text-xs font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Active
                    </span>
                  )}
                </div>
                <div className="text-3xl font-bold text-surface-950 font-mono mt-3">
                  {plan.priceUSDC === 0 ? 'Free' : `${plan.priceUSDC}`}
                  {plan.priceUSDC > 0 && <span className="text-surface-600 text-base font-normal"> USDC/mo</span>}
                </div>
                <div className="text-surface-600 text-xs mt-1 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                  {plan.credits.toLocaleString()} credits/month
                </div>
              </div>
              <ul className="space-y-2 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-surface-700">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              {isCurrent ? (
                <div className="w-full py-2 rounded-xl text-center text-sm text-surface-600 border border-black/[0.06] dark:border-white/[0.06]">
                  Current plan
                </div>
              ) : plan.priceUSDC === 0 ? (
                <div className="w-full py-2 rounded-xl text-center text-sm text-surface-600 border border-black/[0.06] dark:border-white/[0.06]">
                  Free forever
                </div>
              ) : (
                <button
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={!isConnected || !!purchasing || isPending || isConfirming}
                  className="btn-primary w-full text-sm py-2"
                >
                  {purchasing === plan.id
                    ? (isPending ? 'Confirm…' : isConfirming ? 'Confirming on Arc…' : 'Processing…')
                    : <><Sparkles className="w-3.5 h-3.5" /> Subscribe {plan.priceUSDC} USDC/mo</>
                  }
                </button>
              )}
            </div>
          );
        })}
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }} className="glass-card p-5">
        <div className="flex items-start gap-3">
          <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <p className="text-surface-600 text-sm leading-relaxed">
            All subscriptions are paid in <strong className="text-surface-950">Arc Native USDC</strong> and verified on-chain before activation.
            Credits are granted after blockchain confirmation. Cancel anytime — no refunds for current period.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
