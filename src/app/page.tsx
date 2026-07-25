'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  ArrowRight, Bot, ArrowLeftRight, GitMerge,
  Sparkles, Shield, ChevronRight, Zap,
} from 'lucide-react';

const ConnectButton = dynamic(
  () => import('@rainbow-me/rainbowkit').then((m) => ({ default: m.ConnectButton })),
  { ssr: false }
);

const OS_PILLARS = [
  {
    icon: Bot,
    label: 'AI OS',
    description: '12 AI modes. Streaming Copilot. Voice input. Agents that work — and wait for your approval.',
    color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20',
  },
  {
    icon: ArrowLeftRight,
    label: 'Stablecoin OS',
    description: 'Transfer, Swap, and Bridge USDC on Arc. Real on-chain settlement. Every transaction verified.',
    color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20',
  },
  {
    icon: GitMerge,
    label: 'Economic Agent OS',
    description: '7 agent types with memory, budgets, and a mandatory human approval gate before any action.',
    color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20',
  },
  {
    icon: Sparkles,
    label: 'Knowledge OS',
    description: 'Sessions, saved prompts, domain workspaces. AI that learns your context across every session.',
    color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20',
  },
] as const;

const PROOF_ITEMS = [
  { icon: Shield, text: 'Every transaction verified on-chain before confirming' },
  { icon: Zap, text: 'Agents require explicit human approval — no autonomous spending' },
  { icon: ArrowLeftRight, text: 'OTC swap settlement with real on-chain reserves' },
  { icon: GitMerge, text: 'Bridge via Circle CCTP V2 — attestation-verified' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-surface-50 overflow-x-hidden">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none" aria-hidden>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-arc-glow opacity-50" />
        <div className="absolute top-1/3 -left-40 w-96 h-96 rounded-full bg-blue-500/[0.04] blur-3xl" />
        <div className="absolute top-1/2 -right-40 w-96 h-96 rounded-full bg-violet-500/[0.04] blur-3xl" />
        <div className="absolute inset-0 opacity-[0.015]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)', backgroundSize: '72px 72px' }} />
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-5 max-w-7xl mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500/30 to-violet-500/20 border border-white/[0.1] flex items-center justify-center shadow-lg shadow-blue-500/10">
            <span className="text-blue-400 font-black text-sm tracking-tighter">A</span>
          </div>
          <span className="text-surface-950 font-bold text-lg tracking-tight">ARCTIS</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm text-surface-700">
          <Link href="#pillars" className="hover:text-surface-950 transition-colors">Platform</Link>
          <Link href="#proof" className="hover:text-surface-950 transition-colors">Trust</Link>
          <Link href="/dashboard" className="hover:text-surface-950 transition-colors">Dashboard</Link>
        </div>
        <div className="flex items-center gap-3">
          <ConnectButton accountStatus="avatar" chainStatus="none" showBalance={false} />
          <Link href="/dashboard" className="btn-primary hidden sm:inline-flex shadow-lg shadow-blue-500/20">
            Launch App <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 pt-20 pb-28 px-6 text-center max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Built on Arc · Testnet Live · Chain 5042002
          </div>

          <h1 className="text-5xl sm:text-7xl font-bold tracking-tight text-surface-950 mb-6 leading-[1.06]">
            The Web3{' '}
            <span className="text-arc-gradient">Operating System</span>
            <br />for Humans and Agents
          </h1>

          <p className="text-surface-700 text-lg sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
            ARCTIS combines AI, Stablecoin, Knowledge, and Economic Agent operating systems
            into one platform — built on Arc, powered by Arc Native USDC.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/dashboard" className="btn-primary px-8 py-3.5 text-base shadow-xl shadow-blue-500/20">
              Open ARCTIS <ArrowRight className="w-5 h-5" />
            </Link>
            <Link href="/transfer" className="btn-ghost px-7 py-3.5 text-base border border-white/[0.08]">
              Send USDC
            </Link>
          </div>
        </motion.div>

        {/* OS Pillar preview */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-3 max-w-4xl mx-auto"
        >
          {OS_PILLARS.map((p) => (
            <div key={p.label} className={`glass-card p-4 text-left border ${p.border}`}>
              <div className={`w-9 h-9 rounded-xl ${p.bg} flex items-center justify-center mb-3`}>
                <p.icon className={`w-4.5 h-4.5 ${p.color}`} />
              </div>
              <div className="text-surface-950 font-semibold text-sm mb-1">{p.label}</div>
              <div className="text-surface-600 text-xs leading-relaxed">{p.description}</div>
            </div>
          ))}
        </motion.div>
      </section>

      {/* Proof of trust */}
      <section id="proof" className="relative z-10 py-16 border-y border-white/[0.05]">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-10">
            <h2 className="text-surface-950 font-bold text-2xl tracking-tight mb-2">Trust by Design</h2>
            <p className="text-surface-600 text-sm">Not claims. Verifiable on-chain behavior.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {PROOF_ITEMS.map((item) => (
              <div key={item.text} className="glass-card p-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                  <item.icon className="w-4 h-4 text-emerald-400" />
                </div>
                <p className="text-surface-700 text-sm leading-snug">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* OS Pillars detail */}
      <section id="pillars" className="relative z-10 py-24 px-6 max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-surface-950 mb-4 tracking-tight">
            Four Operating Systems. One Platform.
          </h2>
          <p className="text-surface-600 text-base max-w-xl mx-auto">
            Each pillar is complete and independent — together they form something greater.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-4">
          {OS_PILLARS.map((p, i) => (
            <motion.div
              key={p.label}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              viewport={{ once: true }}
              className={`glass-card-hover p-6 border ${p.border}`}
            >
              <div className={`w-11 h-11 rounded-xl ${p.bg} flex items-center justify-center mb-5`}>
                <p.icon className={`w-5 h-5 ${p.color}`} />
              </div>
              <h3 className="text-surface-950 font-bold mb-2 tracking-tight">{p.label}</h3>
              <p className="text-surface-600 text-sm leading-relaxed">{p.description}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 py-24 px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-2xl mx-auto"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-surface-950 mb-5 tracking-tight">
            Ready to get started?
          </h2>
          <p className="text-surface-600 mb-8 text-base leading-relaxed">
            Connect your wallet and enter the operating system.
            Arc Testnet — real transactions, real agents, real settlement.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/dashboard" className="btn-primary px-8 py-3.5 text-base shadow-xl shadow-blue-500/20">
              Launch ARCTIS <ChevronRight className="w-5 h-5" />
            </Link>
            <Link href="/agents" className="btn-ghost px-7 py-3.5 text-base border border-white/[0.08]">
              Explore Agents
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.05] py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-surface-600 text-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500/30 to-violet-500/20 border border-white/[0.1] flex items-center justify-center">
              <span className="text-blue-400 font-black text-[10px]">A</span>
            </div>
            <span className="font-medium text-surface-700">ARCTIS</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Built on Arc · Arc Native USDC</span>
          </div>
          <span className="text-xs">© {new Date().getFullYear()} ARCTIS</span>
        </div>
      </footer>
    </div>
  );
}
