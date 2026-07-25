'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAccount } from 'wagmi';
import {
  Settings,
  Wallet,
  MessageSquare,
  Globe,
  Bell,
  Shield,
  Code2,
  Copy,
  ExternalLink,
  ChevronRight,
  Zap,
  Bot,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { isMemoEnabled, setMemoEnabled } from '@/lib/memo/service';
import { ARC_CHAIN_ID, ARC_USDC_ADDRESS, ARC_USDC_DECIMALS } from '@/lib/chain/config';
import { copyToClipboard, formatAddress, getAddressExplorerUrl, cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { useLanguagePreference, SUPPORTED_LANGUAGES } from '@/lib/hooks/useLanguagePreference';

// ============================================================
// Settings Page — App Configuration
// ============================================================

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start sm:items-center justify-between gap-4 py-4">
      <div className="flex-1 min-w-0">
        <div className="text-surface-950 text-sm font-medium">{label}</div>
        {description && <div className="text-surface-600 text-xs mt-0.5">{description}</div>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <div className="w-7 h-7 rounded-lg bg-surface-200 flex items-center justify-center">
        <Icon className="w-3.5 h-3.5 text-surface-700" />
      </div>
      <h2 className="text-surface-950 font-semibold text-sm">{title}</h2>
    </div>
  );
}

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={cn(
        'relative w-10 h-5.5 rounded-full transition-colors duration-200',
        enabled ? 'bg-blue-500' : 'bg-surface-400'
      )}
      style={{ height: '22px', width: '40px' }}
    >
      <span
        className={cn(
          'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200',
          enabled && 'translate-x-[18px]'
        )}
      />
    </button>
  );
}

