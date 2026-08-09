'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock, CheckCircle2, XCircle, AlertCircle, ExternalLink,
  Copy, Search, Download, RefreshCw, ChevronLeft, ChevronRight, X,
} from 'lucide-react';
import { useAccount } from 'wagmi';
import { exportCSV, exportJSON, exportPDF, exportExcel, exportTXT } from '@/lib/utils/export';
import { formatDateTime, formatRelative, copyToClipboard, cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonList } from '@/components/ui/Skeleton';

// ============================================================
// ARCTIS History — a single, comprehensive, paginated record of
// every platform event: transfers, swaps, bridges, AI sessions,
// agent executions, and credit ledger entries.
//
// Pulls from the same /api/activity aggregation endpoint that
// powers the Activity Center feed (no duplicate backend logic) —
// this page focuses on a dense, searchable, exportable table with
// real pagination, while Activity Center stays a live card feed.
// ============================================================

interface HistoryItem {
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
}

type TypeFilter = 'all' | 'transfer' | 'swap' | 'bridge' | 'credit' | 'ai_session' | 'agent_execution';
type StatusFilter = 'all' | 'confirmed' | 'completed' | 'pending' | 'failed';

const PAGE_SIZE = 20;

function StatusIcon({ status }: { status?: string }) {
  if (status === 'confirmed' || status === 'completed') return <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
  if (status === 'pending' || status === 'running' || status === 'proposed') return <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 animate-pulse" />;
  if (status === 'failed') return <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />;
  return <AlertCircle className="w-4 h-4 text-surface-600" />;
}

