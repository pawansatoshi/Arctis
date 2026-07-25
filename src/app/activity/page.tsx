'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Activity, ArrowUpRight, Zap, Bot, Cpu, Search,
  RefreshCw, ExternalLink, Filter, Download,
  CheckCircle2, Clock, XCircle, MessageSquare,
} from 'lucide-react';
import { useAccount } from 'wagmi';
import { cn, formatDateTime, formatRelative } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────
type ActivityType = 'all' | 'transfer' | 'credit' | 'ai_session' | 'agent_execution' | 'membership' | 'credit_purchase';

interface ActivityItem {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
  amount?: string;
  token?: string;
  status?: string;
  txHash?: string;
  explorerUrl?: string;
  credits?: number;
  meta?: Record<string, unknown>;
}

const TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  transfer:         { icon: ArrowUpRight,   color: 'text-blue-400',    bg: 'bg-blue-500/10',    label: 'Transfer' },
  credit:           { icon: Zap,            color: 'text-amber-400',   bg: 'bg-amber-500/10',   label: 'Credits' },
  credit_purchase:  { icon: Zap,            color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Credit Purchase' },
  ai_session:       { icon: MessageSquare,  color: 'text-violet-400',  bg: 'bg-violet-500/10',  label: 'AI Session' },
  agent_execution:  { icon: Cpu,            color: 'text-cyan-400',    bg: 'bg-cyan-500/10',    label: 'Agent' },
  membership:       { icon: Activity,       color: 'text-rose-400',    bg: 'bg-rose-500/10',    label: 'Membership' },
  membership_payment:{ icon: Activity,      color: 'text-rose-400',    bg: 'bg-rose-500/10',    label: 'Membership' },
  send:             { icon: ArrowUpRight,   color: 'text-blue-400',    bg: 'bg-blue-500/10',    label: 'Transfer' },
};

const DEFAULT_TYPE = { icon: Activity, color: 'text-surface-600', bg: 'bg-surface-300/30', label: 'Activity' };

function StatusBadge({ status }: { status?: string }) {
  if (!status) return null;
  return (
    <span className={cn('text-xs px-2 py-0.5 rounded-full',
      status === 'confirmed' || status === 'completed' ? 'badge-success' :
      status === 'pending'   || status === 'running'   ? 'badge-pending' :
      status === 'failed'                              ? 'badge-error' :
      'bg-surface-300/30 text-surface-600'
    )}>
      {status}
    </span>
  );
}

