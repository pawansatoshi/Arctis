'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Copy, Check, ArrowUpRight, Globe, Share2, QrCode, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

interface PassportCardProps {
  username: string;
  walletAddress: string;
  displayName?: string;
  bio?: string;
  verified?: boolean;
  isOwner?: boolean;
  onSend?: () => void;
  onEdit?: () => void;
}

function getUsernameColour(username: string): { from: string; to: string } {
  let hash = 0;
  for (let i = 0; i < username.length; i++) hash = username.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return { from: `hsl(${hue}, 70%, 45%)`, to: `hsl(${(hue + 40) % 360}, 80%, 35%)` };
}

function InitialsAvatar({ username }: { username: string }) {
  const { from, to } = getUsernameColour(username);
  return (
    <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-white text-3xl font-bold shadow-lg ring-2 ring-white/10"
      style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}>
      {username.charAt(0).toUpperCase()}
    </div>
  );
}

function shortenAddress(address: string, chars = 6): string {
  return `${address.slice(0, chars + 2)}…${address.slice(-chars)}`;
}

function QRPlaceholder({ username }: { username: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="w-28 h-28 rounded-xl border border-white/[0.08] bg-white/[0.03] flex flex-col items-center justify-center gap-1.5">
        <QrCode className="w-8 h-8 text-surface-600" />
        <span className="text-surface-600 text-[10px] text-center leading-tight px-2">QR coming soon</span>
      </div>
      <span className="text-surface-500 text-[10px] font-mono">/p/{username}</span>
    </div>
  );
}

export function PassportCard({ username, walletAddress, displayName, bio, verified = false, isOwner = false, onSend, onEdit }: PassportCardProps) {
  const [copiedAddr, setCopiedAddr] = useState(false);
  const [copiedHandle, setCopiedHandle] = useState(false);

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(walletAddress);
    setCopiedAddr(true); toast.success('Address copied'); setTimeout(() => setCopiedAddr(false), 2000);
  };
  const handleCopyHandle = () => {
    navigator.clipboard.writeText(`${username}.arc`);
    setCopiedHandle(true); toast.success('Handle copied'); setTimeout(() => setCopiedHandle(false), 2000);
  };
  const handleShare = () => {
    const url = `${window.location.origin}/p/${username}`;
    if (navigator.share) navigator.share({ title: `${username}.arc`, url }).catch(() => {});
    else { navigator.clipboard.writeText(url); toast.success('Profile link copied'); }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="w-full max-w-sm mx-auto">
      <div className="rounded-3xl overflow-hidden shadow-2xl border border-white/[0.07]">
        <div className="relative h-28 flex items-end px-5 pb-0"
          style={{ background: 'linear-gradient(135deg, #0ea5e9 0%, #3b82f6 55%, #8b5cf6 100%)' }}>
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.3) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.2) 0%, transparent 40%)' }} />
          <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-black/30 backdrop-blur-sm px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-white text-[10px] font-medium tracking-wide">Arc Testnet</span>
          </div>
          <div className="absolute top-4 left-5 text-white/70 text-[11px] font-bold tracking-[0.2em] uppercase">ARCTIS</div>
          <div className="relative z-10 mb-[-2.5rem]">
            <InitialsAvatar username={username} />
            {verified && (
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-surface-200 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-blue-500" />
              </div>
            )}
          </div>
        </div>

        <div className="bg-surface-200 px-5 pt-12 pb-5 space-y-4">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <h2 className="text-surface-950 text-xl font-bold tracking-tight">{username}</h2>
              <span className="text-surface-500 text-sm font-mono">.arc</span>
              {isOwner && <span className="ml-auto text-[10px] bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded-full font-medium">Your Passport</span>}
            </div>
            {displayName && <p className="text-surface-700 text-sm">{displayName}</p>}
            {bio && <p className="text-surface-600 text-xs leading-relaxed pt-1">{bio}</p>}
          </div>

          <div className="space-y-1.5">
            <button onClick={handleCopyAddress} className="w-full flex items-center justify-between bg-surface-300/50 hover:bg-surface-300 rounded-xl px-3.5 py-2.5 transition-colors group">
              <div className="flex items-center gap-2"><Globe className="w-3.5 h-3.5 text-surface-600" /><span className="text-surface-700 text-xs font-mono">{shortenAddress(walletAddress)}</span></div>
              {copiedAddr ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-surface-500 group-hover:text-surface-700 transition-colors" />}
            </button>
            <button onClick={handleCopyHandle} className="w-full flex items-center justify-between bg-surface-300/50 hover:bg-surface-300 rounded-xl px-3.5 py-2.5 transition-colors group">
              <div className="flex items-center gap-2"><Zap className="w-3.5 h-3.5 text-blue-500" /><span className="text-surface-700 text-xs font-mono">{username}.arc</span></div>
              {copiedHandle ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-surface-500 group-hover:text-surface-700 transition-colors" />}
            </button>
          </div>

          <div className="flex justify-center py-1"><QRPlaceholder username={username} /></div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button onClick={onSend} className="flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-semibold bg-blue-500 hover:bg-blue-400 text-white shadow-lg shadow-blue-500/20 transition-all">
              <ArrowUpRight className="w-4 h-4" />Send
            </button>
            <button onClick={handleShare} className="flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-semibold bg-surface-300 hover:bg-surface-400 text-surface-950 transition-all">
              <Share2 className="w-4 h-4" />Share
            </button>
          </div>

          {isOwner && onEdit && (
            <button onClick={onEdit} className="w-full py-2.5 rounded-xl text-surface-600 hover:text-surface-800 text-xs font-medium transition-colors hover:bg-surface-300/50">
              Edit Profile
            </button>
          )}
        </div>
      </div>
      <div className="flex items-center justify-center gap-4 mt-4">
        <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /><span className="text-surface-600 text-xs">Arc Testnet · Chain 5042002</span></div>
      </div>
    </motion.div>
  );
}
