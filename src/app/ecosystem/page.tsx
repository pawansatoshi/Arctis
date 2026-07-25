'use client';

import { motion } from 'framer-motion';
import { ExternalLink, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================
// Ecosystem Page — Arc + Circle official partner links
// ============================================================

interface EcosystemLink {
  name: string;
  description: string;
  url: string;
  tag?: string;
}

const ARC_LINKS: EcosystemLink[] = [
  { name: 'Arc Network',        description: 'Official Arc homepage and documentation hub',                         url: 'https://www.arc.network/',                               tag: 'Home' },
  { name: 'Arc Docs',           description: 'Technical documentation, guides and API references',                  url: 'https://docs.arc.network/',                              tag: 'Docs' },
  { name: 'Arc Community',      description: 'Official community forum and discussions',                            url: 'https://community.arc.network/home',                     tag: 'Community' },
  { name: 'Arc on X',           description: 'Latest news, updates and announcements',                              url: 'https://x.com/arc',                                      tag: 'Social' },
  { name: 'Arc Discord',        description: 'Join the builder community on Discord',                               url: 'https://discord.gg/buildonarc',                          tag: 'Discord' },
  { name: 'Circle Faucet',      description: 'Get testnet USDC to use on Arc Testnet',                              url: 'https://faucet.circle.com/',                             tag: 'Faucet' },
  { name: 'Google Web3 Faucet', description: 'Sepolia ETH faucet for cross-chain testing',                          url: 'https://cloud.google.com/application/web3/faucet/ethereum/sepolia', tag: 'Faucet' },
];

const CIRCLE_LINKS: EcosystemLink[] = [
  { name: 'Circle',              description: 'The company behind USDC — building a digital dollar economy',        url: 'https://www.circle.com/',                                tag: 'Home' },
  { name: 'Circle Developers',   description: 'APIs, SDKs and documentation for building with USDC',               url: 'https://developers.circle.com/',                          tag: 'Docs' },
  { name: 'Circle on X',         description: 'Circle announcements and USDC ecosystem updates',                    url: 'https://x.com/circle',                                   tag: 'Social' },
  { name: 'Circle Discord',      description: 'Build on USDC with support from Circle\'s developer community',     url: 'https://discord.com/invite/buildoncircle',               tag: 'Discord' },
];

const TAG_STYLES: Record<string, string> = {
  'Home':      'bg-blue-500/10 text-blue-400',
  'Docs':      'bg-violet-500/10 text-violet-400',
  'Community': 'bg-emerald-500/10 text-emerald-400',
  'Social':    'bg-cyan-500/10 text-cyan-400',
  'Discord':   'bg-indigo-500/10 text-indigo-400',
  'Faucet':    'bg-amber-500/10 text-amber-400',
};

function EcosystemCard({ link }: { link: EcosystemLink }) {
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      className="glass-card-hover p-4 flex items-start justify-between gap-3 group block"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-surface-950 font-medium text-sm group-hover:text-blue-400 transition-colors">
            {link.name}
          </span>
          {link.tag && (
            <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', TAG_STYLES[link.tag] ?? 'bg-surface-300/30 text-surface-600')}>
              {link.tag}
            </span>
          )}
        </div>
        <p className="text-surface-600 text-xs leading-relaxed">{link.description}</p>
      </div>
      <ExternalLink className="w-3.5 h-3.5 text-surface-500 group-hover:text-blue-400 transition-colors flex-shrink-0 mt-0.5" />
    </a>
  );
}

export default function EcosystemPage() {
  return (
    <div className="max-w-3xl space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-2 mb-1"><span className="text-surface-500 text-xs font-semibold uppercase tracking-widest">Platform</span></div>
        <h1 className="text-2xl font-bold tracking-tight text-surface-950">Ecosystem</h1>
        <p className="text-surface-600 text-sm mt-1">Official Arc and Circle resources</p>
      </motion.div>

      {/* Arc chain info */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }} className="glass-card p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-arc-gradient flex items-center justify-center">
            <span className="text-white font-bold text-sm">A</span>
          </div>
          <div>
            <div className="text-surface-950 font-semibold">Arc Testnet</div>
            <div className="text-surface-600 text-xs flex items-center gap-1.5 mt-0.5">
              <span className="status-dot-online" />Connected
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: 'Chain ID',      value: '5042002' },
            { label: 'Native USDC',   value: '0x3600…' },
            { label: 'Explorer',      value: 'ArcScan' },
          ].map((i) => (
            <div key={i.label} className="bg-surface-200/40 rounded-xl p-3">
              <div className="text-surface-500 text-xs mb-1">{i.label}</div>
              <div className="text-surface-950 font-mono text-sm font-medium">{i.value}</div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Arc Ecosystem */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}>
        <div className="flex items-center gap-2 mb-4">
          <Globe className="w-4 h-4 text-blue-400" />
          <h2 className="text-surface-950 font-semibold">Arc Ecosystem</h2>
        </div>
        <div className="space-y-2">
          {ARC_LINKS.map((link) => (
            <EcosystemCard key={link.name} link={link} />
          ))}
        </div>
      </motion.div>

      {/* Circle Ecosystem */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <span className="text-emerald-400 text-[8px] font-bold">C</span>
          </div>
          <h2 className="text-surface-950 font-semibold">Circle Ecosystem</h2>
        </div>
        <div className="space-y-2">
          {CIRCLE_LINKS.map((link) => (
            <EcosystemCard key={link.name} link={link} />
          ))}
        </div>
      </motion.div>

      {/* Built on section */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }} className="glass-card p-5 text-center">
        <p className="text-surface-600 text-sm">
          ARCTIS is built on <span className="text-surface-950 font-medium">Arc Network</span> using{' '}
          <span className="text-surface-950 font-medium">Arc Native USDC</span> as its primary currency.
          Powered by <span className="text-surface-950 font-medium">Circle&apos;s</span> stablecoin infrastructure.
        </p>
      </motion.div>
    </div>
  );
}
