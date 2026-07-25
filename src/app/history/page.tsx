'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ExternalLink,
  Copy,
  Filter,
  Trash2,
  Search,
  Download,
} from 'lucide-react';
import { exportCSV, exportJSON, exportPDF, exportExcel, exportTXT } from '@/lib/utils/export';
import { useAppStore } from '@/lib/store';
import { formatAddress, formatDateTime, getTxExplorerUrl, copyToClipboard, cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import type { TransactionRecord } from '@/types';

// ============================================================
// Transaction History Page
// ============================================================

type StatusFilter = 'all' | 'confirmed' | 'pending' | 'failed';

function TxStatusIcon({ status }: { status: TransactionRecord['status'] }) {
  switch (status) {
    case 'confirmed': return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
    case 'pending': return <Clock className="w-4 h-4 text-amber-400 animate-pulse" />;
    case 'failed': return <XCircle className="w-4 h-4 text-rose-400" />;
    default: return <AlertCircle className="w-4 h-4 text-surface-600" />;
  }
}

export default function HistoryPage() {
  const { transactions, clearTransactions } = useAppStore();
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      if (filter !== 'all' && tx.status !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          tx.toAddress.toLowerCase().includes(q) ||
          tx.txHash?.toLowerCase().includes(q) ||
          tx.amountFormatted.includes(q)
        );
      }
      return true;
    });
  }, [transactions, filter, search]);

  return (
    <div className="max-w-4xl space-y-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.22,1,0.36,1] }} className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1"><span className="text-surface-500 text-xs font-semibold uppercase tracking-widest">Stablecoin OS</span></div>
            <h1 className="text-2xl font-bold text-surface-950 tracking-tight">Transaction History</h1>
            <p className="text-surface-600 text-sm mt-1">{transactions.length} {transactions.length === 1 ? 'transaction' : 'transactions'} · All on-chain</p>
          </div>
          {transactions.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="relative group">
                <button className="btn-ghost gap-1.5 text-sm">
                  <Download className="w-3.5 h-3.5" /> Export
                </button>
                <div className="absolute right-0 top-full mt-1 w-36 glass-card p-1 z-20 hidden group-hover:block">
                  {[
                    { label: 'CSV',   fn: () => exportCSV(transactions.map((t) => ({ Date: t.createdAt, To: t.toAddress, Amount: t.amountFormatted, Token: t.token, Status: t.status, TxHash: t.txHash ?? '' })), 'arctis-history') },
                    { label: 'JSON',  fn: () => exportJSON(transactions, 'arctis-history') },
                    { label: 'Excel', fn: () => exportExcel(transactions.map((t) => ({ Date: t.createdAt, To: t.toAddress, Amount: t.amountFormatted, Token: t.token, Status: t.status })), 'arctis-history') },
                    { label: 'PDF',   fn: () => exportPDF(transactions.map((t) => ({ Date: t.createdAt.slice(0, 10), To: t.toAddress.slice(0, 14), Amount: `${t.amountFormatted} ${t.token}`, Status: t.status })), 'arctis-history', 'ARCTIS Transaction History') },
                    { label: 'TXT',   fn: () => exportTXT(transactions.map((t) => ({ Date: t.createdAt, To: t.toAddress, Amount: t.amountFormatted, Token: t.token, Status: t.status })), 'arctis-history') },
                  ].map(({ label, fn }) => (
                    <button key={label} onClick={fn} className="w-full text-left px-3 py-2 text-sm text-surface-700 hover:text-surface-950 hover:bg-white/[0.04] rounded-lg transition-colors">
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={() => { clearTransactions(); toast.success('History cleared'); }}
                className="btn-ghost text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/20 text-sm"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear
              </button>
            </div>
          )}
        </motion.div>

        {/* Filters */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-600" />
            <input
              type="text"
              placeholder="Search by address or hash..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-base pl-9"
            />
          </div>
          <div className="flex items-center gap-1 p-1 bg-surface-200/50 rounded-xl border border-white/[0.06]">
            {(['all', 'confirmed', 'pending', 'failed'] as StatusFilter[]).map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all',
                  filter === s
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'text-surface-600 hover:text-surface-950'
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Transaction list */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card overflow-hidden"
        >
          {filtered.length === 0 ? (
            <div className="py-16 text-center px-6">
              <div className="w-12 h-12 rounded-2xl bg-surface-300/40 flex items-center justify-center mx-auto mb-4">
                <Clock className="w-5 h-5 text-surface-600 opacity-60" />
              </div>
              <p className="text-surface-700 font-medium text-sm mb-1">
                {transactions.length === 0 ? 'No transactions yet' : 'No results'}
              </p>
              <p className="text-surface-500 text-xs">
                {transactions.length === 0 ? 'Send your first USDC to see history here' : 'Try adjusting your search or filter'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {/* Table header */}
              <div className="grid grid-cols-12 gap-4 px-6 py-3 text-surface-500 text-xs font-medium uppercase tracking-wider hidden sm:grid">
                <div className="col-span-1">Status</div>
                <div className="col-span-3">To</div>
                <div className="col-span-2">Amount</div>
                <div className="col-span-3">Hash</div>
                <div className="col-span-2">Date</div>
                <div className="col-span-1">Link</div>
              </div>

              {filtered.map((tx, i) => (
                <motion.div
                  key={tx.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-4 px-6 py-4 hover:bg-white/[0.02] transition-colors items-center"
                >
                  {/* Status */}
                  <div className="sm:col-span-1 flex items-center gap-2">
                    <TxStatusIcon status={tx.status} />
                    <span className="sm:hidden capitalize text-xs text-surface-600">{tx.status}</span>
                  </div>

                  {/* To */}
                  <div className="sm:col-span-3 font-mono text-sm text-surface-950">
                    <span className="sm:hidden text-surface-600 text-xs mr-2">To:</span>
                    {formatAddress(tx.toAddress, 6)}
                  </div>

                  {/* Amount */}
                  <div className="sm:col-span-2 font-mono text-sm font-semibold text-surface-950">
                    <span className="sm:hidden text-surface-600 text-xs mr-2">Amount:</span>
                    -{tx.amountFormatted} <span className="text-surface-600 font-normal text-xs">{tx.token ?? 'USDC'}</span>
                  </div>

                  {/* Hash */}
                  <div className="sm:col-span-3">
                    {tx.txHash ? (
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs text-surface-700">{formatAddress(tx.txHash, 6)}</span>
                        <button
                          onClick={() => { copyToClipboard(tx.txHash!); toast.success('Copied!'); }}
                          className="text-surface-500 hover:text-surface-950 transition-colors p-0.5"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-surface-500 text-xs">—</span>
                    )}
                  </div>

                  {/* Date */}
                  <div className="sm:col-span-2 text-xs text-surface-600">
                    {formatDateTime(tx.createdAt)}
                  </div>

                  {/* Explorer link */}
                  <div className="sm:col-span-1">
                    {tx.txHash && (
                      <a
                        href={getTxExplorerUrl(tx.txHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-surface-600 hover:text-blue-400 transition-colors p-1 inline-block"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
  );
}
