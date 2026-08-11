'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccount } from 'wagmi';
import { Bot, User, Send, ShieldCheck, Sparkles, Loader2, Route, CircleDollarSign, ExternalLink } from 'lucide-react';
import type { PendingFinancialAction } from '@/lib/store';
import { isCircleSwapToken } from '@/lib/swap/circle';
import { cn, generateId } from '@/lib/utils';

type LockedAction = 'transfer' | 'swap' | 'bridge';

const BRIDGE_NETWORKS = ['Arc Testnet', 'Ethereum Sepolia', 'Base Sepolia', 'Arbitrum Sepolia'] as const;

const INTRO_COPY: Record<LockedAction, { prompt: string; examples: string[] }> = {
  transfer: { prompt: 'Enter the recipient and amount below, or tell me who should receive the USDC and how much.', examples: ['Send 2 USDC to alice.arc', 'Send 5 USDC to 0x…', 'Send USDC to a Passport'] },
  swap: { prompt: 'Tell me the asset pair and amount. I will quote first, then ask you to approve.', examples: ['Swap 10 USDC to EURC', 'Swap 0.01 USDC to cirBTC', 'Swap 25 USDC to tUSDC', 'Swap 1 tARC to USDC'] },
  bridge: { prompt: 'Enter an amount below or tell me the USDC amount and source → destination route.', examples: ['Bridge 2 USDC from Arc Testnet to Base Sepolia', 'Bridge 5 USDC from Base Sepolia to Arc Testnet', 'Bridge 1 USDC from Arc Testnet to Arbitrum Sepolia'] },
};

const PROPOSAL_TITLE: Record<LockedAction, string> = { transfer: 'Transfer Proposal', swap: 'Swap Proposal', bridge: 'Bridge Proposal' };
interface AgentPanelMessage { id: string; role: 'user' | 'assistant'; content: string; proposal?: PendingFinancialAction; }

function isWalletAddress(value: string): boolean { return /^0x[a-fA-F0-9]{40}$/.test(value.trim()); }

async function verifyPassportRecipient(value: string): Promise<string> {
  const username = value.trim().toLowerCase().replace(/^@/, '').replace(/\.arc$/, '');
  const response = await fetch(`/api/passport/resolve?username=${encodeURIComponent(username)}`);
  let data: { username?: string; walletAddress?: string; error?: string } = {};
  try { data = await response.json(); } catch { /* explicit error below */ }
  if (!response.ok || !data.walletAddress || !isWalletAddress(data.walletAddress)) throw new Error(data.error || `Passport not found: ${username}.arc`);
  return `${(data.username || username).toLowerCase()}.arc`;
}

function ProposalCard({ action, proposal, onApprove, onCancel }: { action: LockedAction; proposal: PendingFinancialAction; onApprove: () => void; onCancel: () => void }) {
  const circleRail = action === 'swap' && isCircleSwapToken(proposal.fromToken) && isCircleSwapToken(proposal.toToken);
  const recipient = proposal.recipient ?? '';
  const recipientLabel = isWalletAddress(recipient) ? `${recipient.slice(0, 8)}…${recipient.slice(-6)}` : recipient;
  return <div className="mt-3 rounded-2xl border border-amber-500/25 bg-amber-500/[0.07] dark:bg-amber-500/[0.08] p-4 space-y-3">
    <div className="flex items-center gap-2"><div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center"><ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" /></div><div><span className="text-amber-700 dark:text-amber-400 text-xs font-semibold uppercase tracking-wide">{PROPOSAL_TITLE[action]}</span><p className="text-[10px] text-surface-500">Nothing has been signed</p></div></div>
    <div className="space-y-1.5 text-sm bg-surface-0/60 dark:bg-black/10 rounded-xl p-3">
      <div className="flex justify-between"><span className="text-surface-600">Amount</span><span className="text-surface-950 font-mono font-semibold">{proposal.amount} {proposal.fromToken}</span></div>
      {proposal.toToken && <div className="flex justify-between"><span className="text-surface-600">Receive</span><span className="text-surface-950 font-mono">{proposal.toToken}</span></div>}
      {proposal.recipient && <div className="flex justify-between gap-4"><span className="text-surface-600">Recipient</span><span className={cn('font-mono text-xs truncate', !isWalletAddress(recipient) && 'text-emerald-700 dark:text-emerald-400')}>{recipientLabel}{!isWalletAddress(recipient) && ' ✓'}</span></div>}
      {proposal.sourceChain && <div className="flex justify-between"><span className="text-surface-600">From</span><span className="text-surface-950">{proposal.sourceChain}</span></div>}
      {proposal.destinationChain && <div className="flex justify-between"><span className="text-surface-600">To</span><span className="text-surface-950">{proposal.destinationChain}</span></div>}
      {action === 'bridge' && <div className="flex justify-between"><span className="text-surface-600">Execution</span><span className="text-emerald-600 font-medium">CCTP + Forwarding</span></div>}
      {action === 'swap' && <div className="flex justify-between items-center"><span className="text-surface-600">Execution</span><span className="text-surface-950 font-medium flex items-center gap-1">{circleRail ? <><CircleDollarSign className="w-3.5 h-3.5 text-blue-600" /> Circle App Kit</> : <><Route className="w-3.5 h-3.5 text-violet-600" /> ARCTIS OTC</>}</span></div>}
    </div>
    <p className="text-surface-600 text-xs leading-relaxed">The agent only prepares and explains the transaction. Live balance/fee/reserve checks run before execution. Your wallet is the final authorization boundary.</p>
    <div className="flex gap-2"><button onClick={onCancel} className="btn-ghost text-xs px-3 py-2 flex-1">Cancel</button><button onClick={onApprove} className="btn-primary text-xs px-3 py-2 flex-1">Review &amp; Execute</button></div>
  </div>;
}

