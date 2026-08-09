'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, ArrowUpRight, Zap, Bot, Cpu, Search,
  RefreshCw, ExternalLink, Filter, Download,
  CheckCircle2, Clock, XCircle, MessageSquare, Repeat, Link2, X,
} from 'lucide-react';
import { useAccount } from 'wagmi';
import { cn, formatRelative } from '@/lib/utils';
import { exportCSV, exportJSON, exportExcel, exportPDF, exportTXT } from '@/lib/utils/export';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonList } from '@/components/ui/Skeleton';
import toast from 'react-hot-toast';

// ─── Types ───────────────────────────────────────────────────
type ActivityType = 'all' | 'transfer' | 'credit' | 'ai_session' | 'agent_execution' | 'membership' | 'credit_purchase' | 'swap' | 'bridge';

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
  transfer:         { icon: ArrowUpRight,   color: 'text-blue-600 dark:text-blue-400',    bg: 'bg-blue-500/10',    label: 'Transfer' },
  credit:           { icon: Zap,            color: 'text-amber-600 dark:text-amber-400',   bg: 'bg-amber-500/10',   label: 'Credits' },
  credit_purchase:  { icon: Zap,            color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10', label: 'Credit Purchase' },
  ai_session:       { icon: MessageSquare,  color: 'text-violet-600 dark:text-violet-400',  bg: 'bg-violet-500/10',  label: 'AI Session' },
  agent_execution:  { icon: Cpu,            color: 'text-cyan-600 dark:text-cyan-400',    bg: 'bg-cyan-500/10',    label: 'Agent' },
  membership:       { icon: Activity,       color: 'text-rose-600 dark:text-rose-400',    bg: 'bg-rose-500/10',    label: 'Membership' },
  membership_payment:{ icon: Activity,      color: 'text-rose-600 dark:text-rose-400',    bg: 'bg-rose-500/10',    label: 'Membership' },
  send:             { icon: ArrowUpRight,   color: 'text-blue-600 dark:text-blue-400',    bg: 'bg-blue-500/10',    label: 'Transfer' },
  swap:             { icon: Repeat,         color: 'text-teal-600 dark:text-teal-400',    bg: 'bg-teal-500/10',    label: 'Swap' },
  bridge:           { icon: Link2,          color: 'text-indigo-600 dark:text-indigo-400',  bg: 'bg-indigo-500/10',  label: 'Bridge' },
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

export default function ActivityPage() {
  const { address, isConnected } = useAccount();
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<ActivityType>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const fetchActivity = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/activity?wallet=${address}&limit=100`);
      const data = await res.json();
      setItems(data.items ?? []);
    } catch {
      toast.error('Could not load activity');
    }
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

  const toExportRows = (rows: ActivityItem[]) => rows.map((i) => ({
    Date: i.timestamp, Type: i.type, Title: i.title, Description: i.description,
    Amount: i.amount ?? '', Token: i.token ?? '', Credits: i.credits ?? '',
    Status: i.status ?? '', TxHash: i.txHash ?? '',
  }));

  const FILTER_TABS: { key: ActivityType; label: string }[] = [
    { key: 'all',              label: 'All' },
    { key: 'transfer',         label: 'Transfers' },
    { key: 'swap',   label: 'Swaps' },
    { key: 'bridge', label: 'Bridge' },
    { key: 'credit',           label: 'Credits' },
    { key: 'ai_session',       label: 'AI' },
    { key: 'agent_execution',  label: 'Agents' },
  ];

  return (
    <div className="max-w-4xl space-y-6 safe-bottom">
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
            <div className="relative">
              <button onClick={() => setShowExportMenu((s) => !s)} className={cn('btn-ghost text-xs py-1.5 gap-1.5', showExportMenu && 'bg-blue-500/10 text-blue-600 dark:text-blue-400')}>
                <Download className="w-3.5 h-3.5" /> Export
              </button>
              <AnimatePresence>
                {showExportMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.98 }}
                      transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
                      className="absolute right-0 top-full mt-1.5 w-36 glass-card p-1 z-20"
                    >
                      {[
                        { label: 'CSV',   fn: () => exportCSV(toExportRows(filtered), 'arctis-activity') },
                        { label: 'JSON',  fn: () => exportJSON(filtered, 'arctis-activity') },
                        { label: 'Excel', fn: () => exportExcel(toExportRows(filtered), 'arctis-activity') },
                        { label: 'PDF',   fn: () => exportPDF(toExportRows(filtered), 'arctis-activity', 'ARCTIS Activity') },
                        { label: 'TXT',   fn: () => exportTXT(toExportRows(filtered), 'arctis-activity') },
                      ].map(({ label, fn }) => (
                        <button key={label} onClick={() => { fn(); setShowExportMenu(false); }} className="w-full text-left px-3 py-2 text-sm text-surface-700 hover:text-surface-950 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] rounded-lg transition-colors">
                          {label}
                        </button>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
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
            className="input-base pl-9 pr-9" />
          {search && (
            <button onClick={() => setSearch('')} aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-950 transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex gap-1 p-1 bg-surface-200/50 rounded-xl border border-black/[0.06] dark:border-white/[0.06] flex-shrink-0 overflow-x-auto">
          {FILTER_TABS.map((tab) => (
            <button key={tab.key} onClick={() => setTypeFilter(tab.key)}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all',
                typeFilter === tab.key ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400' : 'text-surface-600 hover:text-surface-950'
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
        {isConnected && loading && <SkeletonList count={6} />}
        {isConnected && !loading && filtered.length === 0 && (
          <EmptyState
            icon={Activity}
            title={items.length === 0 ? 'No activity yet' : 'No results'}
            description={items.length === 0 ? 'Your activity across ARCTIS will show up here' : 'Try adjusting your search or filters'}
          />
        )}
        {isConnected && !loading && filtered.length > 0 && (
          <div className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
            {filtered.map((item, i) => {
              const cfg = TYPE_CONFIG[item.type] ?? DEFAULT_TYPE;
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i * 0.02, 0.3) }}
                  className="flex items-start gap-4 px-6 py-4 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
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
                        item.credits > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                      )}>
                        <Zap className="w-3 h-3" />
                        {item.credits > 0 ? '+' : ''}{item.credits}
                      </div>
                    )}
                    {(item.txHash || item.explorerUrl) && (
                      <a
                        href={item.explorerUrl ?? `https://testnet.arcscan.app/tx/${item.txHash}`}
                        target="_blank" rel="noopener noreferrer"
                        className="text-surface-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors inline-block"
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
