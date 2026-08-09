'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Building2, TrendingUp, TrendingDown, ArrowUpRight,
  Coins, Users, Activity, RefreshCw, Clock,
  CheckCircle2, XCircle, CreditCard, Download,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useAccount } from 'wagmi';
import { useUSDCBalance } from '@/lib/hooks/useUSDCBalance';
import { exportCSV, exportJSON } from '@/lib/utils/export';
import { useAppStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/ThemeProvider';
import type { AppState } from '@lib/store';
import { cn, formatRelative } from '@/lib/utils';
import type { TreasuryLog } from '@/types';

function getTooltipStyle(isDark: boolean) {
  return {
    backgroundColor: isDark ? '#1c1c1f' : '#ffffff',
    border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(15,23,42,0.08)',
    borderRadius: '12px',
    color: isDark ? '#f4f4f5' : '#16171b',
    fontSize: '12px',
    boxShadow: isDark ? 'none' : '0 4px 16px rgba(15,23,42,0.1)',
  };
}

// Simulated 30-day cash flow data derived from real transactions
function buildCashFlow(transactions: AppState['transactions']) {
  return Array.from({ length: 30 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (29 - i));
    const dayStr = date.toISOString().slice(0, 10);
    const dayTxs = transactions.filter((t) =>
      t.createdAt.startsWith(dayStr) && t.status === 'confirmed'
    );
    const outflow = dayTxs.reduce((s, t) => s + parseFloat(t.amountFormatted || '0'), 0);
    return {
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      inflow: 0,
      outflow: parseFloat(outflow.toFixed(2)),
      net: -parseFloat(outflow.toFixed(2)),
    };
  });
}

