'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Bot, CheckCircle2, XCircle, Loader2, AlertCircle, Coins, Clock, Cpu } from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

export interface ProposalSummary {
  proposalId: string;
  agentId: string;
  agentName: string;
  agentType: string;
  task: string;
  estimatedCredits: number;
  currentCreditBalance: number;
  budgetRemaining: number;
  model: string;
  status: 'proposed';
  createdAt: string;
}

interface AgentProposalCardProps {
  proposal: ProposalSummary;
  walletAddress: string;
  onApproved: (result: { outputSummary: string; executionId: string }) => void;
  onRejected: () => void;
}

export function AgentProposalCard({ proposal, walletAddress, onApproved, onRejected }: AgentProposalCardProps) {
  const [deciding, setDeciding] = useState<'approve' | 'reject' | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  const willExceedBudget = isFinite(proposal.budgetRemaining) && proposal.estimatedCredits > proposal.budgetRemaining;
  const insufficientCredits = proposal.estimatedCredits > proposal.currentCreditBalance;
  const canApprove = !insufficientCredits && !willExceedBudget;

  const handleApprove = async () => {
    if (!canApprove) return;
    setDeciding('approve');
    try {
      const res = await fetch('/api/agents/approve', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId: proposal.proposalId, walletAddress, action: 'approve' }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Execution failed'); return; }
      toast.success('Agent task completed');
      onApproved({ outputSummary: data.outputSummary, executionId: data.executionId });
    } catch (err) { toast.error((err as Error).message); }
    finally { setDeciding(null); }
  };

  const handleReject = async () => {
    setDeciding('reject');
    try {
      const res = await fetch('/api/agents/approve', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId: proposal.proposalId, walletAddress, action: 'reject', reason: rejectReason || 'Rejected by owner' }),
      });
      if (!res.ok) { const data = await res.json(); toast.error(data.error ?? 'Failed to reject'); return; }
      toast.success('Task rejected');
      onRejected();
    } catch (err) { toast.error((err as Error).message); }
    finally { setDeciding(null); }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
      className="glass-card p-5 space-y-4 border border-blue-500/20 bg-blue-500/5">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-blue-500/15 flex items-center justify-center flex-shrink-0">
          <Bot className="w-5 h-5 text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-surface-950 text-sm font-semibold">{proposal.agentName}</p>
            <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full capitalize">{proposal.agentType}</span>
          </div>
          <p className="text-surface-500 text-[11px] mt-0.5 font-mono truncate">{proposal.model.split('/').pop()}</p>
        </div>
        <span className="text-[10px] text-blue-400 bg-blue-500/10 px-2 py-1 rounded-full whitespace-nowrap">Awaiting Review</span>
      </div>

      <div className="space-y-1">
        <p className="text-surface-600 text-[10px] uppercase tracking-wider">Task</p>
        <p className="text-surface-900 text-sm leading-relaxed">{proposal.task}</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className={cn('rounded-xl p-2.5 text-center space-y-0.5', insufficientCredits ? 'bg-rose-500/10 border border-rose-500/20' : 'bg-white/[0.04]')}>
          <div className="flex items-center justify-center gap-1"><Coins className="w-3 h-3 text-surface-500" /><p className="text-[10px] text-surface-500">Est. cost</p></div>
          <p className={cn('text-sm font-bold', insufficientCredits ? 'text-rose-400' : 'text-surface-950')}>{proposal.estimatedCredits}</p>
        </div>
        <div className="rounded-xl p-2.5 text-center space-y-0.5 bg-white/[0.04]">
          <div className="flex items-center justify-center gap-1"><Clock className="w-3 h-3 text-surface-500" /><p className="text-[10px] text-surface-500">Balance</p></div>
          <p className="text-sm font-bold text-surface-950">{proposal.currentCreditBalance}</p>
        </div>
        <div className={cn('rounded-xl p-2.5 text-center space-y-0.5', willExceedBudget ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-white/[0.04]')}>
          <div className="flex items-center justify-center gap-1"><Cpu className="w-3 h-3 text-surface-500" /><p className="text-[10px] text-surface-500">Budget left</p></div>
          <p className={cn('text-sm font-bold', willExceedBudget ? 'text-amber-400' : 'text-surface-950')}>{isFinite(proposal.budgetRemaining) ? proposal.budgetRemaining : '∞'}</p>
        </div>
      </div>

      {insufficientCredits && (
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
          <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" /><p className="text-rose-400 text-xs">Insufficient credits — top up before approving</p>
        </div>
      )}
      {willExceedBudget && !insufficientCredits && (
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" /><p className="text-amber-400 text-xs">This will exceed the agent&apos;s monthly budget</p>
        </div>
      )}

      {showRejectInput && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
          <input type="text" value={rejectReason} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRejectReason(e.target.value)} placeholder="Reason for rejection (optional)" className="input-field text-sm" />
        </motion.div>
      )}

      <div className="flex gap-2 pt-1">
        {!showRejectInput ? (
          <>
            <button onClick={() => setShowRejectInput(true)} disabled={!!deciding}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium bg-white/[0.05] hover:bg-rose-500/10 text-surface-600 hover:text-rose-400 border border-white/[0.06] hover:border-rose-500/20 transition-all disabled:opacity-40">
              <XCircle className="w-4 h-4" /> Reject
            </button>
            <button onClick={handleApprove} disabled={!canApprove || !!deciding}
              className={cn('flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-all',
                canApprove ? 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/20' : 'bg-white/[0.05] text-surface-500 cursor-not-allowed')}>
              {deciding === 'approve' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {deciding === 'approve' ? 'Running…' : 'Approve & Run'}
            </button>
          </>
        ) : (
          <>
            <button onClick={() => { setShowRejectInput(false); setRejectReason(''); }} disabled={!!deciding}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-white/[0.05] text-surface-600 hover:bg-white/[0.08] transition-all disabled:opacity-40">
              Cancel
            </button>
            <button onClick={handleReject} disabled={!!deciding}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold bg-rose-500 hover:bg-rose-400 text-white transition-all disabled:opacity-40">
              {deciding === 'reject' ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
              {deciding === 'reject' ? 'Rejecting…' : 'Confirm Reject'}
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
}