function BridgeNetworkChoices({ missing, sourceChain, onSelect, disabled }: { missing?: PendingFinancialAction['missing']; sourceChain?: string; onSelect: (network: string) => void; disabled: boolean }) {
  if (missing !== 'sourceChain' && missing !== 'destinationChain') return null;
  const choosingSource = missing === 'sourceChain';
  const options = choosingSource ? BRIDGE_NETWORKS : BRIDGE_NETWORKS.filter((network) => network !== sourceChain);
  return <div className="mt-3 rounded-xl border border-blue-500/15 bg-blue-500/[.04] p-3 text-left">
    <div className="flex items-center justify-between mb-2"><span className="text-[11px] font-semibold uppercase tracking-wider text-surface-500">{choosingSource ? 'Bridge from' : 'Bridge to'}</span><span className="text-[10px] text-surface-400">Tap a network</span></div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {options.map((network) => <button key={network} type="button" disabled={disabled} onClick={() => onSelect(network)} className="w-full rounded-lg border border-black/[.06] dark:border-white/[.08] bg-surface-0 dark:bg-surface-200/70 px-3 py-2.5 text-left text-xs font-medium text-surface-800 dark:text-surface-100 hover:border-blue-500/40 hover:bg-blue-500/[.06] hover:text-blue-600 dark:hover:text-blue-400 transition-colors disabled:opacity-50 disabled:cursor-wait"><span className="block">{network}</span></button>)}
    </div>
  </div>;
}

export type AgentExecutionStatus = 'idle' | 'executing' | 'success' | 'failed';

