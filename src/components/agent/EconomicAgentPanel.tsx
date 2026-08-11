'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccount } from 'wagmi';
import { Bot, User, Send, ShieldCheck, Sparkles, Loader2 } from 'lucide-react';
import type { PendingFinancialAction } from '@/lib/store';
import { cn, generateId } from '@/lib/utils';
import toast from 'react-hot-toast';

// ============================================================
// ARCTIS Economic Agent — embedded, contextual financial execution panel.
// Understand → Clarify → Propose → Human Approve → Execute.
// The panel never signs or holds keys. After approval it invokes the
// existing Transfer/Swap/Bridge execution path supplied by the page.
// ============================================================

type LockedAction = 'transfer' | 'swap' | 'bridge';

const INTRO_COPY: Record<LockedAction, { prompt: string; examples: string[] }> = {
  transfer: {
    prompt: 'Choose how you want to transfer:',
    examples: [
      'Send USDC to a Passport',
      'Send USDC to a wallet address',
      'Transfer USDC to a Passport',
    ],
  },

  swap: {
    prompt: 'Choose a swap pair:',
    examples: [
      'Swap USDC to tUSDC',
      'Swap tUSDC to USDC',
      'Swap USDC to tARC',
      'Swap tARC to USDC',
      'Swap tUSDC to tARC',
      'Swap tARC to tUSDC',
    ],
  },

  bridge: {
    prompt: 'Choose a bridge route:',
    examples: [
      'Bridge USDC from Arc Testnet to Base Sepolia',
      'Bridge USDC from Arc Testnet to Arbitrum Sepolia',
      'Bridge USDC from Arc Testnet to Ethereum Sepolia',
      'Bridge USDC from Base Sepolia to Arc Testnet',
      'Bridge USDC from Arbitrum Sepolia to Arc Testnet',
      'Bridge USDC from Ethereum Sepolia to Arc Testnet',
    ],
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
        {action === 'bridge' && (
          <div className="flex justify-between">
            <span className="text-surface-600">USDC to burn</span>
            <span className="text-surface-950 font-mono font-semibold">{Number(proposal.amount).toFixed(6)} USDC</span>
          </div>
        )}
        {proposal.sourceChain && (
          <div className="flex justify-between">
            <span className="text-surface-600">From Chain</span>
            <span className="text-surface-950">{proposal.sourceChain}</span>
          </div>
        )}
        {proposal.destinationChain && (
          <div className="flex justify-between">
            <span className="text-surface-600">To Chain</span>
            <span className="text-surface-950">{proposal.destinationChain}</span>
          </div>
        )}
        {action !== 'bridge' && (
          <div className="flex justify-between">
            <span className="text-surface-600">Network</span>
            <span className="text-surface-950">Arc Testnet</span>
          </div>
        )}
        {action === 'bridge' && (
          <div className="flex justify-between">
            <span className="text-surface-600">Protocol</span>
            <span className="text-surface-950">Circle CCTP</span>
          </div>
        )}
      </div>
      <p className="text-surface-600 text-xs leading-relaxed">
        Nothing is signed yet. For bridge actions, the exact USDC burn amount is shown above and a native-gas preflight runs before the CCTP burn. Your wallet remains the final authorization boundary.
      </p>
      <div className="flex gap-2 pt-0.5">
        <button onClick={onCancel} className="btn-ghost text-xs px-3 py-2 flex-1">
          Cancel
        </button>
        <button onClick={onApprove} className="btn-primary text-xs px-3 py-2 flex-1">
          Review &amp; Execute
        </button>
      </div>
    </div>
  );
}

export type AgentExecutionStatus = 'idle' | 'executing' | 'success' | 'failed';

export function EconomicAgentPanel({
  action,
  onExecute,
  executionStatus = 'idle',
  executionError,
  executionTxHash,
}: {
  action: LockedAction;
  onExecute: (proposal: PendingFinancialAction) => void | Promise<void>;
  executionStatus?: AgentExecutionStatus;
  executionError?: string | null;
  executionTxHash?: string | null;
}) {
  const { address } = useAccount();

  const [messages, setMessages] = useState<AgentPanelMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingClarification, setPendingClarification] = useState<PendingFinancialAction | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleApprove = useCallback((proposal: PendingFinancialAction) => {
    void Promise.resolve(onExecute(proposal)).catch(() => {
      // The page owns the actual error state; this catch prevents an
      // unhandled promise rejection from the presentation layer.
    });
  }, [onExecute]);

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

      {executionStatus !== 'idle' && (
        <div className="mb-3 rounded-xl border border-black/[0.06] dark:border-white/[0.07] bg-surface-0/60 dark:bg-surface-200/50 p-3">
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-surface-500">
            <span className={cn('w-2 h-2 rounded-full', executionStatus === 'success' ? 'bg-emerald-500' : executionStatus === 'failed' ? 'bg-red-500' : 'bg-blue-500 animate-pulse')} />
            {executionStatus === 'executing' ? 'Executing with your wallet' : executionStatus === 'success' ? 'Confirmed' : 'Execution failed'}
          </div>
          {executionTxHash && <p className="mt-1 text-[11px] font-mono text-surface-600 break-all">TX: {executionTxHash}</p>}
          {executionError && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{executionError}</p>}
        </div>
      )}

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
