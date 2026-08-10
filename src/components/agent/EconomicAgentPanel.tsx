'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccount } from 'wagmi';
import { Bot, User, Send, ShieldCheck, Sparkles, Loader2 } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import type { PendingFinancialAction } from '@/lib/store';
import { cn, generateId } from '@/lib/utils';
import toast from 'react-hot-toast';

// ============================================================
// ARCTIS Economic Agent — embedded, contextual chat panel
// ============================================================
// This is the "Economic Agent" mode for Transfer / Swap / Bridge.
// It is an orchestration layer only:
//   Understand → Propose → Approve → Execute
// It never signs a transaction and never talks to the blockchain
// directly. "Approve" just hands the parsed, validated plan to the
// SAME existing manual Transfer/Swap/Bridge form via the existing
// `pendingAction` store hand-off — from there it's the same real
// wallet flow the Manual tab already uses.
//
// `action` locks this panel to a single financial action so a
// message like "transfer" is never routed to the generic LLM (which
// would otherwise answer with bank/school/file-transfer explanations
// unrelated to USDC). See lockedAction handling in
// /api/ai/chat/route.ts.
// ============================================================

type LockedAction = 'transfer' | 'swap' | 'bridge';

const INTRO_COPY: Record<LockedAction, { prompt: string; examples: string[] }> = {
  transfer: {
    prompt: 'What would you like to transfer?',
    examples: ['Send 5 USDC to 0x742d...1234', 'Transfer 2 USDC to 0x...'],
  },
  swap: {
    prompt: 'What would you like to swap?',
    examples: ['Swap 5 USDC to tUSDC', 'Swap 10 USDC for tARC'],
  },
  bridge: {
    prompt: 'What would you like to bridge?',
    examples: ['Bridge 0.1 USDC from Base Sepolia', 'Bridge 5 USDC from Ethereum Sepolia'],
  },
};

const PROPOSAL_TITLE: Record<LockedAction, string> = {
  transfer: 'Transfer Proposal',
  swap: 'Swap Proposal',
  bridge: 'Bridge Proposal',
};

interface AgentPanelMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  proposal?: PendingFinancialAction;
}

