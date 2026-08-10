'use client';

import { Wallet, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================
// ModeTabs — Manual / Economic Agent switcher
// ============================================================
// Shared by Transfer, Swap, and Bridge pages. Both modes are two
// front ends onto the exact same existing execution flow for that
// page — this component only toggles which one is shown; it never
// owns any transaction logic itself.
// ============================================================

export type ExecutionMode = 'manual' | 'agent';

export function ModeTabs({
  mode,
  onChange,
}: {
  mode: ExecutionMode;
  onChange: (mode: ExecutionMode) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-surface-200/50 border border-black/[0.04] dark:border-white/[0.04]">
      <button
        onClick={() => onChange('manual')}
        className={cn(
          'flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
          mode === 'manual'
            ? 'bg-surface-0 text-surface-950 shadow-sm'
            : 'text-surface-600 hover:text-surface-950'
        )}
      >
        <Wallet className="w-3.5 h-3.5" />
        Manual
      </button>
      <button
        onClick={() => onChange('agent')}
        className={cn(
          'flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
          mode === 'agent'
            ? 'bg-surface-0 text-surface-950 shadow-sm'
            : 'text-surface-600 hover:text-surface-950'
        )}
      >
        <Sparkles className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
        Economic Agent
      </button>
    </div>
  );
}
