'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Shield, Users, Coins, TrendingUp, Activity,
  RefreshCw, AlertCircle, CheckCircle2, XCircle,
  Database, Zap, BarChart3,
} from 'lucide-react';
import { useAccount } from 'wagmi';
import { cn, formatRelative } from '@/lib/utils';
import type { ObsLog } from '@/types';

// Admin wallets — only these addresses can access the admin panel
// Add your wallet address here to enable admin access
const ADMIN_WALLETS = [
  '0xb467f683764593316faebb0709127e90791fe47f', // treasury wallet
];

export default function AdminPage() {
  const { address } = useAccount();
  const [logs, setLogs] = useState<ObsLog[]>([]);
  const [metrics, setMetrics] = useState<{ membershipRevenue30d: number; creditRevenue30d: number; aiSpend30d: number; txCount30d: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'logs' | 'flags'>('overview');

  const isAdmin = address
    ? ADMIN_WALLETS.includes(address.toLowerCase())
    : false;

  const fetchData = async () => {
    setLoading(true);
    try {
      const [treasuryRes, logsRes] = await Promise.all([
        fetch('/api/treasury'),
        fetch('/api/logs').catch(() => ({ json: async () => ({ logs: [] }) } as Response)),
      ]);
      const treasuryData = await treasuryRes.json();
      const logsData = await logsRes.json();
      setMetrics(treasuryData.metrics ?? null);
      setLogs(logsData.logs ?? []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { if (isAdmin) fetchData(); }, [isAdmin]);

  const TABS = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'logs', label: 'System Logs', icon: Activity },
    { id: 'flags', label: 'Feature Flags', icon: Zap },
  ] as const;

  const FEATURE_FLAGS = [
    { id: 'ai_enabled',         name: 'AI Workspace',       enabled: true,  description: 'OpenRouter streaming chat' },
    { id: 'credits_enabled',    name: 'Credit Economy',     enabled: true,  description: 'Credit purchase & deduction' },
    { id: 'membership_enabled', name: 'Memberships',        enabled: true,  description: 'USDC subscription plans' },
    { id: 'swap_enabled',       name: 'Swap',               enabled: false, description: 'Awaiting Arc provider support' },
    { id: 'bridge_enabled',     name: 'Bridge',             enabled: false, description: 'Awaiting Arc bridge launch' },
    { id: 'analytics_enabled',  name: 'Advanced Analytics', enabled: true,  description: 'Recharts dashboard' },
  ];

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Shield className="w-12 h-12 text-surface-600 mx-auto mb-3" />
          <h2 className="text-surface-950 font-semibold mb-1">Access Restricted</h2>
          <p className="text-surface-600 text-sm">Admin access required</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-surface-950">Admin</h1>
            <span className="badge-success text-xs">Testnet</span>
          </div>
          <p className="text-surface-600 text-sm">System management & observability</p>
        </div>
        <button onClick={fetchData} className={cn('btn-ghost', loading && 'opacity-50')}>
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          Refresh
        </button>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-surface-200/50 rounded-xl border border-white/[0.06] w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              activeTab === tab.id ? 'bg-blue-500/20 text-blue-400' : 'text-surface-600 hover:text-surface-950'
            )}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {activeTab === 'overview' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: '30D Membership Rev', value: metrics ? `${metrics.membershipRevenue30d.toFixed(2)} USDC` : '—', icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
              { label: '30D Credit Rev', value: metrics ? `${metrics.creditRevenue30d.toFixed(2)} USDC` : '—', icon: Coins, color: 'text-blue-400', bg: 'bg-blue-500/10' },
              { label: '30D AI Spend', value: metrics ? `${metrics.aiSpend30d.toFixed(4)} USDC` : '—', icon: Zap, color: 'text-amber-400', bg: 'bg-amber-500/10' },
              { label: '30D Tx Count', value: metrics ? metrics.txCount30d.toString() : '—', icon: Activity, color: 'text-violet-400', bg: 'bg-violet-500/10' },
            ].map((m) => (
              <div key={m.label} className="metric-card">
                <div className="flex items-center justify-between">
                  <span className="text-surface-600 text-xs uppercase tracking-wider">{m.label}</span>
                  <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', m.bg)}>
                    <m.icon className={cn('w-3.5 h-3.5', m.color)} />
                  </div>
                </div>
                <div className="text-xl font-bold text-surface-950 font-mono">{m.value}</div>
              </div>
            ))}
          </div>

          {/* System status */}
          <div className="glass-card p-6">
            <h2 className="text-surface-950 font-semibold mb-4">System Status</h2>
            <div className="space-y-3">
              {[
                { name: 'Firebase', status: 'operational', note: 'Firestore + Auth connected' },
                { name: 'OpenRouter AI', status: 'operational', note: 'Streaming enabled, fallback chain active' },
                { name: 'Arc Testnet RPC', status: 'operational', note: 'rpc.testnet.arc.network' },
                { name: 'Swap Providers', status: 'degraded', note: 'Arc Testnet not yet supported' },
                { name: 'Bridge Providers', status: 'degraded', note: 'Arc bridge not yet launched' },
              ].map((s) => (
                <div key={s.name} className="flex items-center justify-between py-2 border-b border-white/[0.04]">
                  <div className="flex items-center gap-3">
                    {s.status === 'operational'
                      ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      : <AlertCircle className="w-4 h-4 text-amber-400" />
                    }
                    <div>
                      <div className="text-surface-950 text-sm font-medium">{s.name}</div>
                      <div className="text-surface-500 text-xs">{s.note}</div>
                    </div>
                  </div>
                  <span className={cn('text-xs px-2 py-0.5 rounded-full',
                    s.status === 'operational' ? 'badge-success' : 'badge-pending'
                  )}>
                    {s.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Logs */}
      {activeTab === 'logs' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card overflow-hidden">
          <div className="px-6 py-4 border-b border-white/[0.05] flex items-center justify-between">
            <h2 className="text-surface-950 font-semibold">System Logs</h2>
            <span className="text-surface-600 text-xs">{logs.length} entries</span>
          </div>
          {logs.length === 0 ? (
            <div className="py-12 text-center text-surface-600 text-sm">
              <Database className="w-8 h-8 mx-auto mb-2 opacity-40" />
              No logs yet
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04] max-h-96 overflow-y-auto">
              {logs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 px-6 py-3 hover:bg-white/[0.02] font-mono text-xs">
                  <span className={cn('flex-shrink-0 px-1.5 py-0.5 rounded text-xs font-medium mt-0.5',
                    log.level === 'error' ? 'bg-rose-500/20 text-rose-400' :
                    log.level === 'warn'  ? 'bg-amber-500/20 text-amber-400' :
                    'bg-blue-500/10 text-blue-400'
                  )}>
                    {log.level}
                  </span>
                  <span className="text-surface-500 flex-shrink-0">[{log.category}]</span>
                  <span className="text-surface-800 flex-1 break-all">{log.message}</span>
                  <span className="text-surface-500 flex-shrink-0 whitespace-nowrap">{formatRelative(log.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* Feature Flags */}
      {activeTab === 'flags' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-6">
          <h2 className="text-surface-950 font-semibold mb-4">Feature Flags</h2>
          <div className="space-y-3">
            {FEATURE_FLAGS.map((flag) => (
              <div key={flag.id} className="flex items-center justify-between py-3 border-b border-white/[0.04]">
                <div className="flex items-center gap-3">
                  {flag.enabled
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    : <XCircle className="w-4 h-4 text-surface-500" />
                  }
                  <div>
                    <div className="text-surface-950 text-sm font-medium">{flag.name}</div>
                    <div className="text-surface-500 text-xs font-mono">{flag.id} — {flag.description}</div>
                  </div>
                </div>
                <span className={cn('text-xs px-2 py-0.5 rounded-full',
                  flag.enabled ? 'badge-success' : 'bg-surface-300/30 text-surface-600'
                )}>
                  {flag.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
