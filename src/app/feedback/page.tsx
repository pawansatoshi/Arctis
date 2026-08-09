'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Heart, Send, CheckCircle2, Bug,
  Lightbulb, TrendingUp, MessageSquare, Loader2,
} from 'lucide-react';
import { useAccount } from 'wagmi';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

const CATEGORIES = [
  { id: 'bug_report',      label: 'Bug Report',       icon: Bug,           color: 'text-rose-600 dark:text-rose-400',   bg: 'bg-rose-500/10',   border: 'border-rose-500/20'   },
  { id: 'feature_request', label: 'Feature Request',  icon: Lightbulb,     color: 'text-amber-600 dark:text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/20'  },
  { id: 'improvement',     label: 'Improvement',      icon: TrendingUp,    color: 'text-blue-600 dark:text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20'   },
  { id: 'general',         label: 'General',          icon: MessageSquare, color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
] as const;

const COUNTRIES = [
  'Afghanistan','Albania','Algeria','Argentina','Australia','Austria','Bangladesh',
  'Belgium','Brazil','Canada','Chile','China','Colombia','Croatia','Czech Republic',
  'Denmark','Egypt','Ethiopia','Finland','France','Germany','Ghana','Greece',
  'Hungary','India','Indonesia','Iran','Iraq','Ireland','Israel','Italy','Japan',
  'Jordan','Kenya','Malaysia','Mexico','Morocco','Netherlands','New Zealand','Nigeria',
  'Norway','Pakistan','Peru','Philippines','Poland','Portugal','Romania','Russia',
  'Saudi Arabia','Singapore','South Africa','South Korea','Spain','Sri Lanka','Sweden',
  'Switzerland','Taiwan','Thailand','Turkey','Ukraine','United Arab Emirates',
  'United Kingdom','United States','Venezuela','Vietnam','Other',
];

type FormState = { name: string; country: string; email: string; category: string; message: string };
const EMPTY: FormState = { name: '', country: '', email: '', category: '', message: '' };

export default function FeedbackPage() {
  const { address } = useAccount();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);

  const isValid =
    form.name.trim().length > 0 &&
    form.country.length > 0 &&
    form.category.length > 0 &&
    form.message.trim().length >= 10;

  const handleSubmit = async () => {
    if (!isValid || loading) return;
    setLoading(true);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          country: form.country,
          email: form.email.trim() || undefined,
          category: form.category,
          message: form.message.trim(),
          walletAddress: address,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Submission failed');
      setSubmitted(true);
      toast.success('Thank you for your feedback!');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  /* ── Success state ──────────────────────────────────────── */
  if (submitted) {
    return (
      <div className="max-w-lg mx-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="glass-card p-10 text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/12 border border-emerald-500/20 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-emerald-500/10">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h2 className="text-surface-950 font-bold text-xl mb-2 tracking-tight">Feedback received</h2>
          <p className="text-surface-600 text-sm mb-6 max-w-xs mx-auto leading-relaxed">
            Thank you for helping improve ARCTIS. Every piece of feedback is reviewed by the team.
          </p>
          <button
            onClick={() => { setSubmitted(false); setForm(EMPTY); }}
            className="btn-ghost"
          >
            Submit another
          </button>
        </motion.div>
      </div>
    );
  }

  /* ── Form ───────────────────────────────────────────────── */
  return (
    <div className="max-w-2xl space-y-5">

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="text-surface-500 text-xs font-semibold uppercase tracking-widest">Platform</span>
        </div>
        <h1 className="text-2xl font-bold text-surface-950 tracking-tight">Feedback</h1>
        <p className="text-surface-600 text-sm mt-1">Bugs, feature requests, or anything on your mind</p>
      </motion.div>

      {/* Form card */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="glass-card p-6 space-y-5"
      >

        {/* Category */}
        <div>
          <label className="text-surface-600 text-xs font-semibold uppercase tracking-wider block mb-3">
            Category <span className="text-rose-600 dark:text-rose-400 ml-0.5">*</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            {CATEGORIES.map((cat) => {
              const active = form.category === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setForm({ ...form, category: cat.id })}
                  className={cn(
                    'flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all duration-200 group',
                    active
                      ? `${cat.border} ${cat.bg}`
                      : 'border-black/[0.06] dark:border-white/[0.06] hover:bg-black/[0.04] dark:hover:bg-white/[0.04] hover:border-black/[0.10] dark:hover:border-white/[0.10]'
                  )}
                >
                  <div className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform duration-200',
                    active ? cat.bg : 'bg-surface-300/40',
                    !active && 'group-hover:scale-105',
                  )}>
                    <cat.icon className={cn('w-4 h-4', active ? cat.color : 'text-surface-600')} />
                  </div>
                  <span className={cn(
                    'text-sm font-medium',
                    active ? cat.color : 'text-surface-700',
                  )}>
                    {cat.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Name */}
        <div>
          <label className="text-surface-600 text-xs font-semibold uppercase tracking-wider block mb-1.5">
            Name <span className="text-rose-600 dark:text-rose-400 ml-0.5">*</span>
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, name: e.target.value })}
            placeholder="Your name"
            className="input-field"
            maxLength={80}
          />
        </div>

        {/* Country */}
        <div>
          <label className="text-surface-600 text-xs font-semibold uppercase tracking-wider block mb-1.5">
            Country <span className="text-rose-600 dark:text-rose-400 ml-0.5">*</span>
          </label>
          <select
            value={form.country}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm({ ...form, country: e.target.value })}
            className="input-field"
          >
            <option value="">Select your country…</option>
            {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Email */}
        <div>
          <label className="text-surface-600 text-xs font-semibold uppercase tracking-wider block mb-1.5">
            Email
            <span className="text-surface-500 normal-case font-normal tracking-normal ml-1.5">(optional — for follow-up only)</span>
          </label>
          <input
            type="email"
            value={form.email}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, email: e.target.value })}
            placeholder="you@example.com"
            className="input-field"
          />
        </div>

        {/* Message */}
        <div>
          <label className="text-surface-600 text-xs font-semibold uppercase tracking-wider block mb-1.5">
            Message <span className="text-rose-600 dark:text-rose-400 ml-0.5">*</span>
            <span className="text-surface-500 normal-case font-normal tracking-normal ml-1.5">(minimum 10 characters)</span>
          </label>
          <textarea
            value={form.message}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm({ ...form, message: e.target.value })}
            placeholder="Tell us what you think, what's broken, or what you'd love to see…"
            rows={5}
            className="input-field resize-none"
            maxLength={2000}
          />
          <div className="flex items-center justify-between mt-1.5">
            {form.message.trim().length > 0 && form.message.trim().length < 10 && (
              <p className="text-rose-600 dark:text-rose-400 text-xs">At least 10 characters required</p>
            )}
            <span className="text-surface-500 text-xs ml-auto">{form.message.length}/2000</span>
          </div>
        </div>

        {/* Wallet attachment notice */}
        {address && (
          <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-surface-300/30 border border-black/[0.05] dark:border-white/[0.05]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
            <span className="text-surface-600 text-xs font-mono">
              {address.slice(0, 8)}…{address.slice(-6)}
            </span>
            <span className="text-surface-500 text-xs">· Wallet will be attached to this feedback</span>
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!isValid || loading}
          className="btn-primary w-full py-3.5 text-base shadow-lg shadow-blue-500/20 disabled:shadow-none disabled:opacity-40"
        >
          {loading
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>
            : <><Send className="w-4 h-4" /> Submit Feedback</>
          }
        </button>
      </motion.div>

      {/* Privacy note */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="glass-card p-4 flex items-start gap-3"
      >
        <Heart className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" aria-hidden />
        <p className="text-surface-600 text-xs leading-relaxed">
          All feedback is reviewed by the founder directly. Your wallet address is attached for context — your email is never shared or used for marketing.
        </p>
      </motion.div>

    </div>
  );
}