export function EconomicAgentPanel({ action, onExecute, executionStatus = 'idle', executionError, executionTxHash }: { action: LockedAction; onExecute: (proposal: PendingFinancialAction) => void | Promise<void>; executionStatus?: AgentExecutionStatus; executionError?: string | null; executionTxHash?: string | null }) {
  const { address } = useAccount();
  const [messages, setMessages] = useState<AgentPanelMessage[]>([]);
  const [input, setInput] = useState('');
  const [bridgeAmount, setBridgeAmount] = useState('');
  const [transferRecipient, setTransferRecipient] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingClarification, setPendingClarification] = useState<PendingFinancialAction | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [messages, isLoading]);
  const handleApprove = useCallback((proposal: PendingFinancialAction) => { void Promise.resolve(onExecute(proposal)).catch(() => {}); }, [onExecute]);
  const handleCancel = useCallback((msgId: string) => { setMessages((prev) => prev.map((m) => m.id === msgId ? { ...m, proposal: undefined } : m)); setPendingClarification(null); }, []);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim(); if (!trimmed || isLoading) return;
    const userMsg: AgentPanelMessage = { id: generateId(), role: 'user', content: trimmed };
    const history = [...messages, userMsg];
    setMessages(history); setInput(''); setIsLoading(true);
    try {
      const res = await fetch('/api/ai/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: history.map((m) => ({ role: m.role, content: m.content })), mode: 'build', walletAddress: address, stream: false, lockedAction: action, pendingAction: pendingClarification ?? undefined }) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      let proposal = data.actionProposal as PendingFinancialAction | undefined;
      if (proposal?.action === 'transfer' && proposal.recipient && !isWalletAddress(proposal.recipient)) proposal = { ...proposal, recipient: await verifyPassportRecipient(proposal.recipient) };
      setPendingClarification(data.clarification ?? null);
      setMessages((prev) => [...prev, { id: generateId(), role: 'assistant', content: data.content ?? '', proposal }]);
    } catch (err) {
      setMessages((prev) => [...prev, { id: generateId(), role: 'assistant', content: `I couldn't prepare that action: ${(err as Error).message}` }]);
    } finally { setIsLoading(false); }
  }, [messages, isLoading, address, action, pendingClarification]);

  const submitTransferFields = () => {
    const recipient = transferRecipient.trim(); const value = transferAmount.trim(); const numeric = Number(value);
    if (!recipient || !Number.isFinite(numeric) || numeric <= 0) return;
    void send(`Send ${value} USDC to ${recipient}`);
  };

  const submitBridgeAmount = () => {
    const value = bridgeAmount.trim(); const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0 || numeric > 1000) return;
    void send(`Bridge ${value} USDC`);
  };

  const handleNetworkChoice = (network: string) => { void send(network); };
  const { prompt, examples } = INTRO_COPY[action];
  const latestAssistantId = [...messages].reverse().find((message) => message.role === 'assistant')?.id;

  return <div className="glass-card p-5 flex flex-col" style={{ minHeight: '460px' }}>
    <div className="flex items-center gap-2.5 mb-2"><div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500/15 to-blue-500/10 border border-violet-500/20 flex items-center justify-center"><Sparkles className="w-4 h-4 text-violet-600 dark:text-violet-400" /></div><div><div className="text-surface-950 text-sm font-semibold tracking-tight">ARCTIS Economic Agent</div><div className="text-surface-500 text-[11px]">Understand → Clarify → Quote → Approve → Execute</div></div></div>
    <div className="mb-3 px-3 py-2 rounded-xl bg-surface-100/70 dark:bg-white/[.03] text-[11px] text-surface-600">{action === 'bridge' ? 'Circle CCTP V2 + Forwarding' : action === 'swap' ? 'Circle Swap or ARCTIS OTC' : 'Circle App Kit Send'} · human approval required</div>
    {executionStatus !== 'idle' && <div className={cn('mb-3 rounded-xl border p-3', executionStatus === 'success' ? 'border-emerald-500/20 bg-emerald-500/[.06]' : executionStatus === 'failed' ? 'border-red-500/20 bg-red-500/[.05]' : 'border-black/[.06] dark:border-white/[.07] bg-surface-0/60 dark:bg-surface-200/50')}><div className={cn('flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider', executionStatus === 'success' ? 'text-emerald-700 dark:text-emerald-400' : executionStatus === 'failed' ? 'text-red-600 dark:text-red-400' : 'text-surface-500')}><span className={cn('w-2 h-2 rounded-full', executionStatus === 'success' ? 'bg-emerald-500' : executionStatus === 'failed' ? 'bg-red-500' : 'bg-blue-500 animate-pulse')} />{executionStatus === 'executing' ? 'Running live checks / wallet approval' : executionStatus === 'success' ? 'Transfer confirmed in Agent' : 'Execution failed'}</div>{executionTxHash && <p className="mt-1 text-[11px] font-mono text-surface-600 break-all">TX: {executionTxHash}</p>}{executionStatus === 'success' && executionTxHash && <a href={`https://testnet.arcscan.app/tx/${executionTxHash}`} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">View transaction <ExternalLink className="w-3 h-3" /></a>}{executionError && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{executionError}</p>}</div>}

    <div ref={scrollRef} className="flex-1 overflow-y-auto py-4 space-y-4 min-h-[220px]">
      {messages.length === 0 && <div className="text-center py-6 px-2"><p className="text-surface-700 text-sm font-medium mb-3">{prompt}</p>
        {action === 'transfer' && <div className="mb-3 p-3 rounded-xl border border-blue-500/15 bg-blue-500/[.04] text-left"><label className="block text-[11px] font-semibold uppercase tracking-wider text-surface-500 mb-1.5">Transfer details</label><input value={transferRecipient} onChange={(e) => setTransferRecipient(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitTransferFields(); } }} type="text" placeholder="0x... or Passport ID" className="input-base w-full text-sm mb-2" aria-label="Transfer recipient" /><div className="flex gap-2"><input value={transferAmount} onChange={(e) => setTransferAmount(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitTransferFields(); } }} type="number" min="0.000001" step="0.000001" placeholder="0.00" className="input-base flex-1 text-sm" aria-label="Transfer amount in USDC" /><span className="self-center text-xs font-semibold text-surface-500">USDC</span><button onClick={submitTransferFields} disabled={!transferRecipient.trim() || !transferAmount || Number(transferAmount) <= 0 || isLoading} className="btn-primary px-3 py-2 disabled:opacity-50">Use</button></div><p className="mt-1.5 text-[10px] text-surface-500">Enter a wallet address or Passport ID and the amount. The agent will validate and prepare the proposal before wallet approval.</p></div>}
        {action === 'bridge' && <div className="mb-3 p-3 rounded-xl border border-blue-500/15 bg-blue-500/[.04] text-left"><label className="block text-[11px] font-semibold uppercase tracking-wider text-surface-500 mb-1.5">Bridge amount</label><div className="flex gap-2"><input value={bridgeAmount} onChange={(e) => setBridgeAmount(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitBridgeAmount(); } }} type="number" min="0.000001" max="1000" step="0.000001" placeholder="0.00" className="input-base flex-1 text-sm" aria-label="Bridge amount in USDC" /><span className="self-center text-xs font-semibold text-surface-500">USDC</span><button onClick={submitBridgeAmount} disabled={!bridgeAmount || Number(bridgeAmount) <= 0 || Number(bridgeAmount) > 1000 || isLoading} className="btn-primary px-3 py-2 disabled:opacity-50">Use</button></div><p className="mt-1.5 text-[10px] text-surface-500">Enter the amount first; then simply tap the source and destination networks.</p></div>}
        <div className="space-y-1.5">{examples.map((ex) => <button key={ex} onClick={() => send(ex)} className="block w-full text-left px-3 py-2.5 rounded-lg glass-card-hover text-surface-700 text-xs font-mono hover:text-blue-600 dark:hover:text-blue-400 transition-colors">&quot;{ex}&quot;</button>)}</div>
      </div>}

      {messages.map((msg) => <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={cn('flex gap-2.5', msg.role === 'user' && 'flex-row-reverse')}><div className={cn('w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 border', msg.role === 'user' ? 'bg-blue-500/15 border-blue-500/20' : 'bg-gradient-to-br from-violet-500/15 to-blue-500/10 border-violet-500/20')}>{msg.role === 'user' ? <User className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /> : <Bot className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />}</div><div className={cn('flex-1 max-w-[85%]', msg.role === 'user' && 'flex flex-col items-end')}><div className={cn('px-3.5 py-2.5 text-sm leading-relaxed rounded-2xl', msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-md' : 'bg-surface-0 border border-black/[.06] dark:border-white/[.07] dark:bg-surface-200/70 text-surface-950 rounded-tl-md')}><div className="whitespace-pre-wrap break-words">{msg.content}</div>{msg.role === 'assistant' && msg.id === latestAssistantId && action === 'bridge' && !msg.proposal && <BridgeNetworkChoices missing={pendingClarification?.missing} sourceChain={pendingClarification?.sourceChain} onSelect={handleNetworkChoice} disabled={isLoading} />}{msg.proposal && <ProposalCard action={action} proposal={msg.proposal} onApprove={() => handleApprove(msg.proposal!)} onCancel={() => handleCancel(msg.id)} />}</div></div></motion.div>)}
      <AnimatePresence>{isLoading && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex gap-2.5"><div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500/15 to-blue-500/10 border border-violet-500/20 flex items-center justify-center"><Loader2 className="w-3.5 h-3.5 text-violet-600 animate-spin" /></div><div className="px-3.5 py-2.5 rounded-2xl rounded-tl-md bg-surface-0 dark:bg-surface-200/70 border border-black/[.06] dark:border-white/[.07] text-surface-500 text-sm">Checking the transaction…</div></motion.div>}</AnimatePresence>
    </div>

    <div className="flex items-center gap-2 pt-2 border-t border-black/[.04] dark:border-white/[.04]"><input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }} placeholder={`Tell the agent what to ${action}…`} disabled={isLoading} className="input-base flex-1 text-sm" /><button onClick={() => send(input)} disabled={isLoading || !input.trim()} className="btn-primary px-3 py-2.5 disabled:opacity-50"><Send className="w-4 h-4" /></button></div>
  </div>;
}
