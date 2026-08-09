'use client';

import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}

/**
 * Consistent empty state used across History, Activity, Credits, Agents,
 * Workspace, etc. — icon in a soft rounded tile, title, short description,
 * optional single action.
 */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className={cn('flex flex-col items-center justify-center text-center py-16 px-6', className)}
    >
      <div className="w-12 h-12 rounded-2xl bg-surface-300/40 border border-black/[0.06] dark:border-white/[0.06] flex items-center justify-center mb-4">
        <Icon className="w-5 h-5 text-surface-600 opacity-70" />
      </div>
      <p className="text-surface-700 font-medium text-sm mb-1">{title}</p>
      {description && <p className="text-surface-500 text-xs max-w-xs">{description}</p>}
      {action && (
        <button onClick={action.onClick} className="btn-ghost text-xs mt-4">
          {action.label}
        </button>
      )}
    </motion.div>
  );
}
