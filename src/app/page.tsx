'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { ArrowRight, ArrowUpRight, Bot, ArrowLeftRight, GitMerge, Sparkles, Shield, ChevronRight, Zap, Youtube, WalletCards, Workflow } from 'lucide-react';
import LanguageSwitcher from '@/components/i18n/LanguageSwitcher';

const ConnectButton = dynamic(() => import('@rainbow-me/rainbowkit').then((m) => ({ default: m.ConnectButton })), { ssr: false });
const DEMO_VIDEO_URL = 'https://youtu.be/il9_T7rfSMU';
const DEMO_VIDEO_EMBED = 'https://www.youtube.com/embed/il9_T7rfSMU?rel=0&playsinline=1';
const YOUTUBE_CHANNEL_URL = 'https://youtube.com/@PawanSatoshi';

const PILLARS = [
  { icon: WalletCards, label: 'DeFi', description: 'Stablecoin-native swaps, transfers, bridge and treasury flows using USDC on Arc.', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  { icon: Bot, label: 'Agentic Economy', description: 'Agents can reason, prepare economic actions and wait for explicit human wallet approval.', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  { icon: Sparkles, label: 'AI OS', description: 'AI modes, copilot, voice input and agent workflows that explain before they act.', color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
  { icon: GitMerge, label: 'Knowledge OS', description: 'Sessions, saved prompts and contextual workspaces for human and agent intelligence.', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
] as const;

const PROOF_ITEMS = [
  { icon: Shield, text: 'Wallet approval remains the authorization boundary for financial actions' },
  { icon: Zap, text: 'On-chain confirmation is the final transaction success signal' },
  { icon: ArrowLeftRight, text: 'USDC flows use the existing ARCTIS transaction infrastructure' },
  { icon: GitMerge, text: 'Bridge flow uses the existing Circle/CCTP integration where supported' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-surface-50 overflow-x-hidden">
      <div className="fixed inset-0 pointer-events-none" aria-hidden>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-arc-glow opacity-50" />
        <div className="absolute top-1/3 -left-40 w-96 h-96 rounded-full bg-blue-500/[0.04] blur-3xl" />
        <div className="absolute top-1/2 -right-40 w-96 h-96 rounded-full bg-violet-500/[0.04] blur-3xl" />
        <div className="absolute inset-0 opacity-[0.02] dark:hidden" style={{ backgroundImage: 'linear-gradient(rgba(15,23,42,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.2) 1px, transparent 1px)', backgroundSize: '72px 72px' }} />
      </div>

      <nav className="relative z-10 flex items-center justify-between gap-3 px-4 sm:px-6 py-4 sm:py-5 max-w-7xl mx-auto">
        <div className="flex items-center gap-2.5 shrink-0"><div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500/30 to-violet-500/20 border border-black/[0.1] dark:border-white/[0.1] flex items-center justify-center shadow-lg shadow-blue-500/10"><span className="text-blue-600 dark:text-blue-400 font-black text-sm tracking-tighter">A</span></div><span className="text-surface-950 font-bold text-lg tracking-tight">ARCTIS</span></div>
        <div className="hidden md:flex items-center gap-8 text-sm text-surface-700"><Link href="#pillars" className="hover:text-surface-950 transition-colors">DeFi</Link><Link href="#agents" className="hover:text-surface-950 transition-colors">Agents</Link><Link href="#proof" className="hover:text-surface-950 transition-colors">Trust</Link><Link href="/dashboard" className="hover:text-surface-950 transition-colors">Dashboard</Link></div>
        <div className="flex items-center justify-end gap-2 sm:gap-3 min-w-0"><LanguageSwitcher inline /><ConnectButton accountStatus="avatar" chainStatus="none" showBalance={false} /><Link href="/dashboard" className="btn-primary hidden sm:inline-flex shadow-lg shadow-blue-500/20">Launch App <ArrowRight className="w-4 h-4" /></Link></div>
      </nav>

      <section className="relative z-10 pt-12 sm:pt-20 pb-16 px-4 sm:px-6 text-center max-w-5xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65 }}>
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-medium mb-8"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />Built on Arc · Testnet Live · Chain 5042002</div>
          <h1 className="text-5xl sm:text-7xl font-bold tracking-tight text-surface-950 mb-6 leading-[1.04]">Programmable <span className="text-arc-gradient">Money</span><br />for Humans &amp; Agents</h1>
          <p className="text-surface-700 text-lg sm:text-xl max-w-2xl mx-auto mb-5 leading-relaxed">Stablecoin-native <strong>DeFi</strong>, payments and an <strong>Agentic Economy</strong> — built on Arc and powered by USDC.</p>
          <p className="text-surface-500 text-sm max-w-xl mx-auto mb-10">Human authorization + agent intelligence + verifiable on-chain settlement.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3"><Link href="/dashboard" className="btn-primary w-full sm:w-auto px-8 py-3.5 text-base shadow-xl shadow-blue-500/20">Open ARCTIS <ArrowRight className="w-5 h-5" /></Link><Link href="/swap" className="btn-ghost w-full sm:w-auto px-7 py-3.5 text-base border border-black/[0.08] dark:border-white/[0.08]">Explore DeFi <ArrowLeftRight className="w-4 h-4" /></Link><Link href="/agents" className="btn-ghost w-full sm:w-auto px-7 py-3.5 text-base border border-black/[0.08] dark:border-white/[0.08]">Explore Agents <Bot className="w-4 h-4" /></Link></div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.75, delay: 0.25 }} className="mt-14 sm:mt-16 max-w-4xl mx-auto">
          <div className="text-center mb-5"><p className="text-surface-950 font-semibold text-lg tracking-tight">See ARCTIS in action</p><p className="text-surface-600 text-sm mt-1">DeFi flows, agents and settlement — in one product.</p></div>
          <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-black/[0.08] dark:border-white/[0.10] bg-black shadow-2xl shadow-blue-500/10"><div className="aspect-video w-full"><iframe className="h-full w-full" src={DEMO_VIDEO_EMBED} title="ARCTIS Demo — Programmable Money for Humans and Agents" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen loading="eager" referrerPolicy="strict-origin-when-cross-origin" /></div></div>
          <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3"><a href={DEMO_VIDEO_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-surface-950 bg-surface-100 border border-black/[0.08] dark:border-white/[0.08]"><Youtube className="w-4 h-4 text-red-500" />Watch on YouTube<ArrowUpRight className="w-3.5 h-3.5" /></a><a href={YOUTUBE_CHANNEL_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white bg-[#FF0000] shadow-lg shadow-red-500/20"><Youtube className="w-4 h-4" />Pawan Satoshi Channel<ArrowUpRight className="w-3.5 h-3.5" /></a></div>
        </motion.div>

        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 max-w-5xl mx-auto text-left">{PILLARS.map((p) => (<div key={p.label} className={`glass-card p-4 border ${p.border}`}><div className={`w-9 h-9 rounded-xl ${p.bg} flex items-center justify-center mb-3`}><p.icon className={`w-4.5 h-4.5 ${p.color}`} /></div><div className="text-surface-950 font-semibold text-sm mb-1">{p.label}</div><div className="text-surface-600 text-xs leading-relaxed">{p.description}</div></div>))}</div>
      </section>

      <section id="agents" className="relative z-10 py-20 px-4 sm:px-6 border-y border-black/[0.05] dark:border-white/[0.05]"><div className="max-w-5xl mx-auto"><div className="grid lg:grid-cols-2 gap-6 items-stretch"><div className="glass-card p-7 sm:p-9"><div className="w-11 h-11 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-5"><Bot className="w-5 h-5 text-emerald-600 dark:text-emerald-400" /></div><p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-400 mb-2">Agentic Economy</p><h2 className="text-2xl sm:text-3xl font-bold text-surface-950 mb-4">Agents can act. Humans authorize.</h2><p className="text-surface-600 text-sm leading-relaxed mb-6">ARCTIS connects agent reasoning to real economic workflows without turning an AI prompt into an unrestricted wallet. The agent prepares; the user reviews; the wallet authorizes; the chain settles.</p><div className="flex flex-wrap gap-2 text-xs font-medium"><span className="rounded-full bg-surface-100 px-3 py-1.5">Signal</span><span className="text-surface-400">→</span><span className="rounded-full bg-surface-100 px-3 py-1.5">Decision</span><span className="text-surface-400">→</span><span className="rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-3 py-1.5">Proposal</span><span className="text-surface-400">→</span><span className="rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-300 px-3 py-1.5">Wallet approval</span></div></div><div className="glass-card p-7 sm:p-9"><div className="w-11 h-11 rounded-xl bg-blue-500/10 flex items-center justify-center mb-5"><Workflow className="w-5 h-5 text-blue-600 dark:text-blue-400" /></div><p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600 dark:text-blue-400 mb-2">DeFi</p><h2 className="text-2xl sm:text-3xl font-bold text-surface-950 mb-4">USDC becomes programmable money.</h2><p className="text-surface-600 text-sm leading-relaxed mb-6">Transfer, Swap, Bridge and Treasury flows are presented as one stablecoin-native economic layer. Existing transaction infrastructure stays intact — ARCTIS makes it easier to understand and use.</p><Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 dark:text-blue-400">Open the financial workspace <ArrowRight className="w-4 h-4" /></Link></div></div></div></section>

      <section id="proof" className="relative z-10 py-16 px-4 sm:px-6"><div className="max-w-4xl mx-auto"><div className="text-center mb-10"><h2 className="text-surface-950 font-bold text-2xl tracking-tight mb-2">Trust by Design</h2><p className="text-surface-600 text-sm">Clear authorization, clear states, verifiable settlement.</p></div><div className="grid sm:grid-cols-2 gap-3">{PROOF_ITEMS.map((item) => (<div key={item.text} className="glass-card p-4 flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0"><item.icon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /></div><p className="text-surface-700 text-sm leading-snug">{item.text}</p></div>))}</div></div></section>

      <section id="pillars" className="relative z-10 py-20 px-4 sm:px-6 max-w-5xl mx-auto"><motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12"><h2 className="text-3xl sm:text-4xl font-bold text-surface-950 mb-4 tracking-tight">One platform. Four layers.</h2><p className="text-surface-600 text-base max-w-xl mx-auto">DeFi and the Agentic Economy are the economic core; AI and Knowledge make them understandable and usable.</p></motion.div><div className="grid md:grid-cols-2 gap-4">{PILLARS.map((p, i) => (<motion.div key={p.label} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} viewport={{ once: true }} className={`glass-card-hover p-6 border ${p.border}`}><div className={`w-11 h-11 rounded-xl ${p.bg} flex items-center justify-center mb-5`}><p.icon className={`w-5 h-5 ${p.color}`} /></div><h3 className="text-surface-950 font-bold mb-2 tracking-tight">{p.label}</h3><p className="text-surface-600 text-sm leading-relaxed">{p.description}</p></motion.div>))}</div></section>

      <section className="relative z-10 py-20 px-4 sm:px-6 text-center"><motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="max-w-2xl mx-auto"><h2 className="text-3xl sm:text-4xl font-bold text-surface-950 mb-5 tracking-tight">Ready to use programmable money?</h2><p className="text-surface-600 mb-8 text-base leading-relaxed">Connect your wallet, review every action, and use Arc Testnet with the existing ARCTIS transaction rails.</p><div className="flex flex-col sm:flex-row items-center justify-center gap-4"><Link href="/dashboard" className="btn-primary w-full sm:w-auto px-8 py-3.5 text-base shadow-xl shadow-blue-500/20">Launch ARCTIS <ChevronRight className="w-5 h-5" /></Link><Link href="/agents" className="btn-ghost w-full sm:w-auto px-7 py-3.5 text-base border border-black/[0.08] dark:border-white/[0.08]">Explore Agents</Link></div></motion.div></section>

      <footer className="relative z-10 border-t border-black/[0.05] dark:border-white/[0.05] py-8 px-4 sm:px-6"><div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-surface-600 text-sm"><div className="flex items-center gap-2.5"><div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500/30 to-violet-500/20 border border-black/[0.1] dark:border-white/[0.1] flex items-center justify-center"><span className="text-blue-600 dark:text-blue-400 font-black text-[10px]">A</span></div><span className="font-medium text-surface-700">ARCTIS</span></div><div className="flex items-center gap-1.5 text-xs"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /><span>Built on Arc · Arc Native USDC</span></div><span className="text-xs">© {new Date().getFullYear()} ARCTIS</span></div></footer>
    </div>
  );
}