export default function SettingsPage() {
  const { address } = useAccount();
  const { aiEnabled, setAiEnabled } = useAppStore();
  const { language, setLanguage } = useLanguagePreference();
  const [memoEnabled, setMemoEnabledState] = useState(true);

  useEffect(() => { setMemoEnabledState(isMemoEnabled()); }, []);
  const handleMemoToggle = (v: boolean) => { setMemoEnabledState(v); setMemoEnabled(v); };
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  return (
    
      <div className="max-w-2xl space-y-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2 mb-1"><span className="text-surface-500 text-xs font-semibold uppercase tracking-widest">Platform</span></div>
          <h1 className="text-2xl font-bold tracking-tight text-surface-950">Settings</h1>
          <p className="text-surface-600 text-sm mt-1">Configure ARCTIS operational preferences</p>
        </motion.div>

        {/* Wallet section */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass-card p-6">
          <SectionHeader icon={Wallet} title="Wallet" />
          <div className="divide-y divide-white/[0.05]">
            <SettingRow label="Connected Address" description="Your active wallet address">
              {address ? (
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-surface-700">{formatAddress(address, 6)}</span>
                  <button onClick={() => { copyToClipboard(address); toast.success('Copied!'); }} className="text-surface-500 hover:text-surface-950 transition-colors">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <a href={getAddressExplorerUrl(address)} target="_blank" rel="noopener noreferrer" className="text-surface-500 hover:text-blue-400 transition-colors">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              ) : (
                <span className="text-surface-600 text-xs">Not connected</span>
              )}
            </SettingRow>
          </div>
        </motion.div>

        {/* Network section */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-6">
          <SectionHeader icon={Zap} title="Network" />
          <div className="divide-y divide-white/[0.05]">
            <SettingRow label="Chain" description="Active network">
              <div className="flex items-center gap-2">
                <span className="status-dot-online" />
                <span className="text-surface-950 text-xs font-medium">Arc Testnet</span>
              </div>
            </SettingRow>
            <SettingRow label="Chain ID" description="Network identifier">
              <span className="font-mono text-xs text-surface-700">{ARC_CHAIN_ID}</span>
            </SettingRow>
            <SettingRow label="USDC Contract" description="ERC-20 token address">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-surface-700">{formatAddress(ARC_USDC_ADDRESS, 4)}</span>
                <button onClick={() => { copyToClipboard(ARC_USDC_ADDRESS); toast.success('Copied!'); }} className="text-surface-500 hover:text-surface-950 transition-colors">
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </SettingRow>
            <SettingRow label="USDC Decimals" description="Token decimal precision">
              <span className="font-mono text-xs text-surface-700">{ARC_USDC_DECIMALS}</span>
            </SettingRow>
            <SettingRow label="RPC Endpoint" description="Arc Testnet RPC">
              <span className="font-mono text-xs text-surface-700">rpc.testnet.arc.network</span>
            </SettingRow>
          </div>
        </motion.div>

        {/* Notifications */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass-card p-6">
          <SectionHeader icon={Bell} title="Notifications" />
          <div className="divide-y divide-white/[0.05]">
            <SettingRow label="Transaction Alerts" description="Get notified on transfer events">
              <Toggle enabled={notificationsEnabled} onChange={setNotificationsEnabled} />
            </SettingRow>
          </div>
        </motion.div>

        {/* AI Copilot */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card p-6">
          <SectionHeader icon={Bot} title="AI Copilot" />
          <div className="divide-y divide-white/[0.05]">
            <SettingRow label="AI Operational Intelligence" description="Phase 3 — Enable AI treasury copilots (requires OpenRouter key)">
              <Toggle enabled={aiEnabled} onChange={setAiEnabled} />
            </SettingRow>
          </div>
          {aiEnabled && (
            <div className="mt-4 p-3 rounded-xl bg-violet-500/10 border border-violet-500/20 text-xs text-violet-400">
              AI layer enabled. Configure OPENROUTER_API_KEY in .env.local to activate.
            </div>
          )}
        </motion.div>

        {/* Language */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }} className="glass-card p-6">
          <SectionHeader icon={Globe} title="Language" />
          <div className="divide-y divide-white/[0.05]">
            <SettingRow label="Response language" description="Language used by the AI Copilot and AI Chat when responding">
              <select
                value={language}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setLanguage(e.target.value)}
                className="bg-surface-200 border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-surface-950 outline-none focus:border-blue-500/40"
              >
                {SUPPORTED_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>{l.label}</option>
                ))}
              </select>
            </SettingRow>
          </div>
        </motion.div>

        {/* Developer */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="glass-card p-6">
          <SectionHeader icon={MessageSquare} title="Transaction Memos" />
          <div className="divide-y divide-white/[0.05]">
            <SettingRow label="Attach memos to transactions" description="Writes structured metadata to Arc via the Memo contract. Non-blocking.">
              <Toggle enabled={memoEnabled} onChange={handleMemoToggle} />
            </SettingRow>
          </div>
        </motion.div>

        {/* Developer */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.27 }} className="glass-card p-6">
          <SectionHeader icon={Code2} title="Developer" />
          <div className="divide-y divide-white/[0.05]">
            <SettingRow label="Version" description="ARCTIS release">
              <span className="text-surface-700 text-xs font-mono">v1.0.0</span>
            </SettingRow>
            <SettingRow label="Stack" description="Technology foundation">
              <span className="text-surface-700 text-xs">Next.js · Wagmi v2 · Viem</span>
            </SettingRow>
            <SettingRow label="Documentation" description="Setup and deployment guides">
              <ChevronRight className="w-4 h-4 text-surface-600" />
            </SettingRow>
          </div>
        </motion.div>

        {/* Security notice */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card p-4">
          <div className="flex items-start gap-3">
            <Shield className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div className="text-surface-600 text-xs leading-relaxed">
              <span className="text-surface-950 font-medium">Security note: </span>
              ARCTIS never stores private keys. All signing is handled by your connected wallet provider.
              Smart contract addresses are hardcoded and never mutable.
            </div>
          </div>
        </motion.div>
      </div>
    
  );
}
