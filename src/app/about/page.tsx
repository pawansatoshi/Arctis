'use client';

import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { ExternalLink, Mail, Code2, Zap } from 'lucide-react';

const SOCIALS = [
  { label: 'X (Twitter)', href: 'https://x.com/pawansatoshix',          icon: 'X',        color: 'hover:text-surface-950' },
  { label: 'GitHub',      href: 'https://github.com/pawansatoshi',       icon: 'GH',       color: 'hover:text-surface-950' },
  { label: 'Discord',     href: 'https://discord.com/users/965913443687338025', icon: 'DC', color: 'hover:text-indigo-600 dark:hover:text-indigo-400' },
  { label: 'YouTube',     href: 'https://youtube.com/@PawanSatoshi',     icon: 'YT',       color: 'hover:text-rose-600 dark:hover:text-rose-400' },
  { label: 'Telegram',    href: 'https://t.me/pawansatoshiji',            icon: 'TG',       color: 'hover:text-blue-600 dark:hover:text-blue-400' },
];

const STACK = [
  'Next.js 14 App Router', 'TypeScript Strict', 'TailwindCSS',
  'Framer Motion', 'Wagmi v2', 'Viem', 'RainbowKit',
  'Firebase', 'OpenRouter', 'Arc Testnet',
];

export default function AboutPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-2 mb-1"><span className="text-surface-500 text-xs font-semibold uppercase tracking-widest">Platform</span></div>
        <h1 className="text-2xl font-bold tracking-tight text-surface-950">About</h1>
        <p className="text-surface-600 text-sm mt-1">The team and technology behind ARCTIS</p>
      </motion.div>

      {/* Developer card */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }} className="glass-card p-6">
        <div className="flex items-start gap-5">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-2xl bg-arc-gradient flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-2xl">P</span>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-surface-950 font-bold text-xl">Pawan Satoshi</h2>
            <p className="text-surface-600 text-sm mt-0.5">Founder & Developer</p>
            <p className="text-surface-600 text-sm mt-3 leading-relaxed">
              Building ARCTIS — an AI + Stablecoin Operating System on Arc. Combining AI workspaces,
              economic agents, and USDC payments into one unified platform.
            </p>
          </div>
        </div>

        {/* Social links */}
        <div className="flex flex-wrap gap-2 mt-5 pt-5 border-t border-black/[0.06] dark:border-white/[0.06]">
          {SOCIALS.map((s) => (
            <a
              key={s.label}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-200/50 border border-black/[0.06] dark:border-white/[0.06]',
                'text-surface-700 text-sm font-medium transition-all hover:bg-surface-200',
                s.color
              )}
            >
              <span className="font-mono text-xs font-bold">{s.icon}</span>
              {s.label}
              <ExternalLink className="w-3 h-3 opacity-50" />
            </a>
          ))}
          <a
            href="mailto:pawansatoshi@gmail.com"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-200/50 border border-black/[0.06] dark:border-white/[0.06] text-surface-700 text-sm font-medium hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-surface-200 transition-all"
          >
            <Mail className="w-3.5 h-3.5" />
            Contact
          </a>
        </div>
      </motion.div>

      {/* Platform info */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }} className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <h3 className="text-surface-950 font-semibold">About ARCTIS</h3>
        </div>
        <p className="text-surface-600 text-sm leading-relaxed mb-4">
          ARCTIS is an AI + Stablecoin Operating System built on Arc. It combines human AI workspaces,
          economic AI agents, USDC payment infrastructure, and a complete activity center into one platform.
        </p>
        <p className="text-surface-600 text-sm leading-relaxed">
          Unlike tools that only offer chat, ARCTIS lets users and agents perform real work:
          research papers, code audits, treasury management, document analysis — all powered
          by Arc Native USDC and tracked on-chain.
        </p>
      </motion.div>

      {/* Tech stack */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }} className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Code2 className="w-4 h-4 text-violet-600 dark:text-violet-400" />
          <h3 className="text-surface-950 font-semibold">Technology Stack</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {STACK.map((tech) => (
            <span key={tech} className="px-3 py-1.5 rounded-lg bg-surface-200/50 border border-black/[0.06] dark:border-white/[0.06] text-surface-700 text-xs font-medium">
              {tech}
            </span>
          ))}
        </div>
      </motion.div>

      {/* Version */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }} className="text-center text-surface-500 text-xs">
        ARCTIS v1.0 · Arc Testnet (Chain ID 5042002) · Built with ❤️ by Pawan Satoshi
      </motion.div>
    </div>
  );
}

