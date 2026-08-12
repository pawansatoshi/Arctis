'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccount, useBalance } from 'wagmi';
import { Bot, User, Send, ShieldCheck, Sparkles, Loader2, Route, CircleDollarSign, ExternalLink, ArrowDownUp, Wallet, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { PendingFinancialAction } from '@/lib/store';
import { isCircleSwapToken } from '@/lib/swap/circle';
import { cn, generateId } from '@/lib/utils';
import { useUSDCBalance } from '@/lib/hooks/useUSDCBalance';

type LockedAction = 'transfer' | 'swap' | 'bridge';
type AgentExecutionStatus = 'idle' | 'executing' | 'success' | 'failed';

const BRIDGE_NETWORKS = ['Arc Testnet', 'Ethereum Sepolia', 'Base Sepolia', 'Arbitrum Sepolia'] as const;
const SWAP_TOKENS = ['USDC', 'EURC', 'cirBTC', 'tUSDC', 'tARC'] as const;
const QUICK_AMOUNTS = ['1', '5', '10', '25'] as const;

const INTRO_COPY: Record<LockedAction, { prompt: string; examples: string[] }> = {
  transfer: { prompt: 'Who should receive USDC, and how much?', examples: ['Send 2 USDC to alice.arc', 'Send 5 USDC to 0x…'] },
  swap: { prompt: 'Choose the assets and amount. I will quote before approval.', examples: ['Swap 10 USDC to EURC', 'Swap 25 USDC to tUSDC'] },
  bridge: { prompt: 'Enter the amount, then tap the source and destination network.', examples: ['Bridge 2 USDC from Arc Testnet to Base Sepolia', 'Bridge 5 USDC from Base Sepolia to Arc Testnet'] },
};

const PROPOSAL_TITLE: Record<LockedAction, string> = { transfer: 'Transfer Proposal', swap: 'Swap Proposal', bridge: 'Bridge Proposal' };
interface AgentPanelMessage { id: string; role: 'user' | 'assistant'; content: string; proposal?: PendingFinancialAction; }

function isWalletAddress(value: string): boolean { return /^0x[a-fA-F0-9]{40}$/.test(value.trim()); }

async function verifyPassportRecipient(value: string): Promise<string> {
  const username = value.trim().toLowerCase().replace(/^@/, '').replace(/\.arc$/, '');
  const response = await fetch(`/api/passport/resolve?username=${encodeURIComponent(username)}`);
  let data: { username?: string; walletAddress?: string; error?: string } = {};
  try { data = await response.json(); } catch {}
  if (!response.ok || !data.walletAddress || !isWalletAddress(data.walletAddress)) throw new Error(data.error || `Passport not found: ${username}.arc`);
  return `${(data.username || username).toLowerCase()}.arc`;
}

function QuickAmounts({ onSelect, disabled, max }: { onSelect: (amount: string) => void; disabled: boolean; max?: string }) {
  const values = max && Number(max) > 0 ? Array.from(new Set([...QUICK_AMOUNTS.filter((x) => Number(x) <= Number(max)), max])) : [...QUICK_AMOUNTS];
  return <div className="flex flex-wrap gap-1.5 mt-2">{values.map((value) => <button key={value} type="button" disabled={disabled} onClick={() => onSelect(value)} className="rounded-full border border-black/[.06] dark:border-white/[.08] px-3 py-1.5 text-[11px] font-medium hover:border-blue-500/40 hover:text-blue-600 disabled:opacity-50">{max && value === max ? 'MAX' : value} USDC</button>)}</div>;
}

function BridgeNetworkChoices({ missing, sourceChain, onSelect, disabled }: { missing?: PendingFinancialAction['missing']; sourceChain?: string; onSelect: (network: string) => void; disabled: boolean }) {
  if (missing !== 'sourceChain' && missing !== 'destinationChain') return null;
  const source = missing === 'sourceChain';
  const options = source ? BRIDGE_NETWORKS : BRIDGE_NETWORKS.filter((network) => network !== sourceChain);
  return <div className="mt-3 rounded-xl border border-blue-500/15 bg-blue-500/[.04] p-3 text-left"><div className="flex items-center justify-between mb-2"><span className="text-[11px] font-semibold uppercase tracking-wider text-surface-500">{source ? 'Bridge from' : 'Bridge to'}</span><span className="text-[10px] text-surface-400">Tap to choose</span></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{options.map((network) => <button key={network} type="button" disabled={disabled} onClick={() => onSelect(network)} className="rounded-lg border border-black/[.06] dark:border-white/[.08] bg-surface-0 dark:bg-surface-200/70 px-3 py-2.5 text-left text-xs font-medium hover:border-blue-500/40 hover:text-blue-600 disabled:opacity-50">{network}</button>)}</div></div>;
}

function TokenChoices({ onSelect, disabled }: { onSelect: (token: string) => void; disabled: boolean }) {
  return <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-2">{SWAP_TOKENS.map((token) => <button key={token} type="button" disabled={disabled} onClick={() => onSelect(token)} className="rounded-lg border border-black/[.06] dark:border-white/[.08] px-2.5 py-2 text-xs font-semibold hover:border-violet-500/40 hover:text-violet-600 disabled:opacity-50">{token}</button>)}</div>;
}

function ProposalCard({ action, proposal, onApprove, onCancel, onReverse }: { action: LockedAction; proposal: PendingFinancialAction; onApprove: () => void; onCancel: () => void; onReverse?: () => void }) {
  const circleRail = action === 'swap' && isCircleSwapToken(proposal.fromToken) && isCircleSwapToken(proposal.toToken);
  const recipient = proposal.recipient ?? '';
  const recipientLabel = isWalletAddress(recipient) ? `${recipient.slice(0, 8)}…${recipient.slice(-6)}` : recipient;
  return <div className="mt-3 rounded-2xl border border-amber-500/25 bg-amber-500/[.07] p-4 space-y-3"><div className="flex items-center gap-2"><div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center"><ShieldCheck className="w-4 h-4 text-amber-600" /></div><div><span className="text-amber-700 text-xs font-semibold uppercase tracking-wide">{PROPOSAL_TITLE[action]}</span><p className="text-[10px] text-surface-500">Nothing has been signed</p></div></div><div className="space-y-1.5 text-sm bg-surface-0/60 rounded-xl p-3"><div className="flex justify-between"><span className="text-surface-600">Amount</span><span className="font-mono font-semibold">{proposal.amount} {proposal.fromToken}</span></div>{proposal.toToken && <div className="flex justify-between"><span className="text-surface-600">Receive</span><span className="font-mono">{proposal.toToken}</span></div>}{proposal.recipient && <div className="flex justify-between gap-4"><span className="text-surface-600">Recipient</span><span className={cn('font-mono text-xs truncate', !isWalletAddress(recipient) && 'text-emerald-700')}>{recipientLabel}{!isWalletAddress(recipient) && ' ✓'}</span></div>}{proposal.sourceChain && <div className="flex justify-between"><span className="text-surface-600">From</span><span>{proposal.sourceChain}</span></div>}{proposal.destinationChain && <div className="flex justify-between"><span className="text-surface-600">To</span><span>{proposal.destinationChain}</span></div>}{action === 'bridge' && <div className="flex justify-between"><span className="text-surface-600">Execution</span><span className="text-emerald-600 font-medium">CCTP + Forwarding</span></div>}{action === 'swap' && <div className="flex justify-between items-center"><span className="text-surface-600">Execution</span><span className="font-medium flex items-center gap-1">{circleRail ? <><CircleDollarSign className="w-3.5 h-3.5 text-blue-600" /> Circle App Kit</> : <><Route className="w-3.5 h-3.5 text-violet-600" /> ARCTIS OTC</>}</span></div>}</div><div className="flex items-center gap-2 text-[11px] text-surface-600"><Wallet className="w-3.5 h-3.5" /> Balance, gas and route preflight runs before wallet approval.</div><div className="flex gap-2"><button onClick={onCancel} className="btn-ghost text-xs px-3 py-2 flex-1">Cancel</button>{action === 'swap' && proposal.toToken && onReverse && <button onClick={onReverse} className="btn-ghost text-xs px-3 py-2 flex-1 inline-flex items-center justify-center gap-1"><ArrowDownUp className="w-3.5 h-3.5" /> Reverse</button>}<button onClick={onApprove} className="btn-primary text-xs px-3 py-2 flex-1">Review &amp; Execute</button></div></div>;
}

export function EconomicAgentPanel({ action, onExecute, executionStatus = 'idle', executionError, executionTxHash }: { action: LockedAction; onExecute: (proposal: PendingFinancialAction) => void | Promise<void>; executionStatus?: AgentExecutionStatus; executionError?: string | null; executionTxHash?: string | null }) {
  const { address } = useAccount();
  const { formatted: usdcBalance } = useUSDCBalance(address);
  const { data: nativeBalance } = useBalance({ address, query: { enabled: !!address, refetchInterval: 10_000 } });
  const [messages, setMessages] = useState<AgentPanelMessage[]>([]);
  const [input, setInput] = useState('');
  const [amount, setAmount] = useState('');
  const [recipient, setRecipient] = useState('');
  const [fromToken, setFromToken] = useState('USDC');
  const [toToken, setToToken] = useState('EURC');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingClarification, setPendingClarification] = useState<PendingFinancialAction | null>(null);
  const [draftMode, setDraftMode] = useState(true);
  const previousExecutionStatus = useRef<AgentExecutionStatus>('idle');
  const latestAssistantId = [...messages].reverse().find((message) => message.role === 'assistant')?.id;
  const { prompt, examples } = INTRO_COPY[action];

  const resetAgentDraft = useCallback((clearConversation = false) => {
    setInput(''); setAmount(''); setRecipient(''); setPendingClarification(null); setDraftMode(true);
    if (clearConversation) setMessages([]);
  }, []);

  // A transaction is a state inside the Economic Agent flow, not a mode switch.
  // When it ends, immediately restore the agent's own amount/parameter entry UI.
  useEffect(() => {
    const wasExecuting = previousExecutionStatus.current === 'executing';
    if (wasExecuting && (executionStatus === 'success' || executionStatus === 'failed')) resetAgentDraft(false);
    previousExecutionStatus.current = executionStatus;
  }, [executionStatus, resetAgentDraft]);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;
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
      setPendingClarification(data.clarification ?? null); setDraftMode(false);
      setMessages((prev) => [...prev, { id: generateId(), role: 'assistant', content: data.content ?? '', proposal }]);
    } catch (err) {
      setMessages((prev) => [...prev, { id: generateId(), role: 'assistant', content: `I couldn't prepare that action: ${(err as Error).message}. Try a suggested option below.` }]);
      setDraftMode(true);
    } finally { setIsLoading(false); }
  }, [messages, isLoading, address, action, pendingClarification]);

  const submitDraft = () => {
    if (action === 'transfer') { if (!recipient.trim() || !amount || Number(amount) <= 0) return; void send(`Send ${amount} USDC to ${recipient.trim()}`); return; }
    if (action === 'swap') { if (!amount || Number(amount) <= 0 || fromToken === toToken) return; void send(`Swap ${amount} ${fromToken} to ${toToken}`); return; }
    if (!amount || Number(amount) <= 0) return; void send(`Bridge ${amount} USDC`);
  };

  const handleReverse = (msgId: string) => setMessages((prev) => prev.map((message) => message.id !== msgId || !message.proposal?.toToken ? message : { ...message, proposal: { ...message.proposal, fromToken: message.proposal.toToken, toToken: message.proposal.fromToken } }));
  const handleCancel = (msgId: string) => {
    setMessages((prev) => prev.map((m) => m.id === msgId ? { ...m, proposal: undefined } : m));
    resetAgentDraft(false);
  };
  const handleNetworkChoice = (network: string) => { void send(network); };
  const handleTokenChoice = (token: string) => { if (pendingClarification?.missing === 'toToken') void send(token); else setToToken(token); };

  const amountNumber = Number(amount);
  const usdcShortfall = (action !== 'swap' || fromToken === 'USDC') ? Math.max(0, amountNumber - Number(usdcBalance)) : 0;
  const hasUsdcShortfall = Number.isFinite(usdcShortfall) && usdcShortfall > 0;

  return (
    <div className="glass-card p-5 flex flex-col" style={{ minHeight: '460px' }}>
      <div className="flex items-center gap-2.5 mb-2"><div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500/15 to-blue-500/10 border border-violet-500/20 flex items-center justify-center"><Sparkles className="w-4 h-4 text-violet-600" /></div><div><div className="text-surface-950 text-sm font-semibold tracking-tight">ARCTIS Economic Agent</div><div className="text-surface-500 text-[11px]">Understand → Clarify → Preflight → Quote → Approve → Execute</div></div></div>
      <div className="mb-3 px-3 py-2 rounded-xl bg-surface-100/70 text-[11px] text-surface-600">{action === 'bridge' ? 'Circle CCTP V2 + Forwarding' : action === 'swap' ? 'Circle Swap or ARCTIS OTC' : 'Circle App Kit Send'} · human approval required</div>
      {address && <div className="mb-3 rounded-xl border border-black/[.06] bg-surface-0/70 p-3"><div className="flex items-center justify-between text-[11px]"><span className="text-surface-500">Available now</span><span className="font-mono font-semibold">{usdcBalance} USDC</span></div><div className="flex items-center justify-between mt-1 text-[10px] text-surface-500"><span>Network gas</span><span className="font-mono">{nativeBalance ? `${Number(nativeBalance.formatted).toFixed(5)} ${nativeBalance.symbol}` : 'checking…'}</span></div>{hasUsdcShortfall && <div className="mt-2 rounded-lg bg-red-500/[.06] border border-red-500/15 p-2 text-[11px] text-red-700"><div className="flex items-center gap-1.5 font-semibold"><AlertTriangle className="w-3.5 h-3.5" /> Insufficient USDC</div><div className="mt-1">Available {usdcBalance} · Required {amount} · Deposit {usdcShortfall.toFixed(6)} USDC more.</div></div>}{!hasUsdcShortfall && amountNumber > 0 && <div className="mt-2 text-[10px] text-emerald-700 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> USDC amount covered. Final gas and route preflight runs before approval.</div>}</div>}

      {executionStatus !== 'idle' && <div className={cn('mb-3 rounded-xl border p-3', executionStatus === 'success' ? 'border-emerald-500/20 bg-emerald-500/[.06]' : executionStatus === 'failed' ? 'border-red-500/20 bg-red-500/[.05]' : 'border-black/[.06] bg-surface-0/60')}><div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider"><span className={cn('w-2 h-2 rounded-full', executionStatus === 'success' ? 'bg-emerald-500' : executionStatus === 'failed' ? 'bg-red-500' : 'bg-blue-500 animate-pulse')} />{executionStatus === 'executing' ? 'Running live checks / wallet approval' : executionStatus === 'success' ? 'Transaction confirmed in Agent' : 'Execution failed'}</div>{executionTxHash && <p className="mt-1 text-[11px] font-mono text-surface-600 break-all">TX: {executionTxHash}</p>}{executionStatus === 'success' && executionTxHash && <a href={`https://testnet.arcscan.app/tx/${executionTxHash}`} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">View transaction <ExternalLink className="w-3 h-3" /></a>}{executionError && <p className="mt-1 text-xs text-red-600">{executionError}</p>}</div>}

      <div className="flex-1 overflow-y-auto py-3 space-y-4 min-h-[220px]">
        {draftMode && messages.length === 0 && <div className="text-center py-4 px-1"><p className="text-surface-700 text-sm font-medium mb-3">{prompt}</p>{action === 'transfer' && <div className="p-3 rounded-xl border border-blue-500/15 bg-blue-500/[.04] text-left"><label className="block text-[11px] font-semibold uppercase tracking-wider text-surface-500 mb-1.5">Recipient</label><input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="alice.arc or 0x…" className="input-base w-full text-sm mb-2" /><div className="flex gap-2"><input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min="0.000001" step="0.000001" placeholder="Amount" className="input-base flex-1 text-sm" /><span className="self-center text-xs font-semibold text-surface-500">USDC</span></div><QuickAmounts onSelect={setAmount} disabled={isLoading} max={usdcBalance} /><button onClick={submitDraft} disabled={isLoading || !recipient.trim() || !amount || hasUsdcShortfall} className="btn-primary w-full mt-3 disabled:opacity-50">Continue</button></div>}{action === 'swap' && <div className="p-3 rounded-xl border border-violet-500/15 bg-violet-500/[.04] text-left"><label className="block text-[11px] font-semibold uppercase tracking-wider text-surface-500 mb-1.5">You pay</label><div className="flex gap-2"><input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min="0.000001" step="0.000001" placeholder="Amount" className="input-base flex-1 text-sm" /><select value={fromToken} onChange={(e) => setFromToken(e.target.value as typeof fromToken)} className="input-base w-28 text-sm">{SWAP_TOKENS.map((token) => <option key={token}>{token}</option>)}</select></div><QuickAmounts onSelect={setAmount} disabled={isLoading} max={fromToken === 'USDC' ? usdcBalance : undefined} /><div className="flex justify-center py-2"><button type="button" onClick={() => { const next = toToken; setToToken(fromToken); setFromToken(next); }} className="w-9 h-9 rounded-full border border-violet-500/20 bg-surface-0 hover:bg-violet-500/[.06]" aria-label="Reverse swap"><ArrowDownUp className="w-4 h-4 mx-auto text-violet-600" /></button></div><label className="block text-[11px] font-semibold uppercase tracking-wider text-surface-500 mb-1.5">You receive</label><select value={toToken} onChange={(e) => setToToken(e.target.value as typeof toToken)} className="input-base w-full text-sm">{SWAP_TOKENS.filter((token) => token !== fromToken).map((token) => <option key={token}>{token}</option>)}</select><button onClick={submitDraft} disabled={isLoading || !amount || Number(amount) <= 0 || fromToken === toToken || hasUsdcShortfall} className="btn-primary w-full mt-3 disabled:opacity-50">Get Quote</button></div>}{action === 'bridge' && <div className="p-3 rounded-xl border border-blue-500/15 bg-blue-500/[.04] text-left"><label className="block text-[11px] font-semibold uppercase tracking-wider text-surface-500 mb-1.5">Bridge amount</label><div className="flex gap-2"><input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min="0.000001" step="0.000001" placeholder="Amount" className="input-base flex-1 text-sm" /><span className="self-center text-xs font-semibold text-surface-500">USDC</span></div><QuickAmounts onSelect={setAmount} disabled={isLoading} max={usdcBalance} /><button onClick={submitDraft} disabled={isLoading || !amount || Number(amount) <= 0 || hasUsdcShortfall} className="btn-primary w-full mt-3 disabled:opacity-50">Choose Networks</button></div>}<div className="mt-3 space-y-1.5">{examples.map((example) => <button key={example} onClick={() => send(example)} className="block w-full text-left px-3 py-2 rounded-lg glass-card-hover text-surface-700 text-xs font-mono hover:text-blue-600">&quot;{example}&quot;</button>)}</div></div>}

        {messages.map((message) => <motion.div key={message.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={cn('flex gap-2.5', message.role === 'user' && 'flex-row-reverse')}><div className={cn('w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 border', message.role === 'user' ? 'bg-blue-500/15 border-blue-500/20' : 'bg-violet-500/10 border-violet-500/20')}>{message.role === 'user' ? <User className="w-3.5 h-3.5 text-blue-600" /> : <Bot className="w-3.5 h-3.5 text-violet-600" />}</div><div className={cn('flex-1 max-w-[88%]', message.role === 'user' && 'flex flex-col items-end')}><div className={cn('px-3.5 py-2.5 text-sm leading-relaxed rounded-2xl', message.role === 'user' ? 'bg-blue-600 text-white rounded-tr-md' : 'bg-surface-0 border border-black/[.06] text-surface-950 rounded-tl-md')}><div className="whitespace-pre-wrap break-words">{message.content}</div>{message.role === 'assistant' && message.id === latestAssistantId && <BridgeNetworkChoices missing={pendingClarification?.missing} sourceChain={pendingClarification?.sourceChain} onSelect={handleNetworkChoice} disabled={isLoading} />}{message.role === 'assistant' && message.id === latestAssistantId && pendingClarification?.missing === 'toToken' && <TokenChoices onSelect={handleTokenChoice} disabled={isLoading} />}{message.proposal && <ProposalCard action={action} proposal={message.proposal} onApprove={() => void onExecute(message.proposal!)} onCancel={() => handleCancel(message.id)} onReverse={action === 'swap' ? () => handleReverse(message.id) : undefined} />}</div></div></motion.div>)}
        <AnimatePresence>{isLoading && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2.5"><div className="w-7 h-7 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center"><Loader2 className="w-3.5 h-3.5 text-violet-600 animate-spin" /></div><div className="px-3.5 py-2.5 rounded-2xl bg-surface-0 border text-surface-500 text-sm">Understanding and checking…</div></motion.div>}</AnimatePresence>
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-black/[.04]"><input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(input); } }} placeholder={`Optional: tell the agent what to ${action}…`} disabled={isLoading} className="input-base flex-1 text-sm" /><button onClick={() => void send(input)} disabled={isLoading || !input.trim()} className="btn-primary px-3 py-2.5 disabled:opacity-50"><Send className="w-4 h-4" /></button></div>
    </div>
  );
}