export default function HistoryPage() {
  const { address, isConnected } = useAccount();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const fetchHistory = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/activity?wallet=${address}&limit=300`);
      const data = await res.json();
      setItems(data.items ?? []);
    } catch {
      toast.error('Could not load history');
    }
    setLoading(false);
  }, [address]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchHistory();
    setRefreshing(false);
    setPage(1);
  };

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (typeFilter !== 'all' && item.type !== typeFilter) return false;
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return item.title.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.txHash?.toLowerCase().includes(q);
      }
      return true;
    });
  }, [items, typeFilter, statusFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toExportRows = (rows: HistoryItem[]) => rows.map((i) => ({
    Date: i.timestamp, Type: i.type, Title: i.title, Description: i.description,
    Amount: i.amount ?? '', Token: i.token ?? '', Credits: i.credits ?? '',
    Status: i.status ?? '', TxHash: i.txHash ?? '',
  }));

  const TYPE_TABS: { key: TypeFilter; label: string }[] = [
    { key: 'all', label: 'All' }, { key: 'transfer', label: 'Transfers' },
    { key: 'swap', label: 'Swaps' }, { key: 'bridge', label: 'Bridge' },
    { key: 'credit', label: 'Credits' }, { key: 'ai_session', label: 'AI' },
    { key: 'agent_execution', label: 'Agents' },
  ];

  return (
    <div className="max-w-5xl space-y-6 safe-bottom">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1"><span className="text-surface-500 text-xs font-semibold uppercase tracking-widest">Platform Record</span></div>
          <h1 className="text-2xl font-bold text-surface-950 tracking-tight">History</h1>
          <p className="text-surface-600 text-sm mt-1">{filtered.length} {filtered.length === 1 ? 'event' : 'events'} across ARCTIS</p>
        </div>
        <div className="flex items-center gap-2">
          {filtered.length > 0 && (
            <div className="relative">
              <button onClick={() => setShowExportMenu((s) => !s)} className={cn('btn-ghost gap-1.5 text-sm', showExportMenu && 'bg-blue-500/10 text-blue-600 dark:text-blue-400')}>
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
                        { label: 'CSV',   fn: () => exportCSV(toExportRows(filtered), 'arctis-history') },
                        { label: 'JSON',  fn: () => exportJSON(filtered, 'arctis-history') },
                        { label: 'Excel', fn: () => exportExcel(toExportRows(filtered), 'arctis-history') },
                        { label: 'PDF',   fn: () => exportPDF(toExportRows(filtered), 'arctis-history', 'ARCTIS History') },
                        { label: 'TXT',   fn: () => exportTXT(toExportRows(filtered), 'arctis-history') },
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
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-600" />
            <input type="text" placeholder="Search by title, description, or hash…" value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="input-base pl-9 pr-9" />
            {search && (
              <button onClick={() => setSearch('')} aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-950 transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1 p-1 bg-surface-200/50 rounded-xl border border-black/[0.06] dark:border-white/[0.06] flex-shrink-0">
            {(['all', 'confirmed', 'pending', 'failed'] as StatusFilter[]).map((s) => (
              <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
                className={cn('px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all',
                  statusFilter === s ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400' : 'text-surface-600 hover:text-surface-950'
                )}>
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-1 p-1 bg-surface-200/50 rounded-xl border border-black/[0.06] dark:border-white/[0.06] overflow-x-auto">
          {TYPE_TABS.map((tab) => (
            <button key={tab.key} onClick={() => { setTypeFilter(tab.key); setPage(1); }}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all',
                typeFilter === tab.key ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400' : 'text-surface-600 hover:text-surface-950'
              )}>
              {tab.label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="glass-card overflow-hidden">
        {!isConnected && (
          <div className="py-16 text-center text-surface-600 text-sm">Connect wallet to see your history</div>
        )}
        {isConnected && loading && <SkeletonList count={6} />}
        {isConnected && !loading && pageItems.length === 0 && (
          <EmptyState
            icon={Clock}
            title={items.length === 0 ? 'No history yet' : 'No results'}
            description={items.length === 0 ? 'Your activity across ARCTIS will show up here' : 'Try adjusting your search or filters'}
          />
        )}
        {isConnected && !loading && pageItems.length > 0 && (
          <>
            <div className="grid grid-cols-12 gap-4 px-6 py-3 text-surface-500 text-xs font-medium uppercase tracking-wider hidden sm:grid">
              <div className="col-span-1">Status</div>
              <div className="col-span-4">Event</div>
              <div className="col-span-2">Amount</div>
              <div className="col-span-3">Date</div>
              <div className="col-span-2 text-right">Link</div>
            </div>
            <motion.div key={page} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }} className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
              {pageItems.map((item) => (
                <div key={item.id}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-4 px-6 py-4 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors items-center">
                  <div className="sm:col-span-1 flex items-center gap-2">
                    <StatusIcon status={item.status} />
                    <span className="sm:hidden capitalize text-xs text-surface-600">{item.status}</span>
                  </div>
                  <div className="sm:col-span-4 min-w-0">
                    <div className="text-surface-950 text-sm font-medium truncate">{item.title}</div>
                    <div className="text-surface-600 text-xs truncate">{item.description}</div>
                  </div>
                  <div className="sm:col-span-2 font-mono text-sm">
                    {item.amount && <span className="text-surface-950 font-semibold">{item.amount} <span className="text-surface-600 font-normal text-xs">{item.token}</span></span>}
                    {item.credits !== undefined && item.credits !== 0 && (
                      <span className={cn('font-semibold', item.credits > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
                        {item.credits > 0 ? '+' : ''}{item.credits} cr
                      </span>
                    )}
                  </div>
                  <div className="sm:col-span-3 text-xs text-surface-600" title={formatDateTime(item.timestamp)}>
                    {formatRelative(item.timestamp)}
                  </div>
                  <div className="sm:col-span-2 flex items-center gap-2 sm:justify-end">
                    {item.txHash && (
                      <button onClick={() => { copyToClipboard(item.txHash!); toast.success('Hash copied'); }}
                        className="text-surface-500 hover:text-surface-950 transition-colors p-0.5">
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {(item.txHash || item.explorerUrl) && (
                      <a href={item.explorerUrl ?? `https://testnet.arcscan.app/tx/${item.txHash}`}
                        target="_blank" rel="noopener noreferrer"
                        className="text-surface-600 hover:text-blue-600 dark:hover:text-blue-400 transition-colors p-0.5 inline-block">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </motion.div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-6 py-3 border-t border-black/[0.05] dark:border-white/[0.05]">
              <span className="text-surface-500 text-xs">Page {page} of {totalPages}</span>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                  className="btn-ghost p-1.5 disabled:opacity-30 disabled:cursor-not-allowed">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="btn-ghost p-1.5 disabled:opacity-30 disabled:cursor-not-allowed">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