// ─── Export helper (client-side) ─────────────────────────────
function exportToCSV(items: ActivityItem[]) {
  const headers = ['Date', 'Type', 'Title', 'Description', 'Amount', 'Token', 'Credits', 'Status', 'TxHash'];
  const rows = items.map((i) => [
    formatDateTime(i.timestamp),
    i.type,
    `"${i.title.replace(/"/g, '""')}"`,
    `"${i.description.replace(/"/g, '""')}"`,
    i.amount ?? '',
    i.token ?? '',
    i.credits?.toString() ?? '',
    i.status ?? '',
    i.txHash ?? '',
  ]);
  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `arctis-activity-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportToJSON(items: ActivityItem[]) {
  const json = JSON.stringify(items, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `arctis-activity-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ActivityPage() {
  const { address, isConnected } = useAccount();
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<ActivityType>('all');
  const [refreshing, setRefreshing] = useState(false);

  const fetchActivity = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/activity?wallet=${address}&limit=100`);
      const data = await res.json();
      setItems(data.items ?? []);
    } catch {}
    setLoading(false);
  }, [address]);

  useEffect(() => { fetchActivity(); }, [fetchActivity]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchActivity();
    setRefreshing(false);
  };

  const filtered = items.filter((item) => {
    if (typeFilter !== 'all' && !item.type.includes(typeFilter)) return false;
    if (search) {
      const q = search.toLowerCase();
      return item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.txHash?.toLowerCase().includes(q);
    }
    return true;
  });

  const FILTER_TABS: { key: ActivityType; label: string }[] = [
    { key: 'all',              label: 'All' },
    { key: 'transfer',         label: 'Transfers' },
    { key: 'credit',           label: 'Credits' },
    { key: 'ai_session',       label: 'AI' },
    { key: 'agent_execution',  label: 'Agents' },
  ];

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1"><span className="text-surface-500 text-xs font-semibold uppercase tracking-widest">Overview</span></div>
          <h1 className="text-2xl font-bold tracking-tight text-surface-950">Activity Center</h1>
          <p className="text-surface-600 text-sm mt-1">Unified OS history — transfers, AI, agents, credits</p>
        </div>
        <div className="flex items-center gap-2">
          {filtered.length > 0 && (
            <>
              <button onClick={() => exportToCSV(filtered)}
                className="btn-ghost text-xs py-1.5 gap-1.5">
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
              <button onClick={() => exportToJSON(filtered)}
                className="btn-ghost text-xs py-1.5 gap-1.5">
                <Download className="w-3.5 h-3.5" /> JSON
              </button>
            </>
          )}
          <button onClick={handleRefresh} className={cn('btn-ghost', refreshing && 'opacity-50')}>
            <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
          </button>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-600" />
          <input type="text" placeholder="Search activity…" value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-base pl-9" />
        </div>
        <div className="flex gap-1 p-1 bg-surface-200/50 rounded-xl border border-white/[0.06] flex-shrink-0 overflow-x-auto">
          {FILTER_TABS.map((tab) => (
            <button key={tab.key} onClick={() => setTypeFilter(tab.key)}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all',
                typeFilter === tab.key ? 'bg-blue-500/20 text-blue-400' : 'text-surface-600 hover:text-surface-950'
              )}>
              {tab.label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Stats row */}
      {!loading && items.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Events',    value: items.length.toString() },
            { label: 'Transfers',       value: items.filter((i) => i.type.includes('transfer') || i.type === 'send').length.toString() },
            { label: 'AI Sessions',     value: items.filter((i) => i.type === 'ai_session').length.toString() },
            { label: 'Agent Runs',      value: items.filter((i) => i.type === 'agent_execution').length.toString() },
          ].map((s) => (
            <div key={s.label} className="glass-card p-4 text-center">
              <div className="text-xl font-bold text-surface-950 font-mono">{s.value}</div>
              <div className="text-surface-600 text-xs mt-0.5">{s.label}</div>
            </div>
          ))}
        </motion.div>
      )}

      {/* Feed */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }} className="glass-card overflow-hidden">
        {!isConnected && (
          <div className="py-16 text-center text-surface-600 text-sm">Connect wallet to see activity</div>
        )}
        {isConnected && loading && (
          <div className="py-16 text-center">
            <RefreshCw className="w-6 h-6 text-blue-400 mx-auto animate-spin mb-2" />
            <div className="text-surface-600 text-sm">Loading activity…</div>
          </div>
        )}
        {isConnected && !loading && filtered.length === 0 && (
          <div className="py-16 text-center">
            <Activity className="w-8 h-8 text-surface-600 mx-auto mb-3 opacity-40" />
            <div className="text-surface-600 text-sm">
              {items.length === 0 ? 'No activity yet' : 'No activity matches your filters'}
            </div>
          </div>
        )}
        {isConnected && !loading && filtered.length > 0 && (
          <div className="divide-y divide-white/[0.04]">
            {filtered.map((item, i) => {
              const cfg = TYPE_CONFIG[item.type] ?? DEFAULT_TYPE;
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i * 0.02, 0.3) }}
                  className="flex items-start gap-4 px-6 py-4 hover:bg-white/[0.02] transition-colors"
                >
                  <div className={cn('w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5', cfg.bg)}>
                    <cfg.icon className={cn('w-3.5 h-3.5', cfg.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-surface-950 text-sm font-medium">{item.title}</span>
                      <StatusBadge status={item.status} />
                    </div>
                    <div className="text-surface-600 text-xs mb-1">{item.description}</div>
                    <div className="text-surface-500 text-xs">{formatRelative(item.timestamp)}</div>
                  </div>
                  <div className="text-right flex-shrink-0 space-y-1">
                    {item.amount && (
                      <div className="text-surface-950 font-mono text-sm font-semibold">
                        {item.amount} <span className="text-surface-600 font-normal text-xs">{item.token}</span>
                      </div>
                    )}
                    {item.credits !== undefined && item.credits !== 0 && (
                      <div className={cn('font-mono text-sm font-semibold flex items-center gap-1 justify-end',
                        item.credits > 0 ? 'text-emerald-400' : 'text-rose-400'
                      )}>
                        <Zap className="w-3 h-3" />
                        {item.credits > 0 ? '+' : ''}{item.credits}
                      </div>
                    )}
                    {(item.txHash || item.explorerUrl) && (
                      <a
                        href={item.explorerUrl ?? `https://testnet.arcscan.app/tx/${item.txHash}`}
                        target="_blank" rel="noopener noreferrer"
                        className="text-surface-500 hover:text-blue-400 transition-colors inline-block"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}
