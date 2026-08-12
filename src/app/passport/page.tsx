'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccount } from 'wagmi';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Wallet, Sparkles, XCircle, CheckCircle2, X as XIcon, ShieldCheck, CreditCard, CalendarDays, ArrowUpRight, Zap } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { USERNAME_MIN_LENGTH, USERNAME_MAX_LENGTH, validateUsername } from '@/lib/passport/types';
import { useWalletAuth } from '@/lib/auth/useWalletAuth';
import { PassportCard } from '@/components/passport/PassportCard';
import toast from 'react-hot-toast';
import type { CreditBalance, UserMembership } from '@/types';

interface OwnedPassport { username: string; walletAddress: string; displayName?: string; bio?: string; }
type AvailabilityState = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

function membershipIsActive(membership: UserMembership | null): boolean {
  if (!membership || membership.status !== 'active') return false;
  const expiry = membership.expiryDate ?? membership.renewalDate;
  return !expiry || new Date(expiry).getTime() > Date.now();
}

export default function PassportPage() {
  const { isConnected, address } = useAccount();
  const { getAuthHeaders } = useWalletAuth();
  const router = useRouter();

  const [loadingExisting, setLoadingExisting] = useState(true);
  const [owned, setOwned] = useState<OwnedPassport | null>(null);
  const [membership, setMembership] = useState<UserMembership | null>(null);
  const [credits, setCredits] = useState<CreditBalance | null>(null);
  const [entitlementsLoading, setEntitlementsLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [availability, setAvailability] = useState<AvailabilityState>('idle');
  const [availabilityMsg, setAvailabilityMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadEntitlements = useCallback(async (wallet: string) => {
    setEntitlementsLoading(true);
    try {
      const [membershipResponse, creditsResponse] = await Promise.all([
        fetch(`/api/membership?wallet=${encodeURIComponent(wallet)}`, { cache: 'no-store' }),
        fetch(`/api/credits?wallet=${encodeURIComponent(wallet)}`, { cache: 'no-store' }),
      ]);
      const membershipData = await membershipResponse.json();
      const creditsData = await creditsResponse.json();
      setMembership(membershipData.membership ?? null);
      setCredits(creditsData.balance ?? null);
    } catch {
      setMembership(null);
      setCredits(null);
    } finally {
      setEntitlementsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setOwned(null);
    setMembership(null);
    setCredits(null);

    if (!isConnected || !address) {
      setLoadingExisting(false);
      return;
    }

    setLoadingExisting(true);
    fetch(`/api/passport/by-wallet?walletAddress=${encodeURIComponent(address)}`, { cache: 'no-store' })
      .then(async (r) => {
        if (r.status === 404) return null;
        if (!r.ok) throw new Error('Passport lookup failed');
        return r.json();
      })
      .then((data) => {
        if (!cancelled) setOwned(data);
      })
      .catch(() => {
        if (!cancelled) {
          setOwned(null);
          toast.error('Could not check for an existing Passport');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingExisting(false);
      });

    void loadEntitlements(address);
    return () => { cancelled = true; };
  }, [isConnected, address, loadEntitlements]);

  useEffect(() => {
    if (!username) { setAvailability('idle'); setAvailabilityMsg(null); return; }
    const check = validateUsername(username);
    if (!check.valid) { setAvailability('invalid'); setAvailabilityMsg(check.reason ?? null); return; }
    setAvailability('checking');
    const t = setTimeout(() => {
      fetch(`/api/passport/resolve?username=${encodeURIComponent(username.toLowerCase())}`)
        .then((r) => { setAvailability(r.status === 404 ? 'available' : 'taken'); setAvailabilityMsg(r.status === 404 ? null : 'This username is already claimed'); })
        .catch(() => setAvailability('idle'));
    }, 400);
    return () => clearTimeout(t);
  }, [username]);

  const handleClaim = useCallback(async () => {
    if (!address || availability !== 'available') return;
    setSubmitting(true);
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch('/api/passport/create', {
        method: 'POST', headers: authHeaders,
        body: JSON.stringify({ username: username.toLowerCase(), displayName: displayName.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409 && data.existingUsername) { setOwned({ username: data.existingUsername, walletAddress: address }); toast.error('This wallet already has a Passport'); }
        else toast.error(data.error ?? 'Failed to claim Passport');
        return;
      }
      setOwned({ username: data.username, walletAddress: data.walletAddress, displayName: data.displayName });
      toast.success(`${data.passportHandle} claimed!`);
    } catch (err) { toast.error((err as Error).message); }
    finally { setSubmitting(false); }
  }, [address, availability, username, displayName, getAuthHeaders]);

  const handleSaveEdit = async () => {
    if (!owned || !address) return;
    if (editBio.length > 200) { toast.error('Bio must be 200 characters or fewer'); return; }
    setSavingEdit(true);
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch('/api/passport/update', {
        method: 'PATCH', headers: authHeaders,
        body: JSON.stringify({ username: owned.username, displayName: editDisplayName.trim(), bio: editBio.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Failed to update profile'); return; }
      setOwned({ ...owned, displayName: data.displayName, bio: data.bio });
      setEditing(false); toast.success('Profile updated');
    } catch (err) { toast.error((err as Error).message); }
    finally { setSavingEdit(false); }
  };

  if (!isConnected) {
    return (
      <div className="page-container max-w-sm flex items-center justify-center min-h-[60vh]">
        <div className="glass-card p-8 text-center space-y-3 w-full">
          <Wallet className="w-8 h-8 text-surface-600 mx-auto" />
          <p className="text-surface-700 text-sm">Connect your wallet to access your Passport</p>
        </div>
      </div>
    );
  }

  if (loadingExisting) {
    return (
      <div className="page-container max-w-sm flex items-center justify-center min-h-[60vh]">
        <div className="glass-card p-8 flex items-center justify-center w-full"><Loader2 className="w-6 h-6 text-surface-500 animate-spin" /></div>
      </div>
    );
  }

  if (owned) {
    const activeMembership = membershipIsActive(membership);
    return (
      <div className="page-container max-w-2xl safe-bottom space-y-4">
        <PassportCard
          username={owned.username}
          walletAddress={owned.walletAddress}
          displayName={owned.displayName}
          bio={owned.bio}
          isOwner
          onSend={() => router.push(`/transfer?to=${owned.username}`)}
          onEdit={() => { setEditDisplayName(owned.displayName ?? ''); setEditBio(owned.bio ?? ''); setEditing(true); }}
        />

        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div><p className="text-[10px] uppercase tracking-widest text-surface-500 font-semibold">Account Entitlements</p><h2 className="text-lg font-bold text-surface-950 mt-1">Membership & Credits</h2></div>
            <Link href="/membership" className="btn-secondary text-xs py-2">Manage</Link>
          </div>

          {entitlementsLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 text-surface-500 animate-spin" /></div>
          ) : (
            <>
              <div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-surface-100/60 dark:bg-white/[0.02] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center"><ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" /></div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-surface-950">{membership ? `${membership.tier.charAt(0).toUpperCase()}${membership.tier.slice(1)} Membership` : 'No Membership'}</span>
                        {membership && <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-semibold', activeMembership ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400')}>{activeMembership ? 'ACTIVE' : 'EXPIRED'}</span>}
                      </div>
                      {membership && <p className="text-surface-600 text-xs mt-1">{membership.monthlyCredits?.toLocaleString() ?? '—'} credits per month · {membership.priceUSDC === 0 ? 'Free' : `${membership.priceUSDC} USDC/month`}</p>}
                    </div>
                  </div>
                  {!activeMembership && <Link href="/membership" className="btn-primary text-xs py-2 whitespace-nowrap">Activate</Link>}
                </div>
                {membership && (
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <div><div className="text-[10px] uppercase tracking-wider text-surface-500 flex items-center gap-1"><CalendarDays className="w-3 h-3" /> Activated</div><div className="mt-1 text-xs font-medium text-surface-900">{formatDate(membership.activationDate ?? membership.startDate)}</div></div>
                    <div><div className="text-[10px] uppercase tracking-wider text-surface-500 flex items-center gap-1"><CalendarDays className="w-3 h-3" /> Expires</div><div className="mt-1 text-xs font-medium text-surface-900">{formatDate(membership.expiryDate ?? membership.renewalDate)}</div></div>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.06] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3"><div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center"><Zap className="w-5 h-5 text-amber-600 dark:text-amber-400" /></div><div><div className="text-xs uppercase tracking-wider text-surface-500">Available credits</div><div className="text-2xl font-bold font-mono text-surface-950 mt-1">{credits ? credits.remaining.toLocaleString() : '—'}</div></div></div>
                  <Link href="/credits" className="btn-primary text-xs py-2 whitespace-nowrap"><CreditCard className="w-3.5 h-3.5" /> Top Up</Link>
                </div>
                {credits && credits.total > 0 && (
                  <div className="mt-4"><div className="flex justify-between text-[10px] text-surface-500 mb-1.5"><span>{credits.used.toLocaleString()} used</span><span>{Math.round((credits.used / Math.max(credits.total, 1)) * 100)}%</span></div><div className="h-1.5 rounded-full bg-surface-300 overflow-hidden"><div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(100, Math.max(0, (credits.used / Math.max(credits.total, 1)) * 100))}%` }} /></div><div className="text-[10px] text-surface-500 mt-2">{credits.total.toLocaleString()} total credits in the current ledger</div></div>
                )}
              </div>

              <div className="flex items-center justify-between gap-3 text-xs text-surface-500"><span>Passport is the summary layer for your identity and entitlements.</span><Link href="/credits" className="text-blue-600 dark:text-blue-400 font-medium inline-flex items-center gap-1">Credit history <ArrowUpRight className="w-3 h-3" /></Link></div>
            </>
          )}
        </motion.section>

        <AnimatePresence>
          {editing && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }} className="glass-card p-5 space-y-4">
              <div className="flex items-center justify-between"><h3 className="text-surface-950 font-semibold text-sm">Edit Profile</h3><button onClick={() => setEditing(false)} aria-label="Cancel editing" className="btn-ghost px-2 py-1"><XIcon className="w-4 h-4" /></button></div>
              <div className="space-y-3">
                <div><label className="text-surface-600 text-xs uppercase tracking-wider block mb-1.5">Display Name</label><input type="text" value={editDisplayName} onChange={(e) => setEditDisplayName(e.target.value)} placeholder="Your name" maxLength={50} className="input-field" /></div>
                <div><label className="text-surface-600 text-xs uppercase tracking-wider block mb-1.5">Bio</label><textarea value={editBio} onChange={(e) => setEditBio(e.target.value)} placeholder="A short bio" maxLength={200} rows={3} className="input-field resize-none" /><p className="text-surface-500 text-[10px] text-right mt-1">{editBio.length}/200</p></div>
              </div>
              <button onClick={() => void handleSaveEdit()} disabled={savingEdit} className="btn-primary w-full justify-center disabled:opacity-40">{savingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}</button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="page-container max-w-sm safe-bottom">
      <div className="mb-7"><div className="flex items-center gap-2 mb-1"><span className="text-surface-500 text-xs font-semibold uppercase tracking-widest">Identity Layer</span></div><h1 className="text-2xl font-bold text-surface-950 tracking-tight">Claim your Passport</h1><p className="text-surface-600 text-sm mt-1">Your Web3 identity on Arc · <span className="font-mono text-surface-700">username.arc</span></p></div>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        <div className="glass-card p-5 space-y-2.5"><label className="text-surface-600 text-xs font-medium uppercase tracking-wider">Username</label><div className="relative"><input type="text" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} placeholder="yourname" maxLength={USERNAME_MAX_LENGTH} className="input-field pr-14" /><span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-surface-500 text-sm pointer-events-none">.arc</span></div>{username.length > 0 && <div className="flex items-center gap-1.5 text-xs">{availability === 'checking' && <Loader2 className="w-3 h-3 animate-spin text-surface-500" />}{availability === 'available' && <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />}{(availability === 'taken' || availability === 'invalid') && <XCircle className="w-3 h-3 text-rose-600 dark:text-rose-400" />}<span className={cn(availability === 'available' && 'text-emerald-600 dark:text-emerald-400', (availability === 'taken' || availability === 'invalid') && 'text-rose-600 dark:text-rose-400', availability === 'checking' && 'text-surface-500')}>{availability === 'checking' && 'Checking…'}{availability === 'available' && `${username}.arc is available`}{(availability === 'taken' || availability === 'invalid') && availabilityMsg}</span></div>}<p className="text-surface-500 text-[10px]">{USERNAME_MIN_LENGTH}–{USERNAME_MAX_LENGTH} chars · lowercase letters, numbers, underscores only</p></div>
        <div className="glass-card p-5 space-y-2.5"><label className="text-surface-600 text-xs font-medium uppercase tracking-wider">Display Name <span className="normal-case text-surface-500">(optional)</span></label><input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" maxLength={50} className="input-field" /></div>
        {availability === 'available' && username && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-3 flex items-center gap-3 border-emerald-500/20 bg-emerald-500/5"><CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" /><p className="text-surface-600 text-xs"><span className="text-surface-950 font-medium">{username}.arc</span> is yours to claim.</p></motion.div>}
        <button onClick={() => void handleClaim()} disabled={availability !== 'available' || submitting} className="btn-primary w-full justify-center text-base py-3.5 disabled:opacity-40 disabled:cursor-not-allowed">{submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Claiming…</> : <><Sparkles className="w-4 h-4" /> Claim Passport</>}</button>
        <p className="text-center text-surface-500 text-[11px]">One Passport per wallet · First-come-first-served</p>
      </motion.div>
    </div>
  );
}