function ProposalCard({
  action,
  proposal,
  onApprove,
  onCancel,
}: {
  action: LockedAction;
  proposal: PendingFinancialAction;
  onApprove: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="mt-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.07] dark:bg-amber-500/[0.08] p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-lg bg-amber-500/15 flex items-center justify-center flex-shrink-0">
          <ShieldCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
        </div>
        <span className="text-amber-700 dark:text-amber-400 text-xs font-semibold uppercase tracking-wide">
          {PROPOSAL_TITLE[action]}
        </span>
      </div>
      <div className="space-y-1.5 text-sm bg-surface-0/60 dark:bg-black/10 rounded-lg p-3">
        <div className="flex justify-between">
          <span className="text-surface-600">Amount</span>
          <span className="text-surface-950 font-mono">{proposal.amount} {proposal.fromToken}</span>
        </div>
        {proposal.toToken && (
          <div className="flex justify-between">
            <span className="text-surface-600">To Token</span>
            <span className="text-surface-950 font-mono">{proposal.toToken}</span>
          </div>
        )}
        {proposal.recipient && (
          <div className="flex justify-between">
            <span className="text-surface-600">Recipient</span>
            <span className="text-surface-950 font-mono text-xs">
              {proposal.recipient.slice(0, 8)}…{proposal.recipient.slice(-6)}
            </span>
          </div>
        )}
        {proposal.sourceChain && (
          <div className="flex justify-between">
            <span className="text-surface-600">From Chain</span>
            <span className="text-surface-950">{proposal.sourceChain}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-surface-600">Network</span>
          <span className="text-surface-950">Arc Testnet</span>
        </div>
        {action === 'bridge' && (
          <div className="flex justify-between">
            <span className="text-surface-600">Protocol</span>
            <span className="text-surface-950">Circle CCTP</span>
          </div>
        )}
      </div>
      <p className="text-surface-600 text-xs leading-relaxed">
        Nothing is signed yet. Approving switches to the Manual tab, pre-filled — you still review and sign with your own wallet there.
      </p>
      <div className="flex gap-2 pt-0.5">
        <button onClick={onCancel} className="btn-ghost text-xs px-3 py-2 flex-1">
          Cancel
        </button>
        <button onClick={onApprove} className="btn-primary text-xs px-3 py-2 flex-1">
          Review &amp; Approve
        </button>
      </div>
    </div>
  );
}

export function EconomicAgentPanel({
  action,
  onApproved,
}: {
  action: LockedAction;
  onApproved: () => void;
}) {
  const { address } = useAccount();
  const setPendingAction = useAppStore((s) => s.setPendingAction);

  const [messages, setMessages] = useState<AgentPanelMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingClarification, setPendingClarification] = useState<PendingFinancialAction | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleApprove = useCallback((proposal: PendingFinancialAction) => {
    setPendingAction(proposal);
    toast.success('Proposal approved — review and sign in Manual mode');
    onApproved();
  }, [setPendingAction, onApproved]);

  const handleCancel = useCallback((msgId: string) => {
    setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, proposal: undefined } : m)));
  }, []);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    const userMsg: AgentPanelMessage = { id: generateId(), role: 'user', content: trimmed };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history.map((m) => ({ role: m.role, content: m.content })),
          mode: 'build',
          walletAddress: address,
          stream: false,
          lockedAction: action,
          pendingAction: pendingClarification ?? undefined,
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setPendingClarification(data.clarification ?? null);

      const assistantMsg: AgentPanelMessage = {
        id: generateId(),
        role: 'assistant',
        content: data.content ?? '',
        proposal: data.actionProposal ?? undefined,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const e = err as Error;
      setMessages((prev) => [...prev, {
        id: generateId(),
        role: 'assistant',
        content: `Error: ${e.message}. Please try again.`,
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading, address, action, pendingClarification]);

  const { prompt, examples } = INTRO_COPY[action];

  return (
    <div className="glass-card p-5 flex flex-col" style={{ minHeight: '460px' }}>
      <div className="flex items-center gap-2.5 mb-1">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500/15 to-blue-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-4 h-4 text-violet-600 dark:text-violet-400" />
        </div>
        <div>
          <div className="text-surface-950 text-sm font-semibold tracking-tight">ARCTIS Economic Agent</div>
          <div className="text-surface-500 text-[11px]">Understand → Propose → Approve → Execute</div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto py-4 space-y-4 min-h-[220px]">
        {messages.length === 0 && (
          <div className="text-center py-8 px-2">
            <p className="text-surface-700 text-sm font-medium mb-3">{prompt}</p>
            <p className="text-surface-500 text-xs mb-2">You can say:</p>
            <div className="space-y-1.5">
              {examples.map((ex) => (
                <button
                  key={ex}
                  onClick={() => send(ex)}
                  className="block w-full text-left px-3 py-2 rounded-lg glass-card-hover text-surface-700 text-xs font-mono hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  &quot;{ex}&quot;
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn('flex gap-2.5', msg.role === 'user' && 'flex-row-reverse')}
          >
            <div className={cn(
              'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 border',
              msg.role === 'user' ? 'bg-blue-500/15 border-blue-500/20' : 'bg-gradient-to-br from-violet-500/15 to-blue-500/10 border-violet-500/20'
            )}>
              {msg.role === 'user'
                ? <User className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                : <Bot className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />}
            </div>
            <div className={cn('flex-1 max-w-[85%]', msg.role === 'user' && 'flex flex-col items-end')}>
              <div className={cn(
                'px-3.5 py-2.5 text-sm leading-relaxed rounded-2xl',
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-tr-md'
                  : 'bg-surface-0 border border-black/[0.06] dark:border-white/[0.07] dark:bg-surface-200/70 text-surface-950 rounded-tl-md'
              )}>
                <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                {msg.proposal && (
                  <ProposalCard
                    action={action}
                    proposal={msg.proposal}
                    onApprove={() => handleApprove(msg.proposal!)}
                    onCancel={() => handleCancel(msg.id)}
                  />
                )}
              </div>
            </div>
          </motion.div>
        ))}

        <AnimatePresence>
          {isLoading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex gap-2.5">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500/15 to-blue-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                <Loader2 className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400 animate-spin" />
              </div>
              <div className="px-3.5 py-2.5 rounded-2xl rounded-tl-md bg-surface-0 dark:bg-surface-200/70 border border-black/[0.06] dark:border-white/[0.07] text-surface-500 text-sm">
                Thinking…
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-black/[0.04] dark:border-white/[0.04]">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
          placeholder={`Tell the agent what to ${action}...`}
          disabled={isLoading}
          className="input-base flex-1 text-sm"
        />
        <button
          onClick={() => send(input)}
          disabled={isLoading || !input.trim()}
          className="btn-primary px-3 py-2.5 disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