export default function TreasuryPage() {
  const { isConnected } = useAccount();
  const { formatted: usdcBalance, raw: rawBalance, refetch } = useUSDCBalance();
  const { transactions, membership, creditBalance } = useAppStore();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [logs, setLogs] = useState<TreasuryLog[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const cashFlow = buildCashFlow(transactions);
  const totalOutflow30d = cashFlow.reduce((s, d) => s + d.outflow, 0);
  const confirmedTxCount = transactions.filter((t) => t.status === 'confirmed').length;
  const failedTxCount = transactions.filter((t) => t.status === 'failed').length;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setTimeout(() => setIsRefreshing(false), 800);
  };

  // Load treasury logs from API
  useEffect(() => {
    fetch('/api/treasury').then((r) => r.json()).then((d) => {
      if (d.logs) setLogs(d.logs);
    }).catch(() => {});
  }, []);

  const metrics = [
    {
      label: 'USDC Balance',
      value: `${usdcBalance} USDC`,
      icon: Building2,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-500/10',
      sub: 'Arc Testnet',
    },
    {
      label: '30D Outflow',
      value: `${totalOutflow30d.toFixed(2)} USDC`,
      icon: TrendingDown,
      color: 'text-rose-600 dark:text-rose-400',
      bg: 'bg-rose-500/10',
      sub: `${confirmedTxCount} transactions`,
    },
    {
      label: 'Credit Balance',
      value: creditBalance ? `${creditBalance.remaining.toLocaleString()} credits` : '—',
      icon: Coins,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-500/10',
      sub: creditBalance ? `${creditBalance.used} used` : 'Not loaded',
    },
    {
      label: 'Membership',
      value: membership?.tier ? membership.tier.charAt(0).toUpperCase() + membership.tier.slice(1) : 'Free',
      icon: CreditCard,
      color: 'text-violet-600 dark:text-violet-400',
      bg: 'bg-violet-500/10',
      sub: membership?.status ?? 'active',
    },
  ];

  return (
    <div className="max-w-6xl space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1"><span className="text-surface-500 text-xs font-semibold uppercase tracking-widest">Finance</span></div>
          <h1 className="text-2xl font-bold tracking-tight text-surface-950">Treasury</h1>
          <p className="text-surface-600 text-sm mt-1">Financial operations & USDC position</p>
        </div>
        <div className="flex items-center gap-2">
          {logs.length > 0 && (
            <>
              <button onClick={() => exportCSV(logs.map((l) => ({ Date: l.createdAt, Type: l.type, Amount: l.amount, Description: l.description, TxHash: l.txHash ?? '' })), 'arctis-treasury')}
                className="btn-ghost text-xs py-1.5 gap-1.5">
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
              <button onClick={() => exportJSON(logs, 'arctis-treasury')}
                className="btn-ghost text-xs py-1.5 gap-1.5">
                <Download className="w-3.5 h-3.5" /> JSON
              </button>
            </>
          )}
          <button onClick={handleRefresh} className={cn('btn-ghost', isRefreshing && 'opacity-50')}>
            <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
          </button>
        </div>
      </motion.div>

      {/* Metrics */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <div key={m.label} className="metric-card">
            <div className="flex items-center justify-between">
              <span className="text-surface-600 text-xs uppercase tracking-wider">{m.label}</span>
              <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', m.bg)}>
                <m.icon className={cn('w-3.5 h-3.5', m.color)} />
              </div>
            </div>
            <div className="text-xl font-bold text-surface-950 font-mono leading-tight">{m.value}</div>
            <div className="text-surface-600 text-xs">{m.sub}</div>
          </div>
        ))}
      </motion.div>

      {/* Cash Flow Chart */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }} className="glass-card p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-surface-950 font-semibold">30-Day Cash Flow</h2>
          <span className="text-surface-600 text-xs">USDC outflow</span>
        </div>
        {transactions.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-surface-600 text-sm">
            <div className="text-center">
              <Activity className="w-8 h-8 mx-auto mb-2 opacity-40" />
              No transaction data yet
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={cashFlow}>
              <defs>
                <linearGradient id="outflowGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.06)'} />
              <XAxis dataKey="date" tick={{ fill: '#71717a', fontSize: 10 }} tickLine={false} axisLine={false} interval={5} />
              <YAxis tick={{ fill: '#71717a', fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={getTooltipStyle(isDark)} formatter={(v: number) => [`${v} USDC`, 'Outflow']} />
              <Area type="monotone" dataKey="outflow" stroke="#f43f5e" strokeWidth={2} fill="url(#outflowGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </motion.div>

      {/* Tx Health + Logs */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Transaction Health */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }} className="glass-card p-6">
          <h2 className="text-surface-950 font-semibold mb-4">Transaction Health</h2>
          <div className="space-y-3">
            {[
              { label: 'Confirmed', count: confirmedTxCount, icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
              { label: 'Pending', count: transactions.filter((t) => t.status === 'pending').length, icon: Clock, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10' },
              { label: 'Failed', count: failedTxCount, icon: XCircle, color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-500/10' },
            ].map((s) => (
              <div key={s.label} className="flex items-center justify-between p-3 rounded-xl bg-surface-200/30">
                <div className="flex items-center gap-3">
                  <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', s.bg)}>
                    <s.icon className={cn('w-3.5 h-3.5', s.color)} />
                  </div>
                  <span className="text-surface-950 text-sm">{s.label}</span>
                </div>
                <span className="font-mono font-bold text-surface-950">{s.count}</span>
              </div>
            ))}
            <div className="pt-2 flex items-center justify-between text-xs">
              <span className="text-surface-600">Success Rate</span>
              <span className="text-surface-950 font-mono font-bold">
                {transactions.length > 0
                  ? `${((confirmedTxCount / transactions.length) * 100).toFixed(0)}%`
                  : '—'}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Treasury Logs */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }} className="glass-card p-6">
          <h2 className="text-surface-950 font-semibold mb-4">Treasury Logs</h2>
          {logs.length === 0 ? (
            <div className="py-8 text-center text-surface-600 text-sm">
              <Activity className="w-6 h-6 mx-auto mb-2 opacity-40" />
              No treasury events yet
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {logs.slice(0, 20).map((log) => (
                <div key={log.id} className="flex items-center justify-between py-2 border-b border-black/[0.04] dark:border-white/[0.04]">
                  <div>
                    <div className="text-surface-950 text-xs font-medium">{log.description}</div>
                    <div className="text-surface-500 text-xs">{formatRelative(log.createdAt)}</div>
                  </div>
                  <span className={cn('font-mono text-sm font-bold',
                    log.type === 'ai_spend' ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                  )}>
                    {log.type === 'ai_spend' ? '-' : '+'}{log.amount} USDC
                  </span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* Treasury Health Score */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }} className="glass-card p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-surface-950 font-semibold">Treasury Health</h2>
            <p className="text-surface-600 text-sm mt-1">Operational status across all systems</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">
              {transactions.length === 0 ? '—' : `${Math.min(100, Math.round((confirmedTxCount / Math.max(1, transactions.length)) * 100))}`}
              {transactions.length > 0 && <span className="text-surface-600 text-base font-normal">/100</span>}
            </div>
            <div className="text-surface-600 text-xs mt-1">Health Score</div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-4">
          {[
            { label: 'USDC Position', status: parseFloat(usdcBalance) >= 0 ? 'healthy' : 'warning' },
            { label: 'Tx Reliability', status: failedTxCount === 0 ? 'healthy' : 'warning' },
            { label: 'Network', status: 'healthy' },
          ].map((item) => (
            <div key={item.label} className="p-3 rounded-xl bg-surface-200/30 text-center">
              <div className={cn('text-xs font-medium mb-1',
                item.status === 'healthy' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
              )}>
                {item.status === 'healthy' ? '● Healthy' : '● Warning'}
              </div>
              <div className="text-surface-700 text-xs">{item.label}</div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
