'use client';

import { useEffect, useCallback, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Sparkles, CreditCard, Clock, RefreshCw, ExternalLink, ShieldCheck, ArrowUpRight } from 'lucide-react';
import { useAccount } from 'wagmi';
import { useTransfer } from '@/lib/hooks/useTransfer';
import { useWalletAuth } from '@/lib/auth/useWalletAuth';
import { useAppStore } from '@/lib/store';
import { MEMBERSHIP_PLANS } from '@/lib/memberships/plans';
import { cn, formatDate, txUrl } from '@/lib/utils';
import toast from 'react-hot-toast';
import type { MembershipTier, UserMembership } from '@/types';
import { TREASURY_WALLET } from '@/lib/contracts';

const TIER_STYLES: Record<MembershipTier, { border: string; badge: string; highlight: boolean }> = {
  free: { border: 'border-black/[0.06] dark:border-white/[0.06]', badge: 'bg-surface-300/50 text-surface-600', highlight: false },
  student: { border: 'border-emerald-500/20', badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', highlight: false },
  pro: { border: 'border-blue-500/30', badge: 'bg-blue-500/20 text-blue-600 dark:text-blue-400', highlight: true },
  enterprise: { border: 'border-violet-500/20', badge: 'bg-violet-500/10 text-violet-600 dark:text-violet-400', highlight: false },
};

function isMembershipActive(membership: UserMembership | null): boolean {
  if (!membership || membership.status !== 'active') return false;
  const expiry = membership.expiryDate ?? membership.renewalDate;
  return !expiry || new Date(expiry).getTime() > Date.now();
}

export default function MembershipPage() {
  const { address, isConnected } = useAccount();
  const { getAuthHeaders } = useWalletAuth();
  const { membership, setMembership } = useAppStore();
  const { transfer, isPending, isConfirming, isSuccess, txHash, error, reset } = useTransfer();
  const [purchasing, setPurchasing] = useState<MembershipTier | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [freeActivating, setFreeActivating] = useState(false);
  const pendingTierRef = useRef<MembershipTier | null>(null);
  const grantedRef = useRef<Set<string>>(new Set());

  const fetchMembership = useCallback(async () => {
    if (!address) {
      setMembership(null);
      return;
    }
    try {
      const res = await fetch(`/api/membership?wallet=${encodeURIComponent(address)}`, { cache: 'no-store' });
      const data = await res.json();
      setMembership(data.membership ?? null);
    } catch {
      toast.error('Could not load membership status');
    }
  }, [address, setMembership]);

  useEffect(() => { void fetchMembership(); }, [fetchMembership]);

  useEffect(() => {
    if (!isSuccess || !txHash || !address || !pendingTierRef.current) return;
    if (grantedRef.current.has(txHash)) return;
    grantedRef.current.add(txHash);

    const tier = pendingTierRef.current;
    const plan = MEMBERSHIP_PLANS.find((p) => p.id === tier);
    if (!plan) return;

    getAuthHeaders()
      .then((authHeaders) => fetch('/api/membership', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ walletAddress: address, tier, txHash }),
      }))
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok || !data.success) throw new Error(data.error ?? 'Membership activation failed');
        toast.success(`${plan.name} membership activated`);
        await fetchMembership();
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Membership activation failed'))
      .finally(() => {
        pendingTierRef.current = null;
        setPurchasing(null);
        reset();
      });
  }, [isSuccess, txHash, address, fetchMembership, getAuthHeaders, reset]);

  useEffect(() => {
    if (error) {
      setPurchasing(null);
      pendingTierRef.current = null;
    }
  }, [error]);

  const handleFreeActivation = useCallback(async () => {
    if (!address || freeActivating || isMembershipActive(membership)) return;
    setFreeActivating(true);
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch('/api/membership/activate-free', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ walletAddress: address }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error ?? 'Free membership activation failed');
      setMembership(data.membership);
      toast.success(data.alreadyActive ? 'Free membership is already active' : 'Free membership activated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Free membership activation failed');
    } finally {
      setFreeActivating(false);
    }
  }, [address, freeActivating, getAuthHeaders, membership, setMembership]);

  const handleSubscribe = useCallback(async (tier: MembershipTier) => {
    const plan = MEMBERSHIP_PLANS.find((p) => p.id === tier);
    if (!plan || !address || plan.priceUSDC === 0 || purchasing || freeActivating) return;

    pendingTierRef.current = tier;
    setPurchasing(tier);
    await transfer({
      to: TREASURY_WALLET,
      amount: plan.priceUSDC.toString(),
      note: `ARCTIS ${plan.name} membership`,
    });
  }, [address, purchasing, freeActivating, transfer]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchMembership();
    setTimeout(() => setRefreshing(false), 500);
  };

  const active = isMembershipActive(membership);
  const currentTier = active ? membership?.tier ?? null : null;

  return (
    <div className="max-w-5xl space-y-6 safe-bottom">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1"><span className="text-surface-500 text-xs font-semibold uppercase tracking-widest">Finance</span></div>
          <h1 className="text-2xl font-bold tracking-tight text-surface-950">Membership</h1>
          <p className="text-surface-600 text-sm mt-1">Activate and manage your ARCTIS entitlement on Arc</p>
        </div>
        <button onClick={() => void handleRefresh()} aria-label="Refresh membership" className={cn('btn-ghost', refreshing && 'opacity-50')}>
          <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
        </button>
      </motion.div>

      {!isConnected ? (
        <div className="glass-card p-8 text-center">
          <CreditCard className="w-10 h-10 text-surface-500 mx-auto mb-3" />
          <p className="text-surface-800 font-medium">Connect your wallet to activate a membership</p>
          <p className="text-surface-500 text-sm mt-1">Your membership and credit entitlement are wallet-specific.</p>
        </div>
      ) : membership ? (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5 sm:p-6 border-blue-500/15">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-surface-950 font-semibold">{membership.tier.charAt(0).toUpperCase() + membership.tier.slice(1)} Membership</span>
                  <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold', active ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400')}>
                    <span className={cn('w-1.5 h-1.5 rounded-full', active ? 'bg-emerald-500' : 'bg-amber-500')} />
                    {active ? 'ACTIVE' : 'EXPIRED'}
                  </span>
                </div>
                <p className="text-surface-600 text-xs mt-1">{membership.monthlyCredits?.toLocaleString() ?? '—'} credits per membership month</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {membership.txHash && (
                <a href={txUrl(membership.txHash)} target="_blank" rel="noopener noreferrer" className="btn-secondary text-xs py-2">
                  <ExternalLink className="w-3.5 h-3.5" /> Transaction
                </a>
              )}
              <a href="/passport" className="btn-secondary text-xs py-2">
                Passport <ArrowUpRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
            <div className="rounded-xl bg-surface-100/70 dark:bg-white/[0.03] p-3"><div className="text-[10px] uppercase tracking-wider text-surface-500">Activated</div><div className="mt-1 text-xs font-medium text-surface-900">{formatDate(membership.activationDate ?? membership.startDate)}</div></div>
            <div className="rounded-xl bg-surface-100/70 dark:bg-white/[0.03] p-3"><div className="text-[10px] uppercase tracking-wider text-surface-500">Expires</div><div className="mt-1 text-xs font-medium text-surface-900">{formatDate(membership.expiryDate ?? membership.renewalDate)}</div></div>
            <div className="rounded-xl bg-surface-100/70 dark:bg-white/[0.03] p-3"><div className="text-[10px] uppercase tracking-wider text-surface-500">Monthly credits</div><div className="mt-1 text-xs font-medium text-surface-900">{membership.monthlyCredits?.toLocaleString() ?? '—'}</div></div>
            <div className="rounded-xl bg-surface-100/70 dark:bg-white/[0.03] p-3"><div className="text-[10px] uppercase tracking-wider text-surface-500">Plan price</div><div className="mt-1 text-xs font-medium text-surface-900">{membership.priceUSDC === 0 ? 'Free' : `${membership.priceUSDC} USDC / month`}</div></div>
          </div>
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5 border-amber-500/20 bg-amber-500/[0.03]">
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div><p className="text-surface-950 font-semibold">No active membership</p><p className="text-surface-600 text-sm mt-1">Choose a plan below. Free activation creates the same entitlement record as paid plans, without a payment.</p></div>
          </div>
        </motion.div>
      )}

      <div>
        <div className="flex items-end justify-between gap-3 mb-4">
          <div><h2 className="text-surface-950 font-semibold">Choose your plan</h2><p className="text-surface-500 text-xs mt-1">Every activation has one calendar-month entitlement and the exact credit allocation shown below.</p></div>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {MEMBERSHIP_PLANS.map((plan) => {
            const style = TIER_STYLES[plan.id];
            const isCurrent = currentTier === plan.id;
            const isFree = plan.priceUSDC === 0;
            const actionLabel = isCurrent ? 'Current plan' : isFree ? 'Activate Free' : active ? `Upgrade to ${plan.name}` : `Activate ${plan.name}`;
            return (
              <motion.div key={plan.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={cn('glass-card flex flex-col gap-4 p-5 transition-all', style.border, style.highlight && 'ring-1 ring-blue-500/20')}>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className={cn('px-2.5 py-0.5 rounded-full text-xs font-medium', style.badge)}>{plan.name}</span>
                    {isCurrent && <span className="text-emerald-600 dark:text-emerald-400 text-xs font-medium flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Active</span>}
                  </div>
                  <div className="text-3xl font-bold text-surface-950 font-mono mt-3">{isFree ? 'Free' : plan.priceUSDC}<span className="text-surface-600 text-base font-normal">{isFree ? '' : ' USDC/mo'}</span></div>
                  <div className="text-surface-600 text-xs mt-1">{plan.credits.toLocaleString()} credits/month</div>
                </div>
                <ul className="space-y-2 flex-1">{plan.features.map((feature) => <li key={feature} className="flex items-start gap-2 text-sm text-surface-700"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />{feature}</li>)}</ul>
                <button
                  onClick={() => isFree ? void handleFreeActivation() : void handleSubscribe(plan.id)}
                  disabled={!isConnected || isCurrent || !!purchasing || freeActivating || isPending || isConfirming}
                  className="btn-primary w-full text-sm py-2"
                >
                  {isCurrent ? actionLabel : isFree && freeActivating ? 'Activating…' : purchasing === plan.id ? (isPending ? 'Confirm in wallet…' : isConfirming ? 'Confirming on Arc…' : 'Activating…') : actionLabel}
                </button>
              </motion.div>
            );
          })}
        </div>
      </div>

      <div className="glass-card p-5">
        <div className="flex items-start gap-3">
          <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-surface-600 text-sm leading-relaxed">
            <strong className="text-surface-950">Entitlement rule:</strong> activation starts after the verified action and expires one calendar month later. Membership credits are granted once for that activation. Replaying the same paid transaction cannot grant credits twice.
          </div>
        </div>
      </div>
    </div>
  );
}
