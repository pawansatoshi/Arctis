'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Copy, Fingerprint, ShieldCheck } from 'lucide-react';
import { useAccount } from 'wagmi';
import { formatAddress, cn } from '@/lib/utils';

interface PassportIdentity {
  username: string;
  walletAddress: string;
  displayName?: string;
  avatarUrl?: string;
  verified?: boolean;
  createdAt: string;
}

function daysSince(date: string) {
  const created = new Date(date).getTime();
  if (!Number.isFinite(created)) return 0;
  return Math.max(0, Math.floor((Date.now() - created) / 86_400_000));
}

function DefaultAvatar({ label }: { label: string }) {
  return (
    <div className="relative w-full h-full overflow-hidden rounded-[1.35rem] bg-gradient-to-br from-slate-950 via-blue-900 to-violet-900 flex items-center justify-center">
      <div className="absolute inset-0 opacity-40" style={{ background: 'radial-gradient(circle at 30% 20%, rgba(96,165,250,.7), transparent 42%), radial-gradient(circle at 75% 80%, rgba(167,139,250,.55), transparent 45%)' }} />
      <div className="relative w-16 h-16 rounded-2xl border border-white/20 bg-white/10 backdrop-blur flex items-center justify-center shadow-2xl">
        <span className="text-2xl font-black tracking-tight text-white">{label.charAt(0).toUpperCase()}</span>
      </div>
      <div className="absolute bottom-3 left-0 right-0 text-center text-[8px] font-bold tracking-[0.28em] text-white/60">ARCTIS</div>
    </div>
  );
}

export default function PassportIdentityCard() {
  const { address } = useAccount();
  const [passport, setPassport] = useState<PassportIdentity | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!address) {
      setPassport(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/passport/by-wallet?walletAddress=${address}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: PassportIdentity | null) => {
        if (!cancelled) setPassport(data);
      })
      .catch(() => {
        if (!cancelled) setPassport(null);
      });
    return () => { cancelled = true; };
  }, [address]);

  const age = useMemo(() => passport ? daysSince(passport.createdAt) : 0, [passport]);
  if (!address || !passport) return null;

  const name = passport.displayName?.trim() || passport.username;
  const passportId = `${passport.username}.arc`;
  const minted = new Date(passport.createdAt);
  const mintedLabel = Number.isNaN(minted.getTime())
    ? '—'
    : minted.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });

  async function copyId() {
    try {
      await navigator.clipboard.writeText(passportId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {}
  }

  return (
    <section className="relative overflow-hidden rounded-[1.6rem] border border-black/[0.08] dark:border-white/[0.10] bg-white/70 dark:bg-white/[0.035] shadow-[0_18px_60px_rgba(15,23,42,0.10)] backdrop-blur-xl">
      <div className="absolute -top-24 -right-20 w-64 h-64 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(59,130,246,.16), transparent 68%)' }} />
      <div className="absolute -bottom-28 -left-20 w-64 h-64 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(139,92,246,.12), transparent 68%)' }} />

      <div className="relative p-5 sm:p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/15 flex items-center justify-center">
              <Fingerprint className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-surface-950 text-xs font-bold uppercase tracking-[0.16em]">Passport Identity</p>
              <p className="text-surface-500 text-[10px]">Your human identity on ARCTIS</p>
            </div>
          </div>
          {passport.verified && (
            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-[10px] font-semibold">
              <ShieldCheck className="w-3 h-3" /> Verified
            </span>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-5 items-start">
          <div className="w-28 h-28 sm:w-32 sm:h-32 shrink-0 rounded-[1.45rem] p-[2px] bg-gradient-to-br from-blue-500/50 via-violet-500/30 to-transparent shadow-xl">
            {passport.avatarUrl ? (
              <img src={passport.avatarUrl} alt="" className="w-full h-full object-cover rounded-[1.35rem]" />
            ) : (
              <DefaultAvatar label={name} />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-xl sm:text-2xl font-bold text-surface-950 tracking-tight truncate">{name}</h2>
              {passport.verified && <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />}
            </div>

            <button onClick={copyId} className="group flex items-center gap-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors">
              <span className="font-mono text-sm font-semibold">{passportId}</span>
              <Copy className="w-3 h-3 opacity-50 group-hover:opacity-100" />
              {copied && <span className="text-[10px] text-emerald-600 dark:text-emerald-400">Copied</span>}
            </button>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="rounded-xl bg-black/[0.025] dark:bg-white/[0.035] border border-black/[0.05] dark:border-white/[0.06] px-3 py-2.5">
                <p className="text-[9px] uppercase tracking-wider text-surface-500 mb-1">Wallet</p>
                <p className="font-mono text-[11px] font-semibold text-surface-800 dark:text-surface-200 truncate">{formatAddress(passport.walletAddress, 6)}</p>
              </div>
              <div className="rounded-xl bg-black/[0.025] dark:bg-white/[0.035] border border-black/[0.05] dark:border-white/[0.06] px-3 py-2.5">
                <p className="text-[9px] uppercase tracking-wider text-surface-500 mb-1">Minted</p>
                <p className="text-[11px] font-semibold text-surface-800 dark:text-surface-200">{mintedLabel}</p>
              </div>
              <div className="rounded-xl bg-black/[0.025] dark:bg-white/[0.035] border border-black/[0.05] dark:border-white/[0.06] px-3 py-2.5">
                <p className="text-[9px] uppercase tracking-wider text-surface-500 mb-1">Passport age</p>
                <p className="text-[11px] font-semibold text-surface-800 dark:text-surface-200">{age} {age === 1 ? 'day' : 'days'}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-black/[0.06] dark:border-white/[0.07] flex items-center justify-between gap-3">
          <p className="text-[10px] text-surface-500">Identity profile · wallet-bound · persistent</p>
          <span className={cn('text-[10px] font-semibold', passport.verified ? 'text-emerald-600 dark:text-emerald-400' : 'text-surface-500')}>
            {passport.verified ? 'Verified identity' : 'Unverified identity'}
          </span>
        </div>
      </div>
    </section>
  );
}
