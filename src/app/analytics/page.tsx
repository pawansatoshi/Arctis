'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { TrendingUp, Activity, BarChart3, Clock } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { formatDate } from '@/lib/utils';
import { format, subDays, startOfDay, isWithinInterval } from 'date-fns';

// ============================================================
// Analytics Page — Treasury Intelligence
// ============================================================

const CHART_COLORS = {
  blue: '#3b82f6',
  cyan: '#06b6d4',
  emerald: '#10b981',
  violet: '#8b5cf6',
  rose: '#f43f5e',
};

const CUSTOM_TOOLTIP_STYLE = {
  backgroundColor: '#1c1c1f',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '12px',
  color: '#f4f4f5',
  fontSize: '12px',
};

export default function AnalyticsPage() {
  const { transactions } = useAppStore();

  // Daily volume — last 30 days
  const dailyVolume = useMemo(() => {
    return Array.from({ length: 30 }, (_, i) => {
      const date = subDays(new Date(), 29 - i);
      const start = startOfDay(date);
      const end = new Date(start.getTime() + 86_400_000);
      const dayTxs = transactions.filter((tx) => {
        const d = new Date(tx.createdAt);
        return isWithinInterval(d, { start, end }) && tx.status === 'confirmed';
      });
      const volume = dayTxs.reduce((s, tx) => s + parseFloat(tx.amountFormatted), 0);
      return {
        date: format(date, 'MMM d'),
        volume: parseFloat(volume.toFixed(2)),
        count: dayTxs.length,
      };
    });
  }, [transactions]);

  // Status distribution
  const statusDist = useMemo(() => {
    const confirmed = transactions.filter((t) => t.status === 'confirmed').length;
    const pending = transactions.filter((t) => t.status === 'pending').length;
    const failed = transactions.filter((t) => t.status === 'failed').length;
    return [
      { name: 'Confirmed', value: confirmed, color: CHART_COLORS.emerald },
      { name: 'Pending', value: pending, color: CHART_COLORS.violet },
      { name: 'Failed', value: failed, color: CHART_COLORS.rose },
    ].filter((d) => d.value > 0);
  }, [transactions]);

  // Summary metrics
  const totalVolume = transactions
    .filter((t) => t.status === 'confirmed')
    .reduce((s, t) => s + parseFloat(t.amountFormatted), 0);

  const avgAmount = transactions.length > 0
    ? totalVolume / transactions.filter((t) => t.status === 'confirmed').length || 0
    : 0;

  const successRate = transactions.length > 0
    ? (transactions.filter((t) => t.status === 'confirmed').length / transactions.length) * 100
    : 0;

  return (
    <div className="max-w-5xl space-y-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2 mb-1"><span className="text-surface-500 text-xs font-semibold uppercase tracking-widest">Overview</span></div>
        <h1 className="text-2xl font-bold tracking-tight text-surface-950">Analytics</h1>
          <p className="text-surface-600 text-sm mt-1">Operational intelligence and treasury insights</p>
        </motion.div>

        {/* Summary metrics */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {[
            { label: 'Total Volume', value: `${totalVolume.toFixed(2)} USDC`, icon: TrendingUp, color: 'text-blue-400', bg: 'bg-blue-500/10' },
            { label: 'Avg Transfer', value: `${avgAmount.toFixed(2)} USDC`, icon: Activity, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
            { label: 'Success Rate', value: `${successRate.toFixed(0)}%`, icon: BarChart3, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
            { label: 'Total Txns', value: `${transactions.length}`, icon: Clock, color: 'text-violet-400', bg: 'bg-violet-500/10' },
          ].map((m) => (
            <div key={m.label} className="metric-card">
              <div className="flex items-center justify-between">
                <span className="text-surface-600 text-xs font-medium uppercase tracking-wider">{m.label}</span>
                <div className={`w-7 h-7 rounded-lg ${m.bg} flex items-center justify-center`}>
                  <m.icon className={`w-3.5 h-3.5 ${m.color}`} />
                </div>
              </div>
              <div className="text-xl font-bold text-surface-950 font-mono">{m.value}</div>
            </div>
          ))}
        </motion.div>

        {/* Volume chart */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-6"
        >
          <h2 className="text-surface-950 font-semibold mb-6">30-Day Transfer Volume</h2>
          {transactions.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-surface-600 text-sm">
              No transaction data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={dailyVolume}>
                <defs>
                  <linearGradient id="volumeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.blue} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={CHART_COLORS.blue} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#71717a', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  interval={4}
                />
                <YAxis
                  tick={{ fill: '#71717a', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `$${v}`}
                />
                <Tooltip
                  contentStyle={CUSTOM_TOOLTIP_STYLE}
                  formatter={(v: number) => [`${v} USDC`, 'Volume']}
                />
                <Area
                  type="monotone"
                  dataKey="volume"
                  stroke={CHART_COLORS.blue}
                  strokeWidth={2}
                  fill="url(#volumeGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        {/* Bottom row */}
        <div className="grid lg:grid-cols-2 gap-4">
          {/* Bar chart — daily count */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="glass-card p-6"
          >
            <h2 className="text-surface-950 font-semibold mb-6">Daily Transaction Count</h2>
            {transactions.length === 0 ? (
              <div className="h-36 flex items-center justify-center text-surface-600 text-sm">No data</div>
            ) : (
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={dailyVolume.slice(-14)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="date" tick={{ fill: '#71717a', fontSize: 10 }} tickLine={false} axisLine={false} interval={2} />
                  <YAxis tick={{ fill: '#71717a', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} formatter={(v: number) => [v, 'Transactions']} />
                  <Bar dataKey="count" fill={CHART_COLORS.cyan} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </motion.div>

          {/* Pie chart — status distribution */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-card p-6"
          >
            <h2 className="text-surface-950 font-semibold mb-6">Status Distribution</h2>
            {statusDist.length === 0 ? (
              <div className="h-36 flex items-center justify-center text-surface-600 text-sm">No data</div>
            ) : (
              <div className="flex items-center gap-6">
                <ResponsiveContainer width={140} height={140}>
                  <PieChart>
                    <Pie
                      data={statusDist}
                      cx="50%"
                      cy="50%"
                      innerRadius={42}
                      outerRadius={60}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {statusDist.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-3 flex-1">
                  {statusDist.map((d) => (
                    <div key={d.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                        <span className="text-surface-700 text-xs">{d.name}</span>
                      </div>
                      <span className="text-surface-950 font-mono text-xs font-medium">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </div>

        {/* Phase 2/3 placeholder */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="glass-card p-6 border-dashed border-white/[0.1]"
        >
          <div className="text-center py-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs mb-3">
              Phase 2 — Coming Soon
            </div>
            <h3 className="text-surface-950 font-semibold mb-2">Advanced Treasury Intelligence</h3>
            <p className="text-surface-600 text-sm max-w-md mx-auto">
              Treasury controls, multi-asset monitoring, predictive cash flow analytics, and AI copilot integration.
            </p>
          </div>
        </motion.div>
      </div>
  );
}
