'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccount } from 'wagmi';
import { useRouter } from 'next/navigation';
import { Loader2, Wallet, Sparkles, XCircle, CheckCircle2, X as XIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { USERNAME_MIN_LENGTH, USERNAME_MAX_LENGTH, validateUsername } from '@/lib/passport/types';
import { useWalletAuth } from '@/lib/auth/useWalletAuth';
import { PassportCard } from '@/components/passport/PassportCard';
import toast from 'react-hot-toast';

interface OwnedPassport { username: string; walletAddress: string; displayName?: string; bio?: string; }
type AvailabilityState = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

export default function PassportPage() {
  const { isConnected, address } = useAccount();
  const { getAuthHeaders } = useWalletAuth();
  const router = useRouter();

  const [loadingExisting, setLoadingExisting] = useState(true);
  const [owned, setOwned] = useState<OwnedPassport | null>(null);
  const [editing, setEditing] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [availability, setAvailability] = useState<AvailabilityState>('idle');
  const [availabilityMsg, setAvailabilityMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isConnected || !address) { setLoadingExisting(false); return; }
    setLoadingExisting(true);
    fetch(`/api/passport/by-wallet?walletAddress=${address}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) setOwned(data); })
      .catch(() => {}).finally(() => setLoadingExisting(false));
  }, [isConnected, address]);

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
    return <div className="page-container max-w-sm flex items-center justify-center min-h-[60vh]"><Loader2 className="w-6 h-6 text-surface-500 animate-spin" /></div>;
  }

  if (owned) {
    return (
      <div className="page-container max-w-sm">
        <PassportCard username={owned.username} walletAddress={owned.walletAddress} displayName={owned.displayName} bio={owned.bio} isOwner
          onSend={() => router.push(`/transfer?to=${owned.username}`)}
          onEdit={() => { setEditDisplayName(owned.displayName ?? ''); setEditBio(owned.bio ?? ''); setEditing(true); }} />
        <AnimatePresence>
          {editing && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }} className="mt-4 glass-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-surface-950 font-semibold text-sm">Edit Profile</h3>
                <button onClick={() => setEditing(false)} className="btn-ghost px-2 py-1"><XIcon className="w-4 h-4" /></button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-surface-600 text-xs uppercase tracking-wider block mb-1.5">Display Name</label>
                  <input type="text" value={editDisplayName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditDisplayName(e.target.value)} placeholder="Your name" maxLength={50} className="input-field" />
                </div>
                <div>
                  <label className="text-surface-600 text-xs uppercase tracking-wider block mb-1.5">Bio</label>
                  <textarea value={editBio} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditBio(e.target.value)} placeholder="A short bio" maxLength={200} rows={3} className="input-field resize-none" />
                  <p className="text-surface-500 text-[10px] text-right mt-1">{editBio.length}/200</p>
                </div>
              </div>
              <button onClick={handleSaveEdit} disabled={savingEdit} className="btn-primary w-full justify-center disabled:opacity-40">
                {savingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="page-container max-w-sm">
      <div className="mb-7">
        <div className="flex items-center gap-2 mb-1"><span className="text-surface-500 text-xs font-semibold uppercase tracking-widest">Identity Layer</span></div>
        <h1 className="text-2xl font-bold text-surface-950 tracking-tight">Claim your Passport</h1>
        <p className="text-surface-600 text-sm mt-1">Your Web3 identity on Arc · <span className="font-mono text-surface-700">username.arc</span></p>
      </div>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
        <div className="glass-card p-4 space-y-2">
          <label className="text-surface-600 text-xs uppercase tracking-wider">Username</label>
          <div className="relative">
            <input type="text" value={username} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              placeholder="yourname" maxLength={USERNAME_MAX_LENGTH} className="input-field pr-14" />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-surface-500 text-sm pointer-events-none">.arc</span>
          </div>
          {username.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs">
              {availability === 'checking' && <Loader2 className="w-3 h-3 animate-spin text-surface-500" />}
              {availability === 'available' && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
              {(availability === 'taken' || availability === 'invalid') && <XCircle className="w-3 h-3 text-rose-400" />}
              <span className={cn(availability === 'available' && 'text-emerald-400', (availability === 'taken' || availability === 'invalid') && 'text-rose-400', availability === 'checking' && 'text-surface-500')}>
                {availability === 'checking' && 'Checking…'}
                {availability === 'available' && `${username}.arc is available`}
                {(availability === 'taken' || availability === 'invalid') && availabilityMsg}
              </span>
            </div>
          )}
          <p className="text-surface-500 text-[10px]">{USERNAME_MIN_LENGTH}–{USERNAME_MAX_LENGTH} chars · lowercase letters, numbers, underscores only</p>
        </div>
        <div className="glass-card p-4 space-y-2">
          <label className="text-surface-600 text-xs uppercase tracking-wider">Display Name <span className="normal-case text-surface-500">(optional)</span></label>
          <input type="text" value={displayName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDisplayName(e.target.value)} placeholder="Your name" maxLength={50} className="input-field" />
        </div>
        {availability === 'available' && username && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-3 flex items-center gap-3 border-emerald-500/20 bg-emerald-500/5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <p className="text-surface-600 text-xs"><span className="text-surface-950 font-medium">{username}.arc</span> is yours to claim.</p>
          </motion.div>
        )}
        <button onClick={handleClaim} disabled={availability !== 'available' || submitting}
          className="btn-primary w-full justify-center text-base py-3.5 disabled:opacity-40 disabled:cursor-not-allowed">
          {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Claiming…</> : <><Sparkles className="w-4 h-4" /> Claim Passport</>}
        </button>
        <p className="text-center text-surface-500 text-[11px]">One Passport per wallet · First-come-first-served</p>
      </motion.div>
    </div>
  );
}
