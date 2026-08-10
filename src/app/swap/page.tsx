'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';
import {
  ArrowLeftRight, ArrowUpDown, CheckCircle2, AlertCircle,
  Loader2, ExternalLink, ChevronDown, RefreshCw, History, Wallet, Info,
} from 'lucide-react';
import { cn, formatRelative } from '@/lib/utils';
import { CONTRACTS, ERC20_ABI, txUrl } from '@/lib/contracts';
import { useMemo as useArcMemo } from '@/lib/memo/useMemo';
import { useAppStore } from '@/lib/store';
import { useWalletAuth } from '@/lib/auth/useWalletAuth';
import { ModeTabs, type ExecutionMode } from '@/components/agent/ModeTabs';
import { EconomicAgentPanel } from '@/components/agent/EconomicAgentPanel';
import toast from 'react-hot-toast';

type SwapToken = 'USDC' | 'tUSDC' | 'tARC';
const TOKENS: SwapToken[] = ['USDC', 'tUSDC', 'tARC'];
const TOKEN_DECIMALS: Record<SwapToken, number> = { USDC: 6, tUSDC: 6, tARC: 18 };
const TOKEN_CONTRACT: Record<SwapToken, `0x${string}`> = {
  USDC: CONTRACTS.USDC as `0x${string}`, tUSDC: CONTRACTS.tUSDC as `0x${string}`, tARC: CONTRACTS.tARC as `0x${string}`,
};

interface SwapQuote { routeId: string; fromToken: string; toToken: string; inputAmount: number; outputAmount: number; fee: number; feeBps: number; rate: number; routeAvailable: boolean; }
interface SwapRecord { id: string; fromToken: string; toToken: string; inputAmount: number; outputAmount: number; status: string; inboundTxHash: string; outboundTxHash?: string; createdAt: string; }

function SwapPageInner() {
  const searchParams = useSearchParams();
  const { isConnected, address } = useAccount();
  const { dispatchMemo } = useArcMemo();
  const { writeContractAsync } = useWriteContract();

  const [fromToken, setFromToken] = useState<SwapToken>('USDC');
  const [toToken, setToToken] = useState<SwapToken>('tUSDC');
  const [showFromMenu, setShowFromMenu] = useState(false);
  const [showToMenu, setShowToMenu] = useState(false);
  const [amount, setAmount] = useState('');
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const [step, setStep] = useState<'idle' | 'sending' | 'processing' | 'completed' | 'error'>('idle');
  const [inboundTxHash, setInboundTxHash] = useState<`0x${string}` | undefined>();
  const [outboundTxHash, setOutboundTxHash] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [history, setHistory] = useState<SwapRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [mode, setMode] = useState<ExecutionMode>('manual');
  const [agentExecuting, setAgentExecuting] = useState(false);
  const { pendingAction, setPendingAction } = useAppStore();
  const { getAuthHeaders } = useWalletAuth();

  useEffect(() => {
    if (searchParams.get('mode') === 'agent') setMode('agent');
  }, [searchParams]);

  // AI-orchestrated handoff — pre-fill from a confirmed chat proposal,
  // then clear it so it's only ever consumed once.
  useEffect(() => {
    if (pendingAction?.action === 'swap') {
      if (pendingAction.fromToken) setFromToken(pendingAction.fromToken as SwapToken);
      if (pendingAction.toToken) setToToken(pendingAction.toToken as SwapToken);
      setAmount(pendingAction.amount);
      toast.success('Pre-filled from ARCTIS AI — review before swapping');
      setPendingAction(null);
    }
  }, [pendingAction, setPendingAction]);

  const { isSuccess: inboundConfirmed } = useWaitForTransactionReceipt({ hash: inboundTxHash, query: { enabled: !!inboundTxHash } });

  useEffect(() => {
    if (!showHistory || !address) return;
    fetch(`/api/swap/history?wallet=${address}`).then((r) => r.json()).then((d) => { if (d.swaps) setHistory(d.swaps); }).catch(() => {});
  }, [showHistory, address]);

  useEffect(() => {
    const num = parseFloat(amount);
    if (!amount || isNaN(num) || num <= 0 || fromToken === toToken) { setQuote(null); setQuoteError(null); return; }
    const t = setTimeout(() => {
      fetch(`/api/swap/quote?from=${fromToken}&to=${toToken}&amount=${amount}`).then((r) => r.json()).then((d) => {
        if (d.error) { setQuoteError(d.error); setQuote(d.routeAvailable === false ? d : null); }
        else { setQuote(d); setQuoteError(null); }
      }).catch(() => { setQuote(null); setQuoteError('Failed to fetch quote'); });
    }, 500);
    return () => clearTimeout(t);
  }, [fromToken, toToken, amount]);

  useEffect(() => {
    if (!inboundConfirmed || step !== 'sending' || !inboundTxHash || !address || !quote) return;
    setStep('processing');
    void (async () => {
      const headers = await getAuthHeaders();
      fetch('/api/swap/execute', {
        method: 'POST', headers,
        body: JSON.stringify({ walletAddress: address, fromToken, toToken, amount: parseFloat(amount), inboundTxHash }),
      }).then((r) => r.json()).then((d) => {
        if (d.success) {
          setOutboundTxHash(d.outboundTxHash); setStep('completed');
          toast.success(`Swapped! ${amount} ${fromToken} → ${d.outputAmount.toFixed(4)} ${toToken}`);
          if (d.memoPayload) void dispatchMemo(d.memoPayload);
        } else { setErrorMsg(d.error ?? 'Swap failed'); setStep('error'); }
      }).catch((err) => { setErrorMsg(err.message); setStep('error'); });
    })();
  }, [inboundConfirmed, step, inboundTxHash, address, quote, fromToken, toToken, amount, dispatchMemo, getAuthHeaders]);

  const handleFlip = () => { const f = fromToken; setFromToken(toToken); setToToken(f); setAmount(''); setQuote(null); };

  const amountNum = parseFloat(amount);
  const canSwap = amount !== '' && !isNaN(amountNum) && amountNum > 0 && !!quote && quote.routeAvailable !== false && isConnected && step === 'idle';

  const handleSwap = async () => {
    if (!canSwap || !address || !quote) return;
    setStep('sending');
    try {
      const amountBig = parseUnits(amountNum.toFixed(TOKEN_DECIMALS[fromToken]), TOKEN_DECIMALS[fromToken]);
      const hash = await writeContractAsync({
        address: TOKEN_CONTRACT[fromToken], abi: ERC20_ABI, functionName: 'transfer',
        args: [(process.env.NEXT_PUBLIC_SWAP_WALLET_ADDRESS ?? '0x0000000000000000000000000000000000000000') as `0x${string}`, amountBig],
      });
      setInboundTxHash(hash);
    } catch (err) { setErrorMsg((err as Error).message); setStep('error'); }
  };

  const executeAgentSwap = useCallback(async (proposal: import('@/lib/store').PendingFinancialAction) => {
    if (!proposal.amount || !proposal.fromToken || !proposal.toToken) throw new Error('Swap proposal is incomplete');
    setFromToken(proposal.fromToken as SwapToken);
    setToToken(proposal.toToken as SwapToken);
    setAmount(proposal.amount);
    setAgentExecuting(true);
  }, []);

  useEffect(() => {
    if (!agentExecuting || !isConnected || step !== 'idle' || !quote || quote.routeAvailable === false) return;
    void handleSwap();
  }, [agentExecuting, isConnected, step, quote]);

  useEffect(() => {
    if (agentExecuting && (step === 'completed' || step === 'error')) setAgentExecuting(false);
  }, [agentExecuting, step]);

  const handleReset = () => { setStep('idle'); setAmount(''); setQuote(null); setInboundTxHash(undefined); setOutboundTxHash(null); setErrorMsg(null); };

  if (step === 'completed') {
    return (
      <div className="page-container max-w-lg flex items-center justify-center min-h-[60vh]">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card p-8 text-center space-y-6 w-full">
          <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto"><CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" /></div>
          <div><h2 className="text-xl font-bold text-surface-950 mb-1">Swap Complete</h2><p className="text-surface-600 text-sm">{amount} {fromToken} → {toToken}</p></div>
          <div className="space-y-2">
            {inboundTxHash && <a href={txUrl(inboundTxHash)} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between glass-card p-3 hover:bg-black/[0.06] dark:hover:bg-white/[0.06] transition-colors"><span className="text-surface-600 text-xs">Inbound tx</span><span className="text-blue-600 dark:text-blue-400 text-xs flex items-center gap-1">View <ExternalLink className="w-3 h-3" /></span></a>}
            {outboundTxHash && <a href={txUrl(outboundTxHash)} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between glass-card p-3 hover:bg-black/[0.06] dark:hover:bg-white/[0.06] transition-colors"><span className="text-surface-600 text-xs">Outbound tx</span><span className="text-blue-600 dark:text-blue-400 text-xs flex items-center gap-1">ArcScan <ExternalLink className="w-3 h-3" /></span></a>}
          </div>
          <button onClick={handleReset} className="btn-ghost w-full justify-center"><RefreshCw className="w-4 h-4" /> New Swap</button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="page-container max-w-lg safe-bottom">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1"><span className="text-surface-500 text-xs font-semibold uppercase tracking-widest">Stablecoin OS</span></div>
          <h1 className="text-2xl font-bold text-surface-950 tracking-tight">Swap</h1>
          <p className="text-surface-600 text-sm mt-1">OTC settlement · USDC ↔ tUSDC ↔ tARC</p>
        </div>
        <button onClick={() => setShowHistory((s: boolean) => !s)} aria-label="Swap history" className={cn('btn-ghost', showHistory && 'bg-blue-500/10 text-blue-600 dark:text-blue-400')}><History className="w-4 h-4" /></button>
      </motion.div>

      <div className="mb-6"><ModeTabs mode={mode} onChange={setMode} /></div>

      {mode === 'agent' && (
        <EconomicAgentPanel
          action="swap"
          onExecute={executeAgentSwap}
          executionStatus={agentExecuting ? 'executing' : outboundTxHash ? 'success' : step === 'error' ? 'failed' : 'idle'}
          executionError={step === 'error' ? errorMsg : null}
          executionTxHash={outboundTxHash ?? (inboundTxHash ?? null)}
        />
      )}

      {mode === 'manual' && (!isConnected ? (
        <div className="glass-card p-10 text-center"><Wallet className="w-10 h-10 text-surface-600 mx-auto mb-3" /><p className="text-surface-700 text-sm">Connect your wallet to swap tokens</p></div>
      ) : showHistory ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          {history.length === 0 ? (
            <div className="glass-card p-10 text-center">
              <ArrowLeftRight className="w-8 h-8 text-surface-500 mx-auto mb-3 opacity-50" />
              <p className="text-surface-600 text-sm">No swaps yet</p>
            </div>
          ) : history.map((s: SwapRecord) => (
            <div key={s.id} className="glass-card p-4 flex items-center justify-between">
              <div><p className="text-surface-950 text-sm font-medium">{s.inputAmount} {s.fromToken} → {s.outputAmount.toFixed(4)} {s.toToken}</p><p className="text-surface-500 text-xs">{formatRelative(s.createdAt)}</p></div>
              <span className={cn('text-xs px-2 py-0.5 rounded-full', s.status === 'completed' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : s.status === 'failed' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400' : 'bg-blue-500/10 text-blue-600 dark:text-blue-400')}>{s.status}</span>
            </div>
          ))}
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="glass-card p-5 space-y-2.5">
            <label className="text-surface-600 text-xs font-medium uppercase tracking-wider">From</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <button onClick={() => setShowFromMenu((s: boolean) => !s)} disabled={step !== 'idle'} className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-black/[0.04] dark:bg-white/[0.04] hover:bg-black/[0.07] dark:hover:bg-white/[0.07] border border-black/[0.08] dark:border-white/[0.08] transition-colors disabled:opacity-60">
                  <span className="text-sm font-medium text-surface-950">{fromToken}</span><ChevronDown className="w-4 h-4 text-surface-600" />
                </button>
                <AnimatePresence>{showFromMenu && (
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute top-full left-0 right-0 mt-1 glass-card z-20 overflow-hidden">
                    {TOKENS.filter((t) => t !== toToken).map((t) => (<button key={t} onClick={() => { setFromToken(t); setShowFromMenu(false); }} className="w-full px-4 py-3 text-left hover:bg-black/[0.06] dark:hover:bg-white/[0.06] transition-colors text-sm text-surface-950">{t}</button>))}
                  </motion.div>
                )}</AnimatePresence>
              </div>
              <input type="number" value={amount} placeholder="0.00" onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)} disabled={step !== 'idle'} className="input-field flex-1" min="0" step="0.01" />
            </div>
          </div>

          <div className="flex justify-center -my-1 relative z-10">
            <button onClick={handleFlip} disabled={step !== 'idle'} aria-label="Flip tokens"
              className="w-9 h-9 rounded-full bg-surface-0 border border-black/[0.08] dark:border-white/[0.08] shadow-sm flex items-center justify-center text-surface-600 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-500/30 transition-all disabled:opacity-50">
              <ArrowUpDown className="w-4 h-4" />
            </button>
          </div>

          <div className="glass-card p-5 space-y-2.5">
            <label className="text-surface-600 text-xs font-medium uppercase tracking-wider">To</label>
            <div className="flex gap-2 items-center">
              <div className="relative flex-1">
                <button onClick={() => setShowToMenu((s: boolean) => !s)} disabled={step !== 'idle'} className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-black/[0.04] dark:bg-white/[0.04] hover:bg-black/[0.07] dark:hover:bg-white/[0.07] border border-black/[0.08] dark:border-white/[0.08] transition-colors disabled:opacity-60">
                  <span className="text-sm font-medium text-surface-950">{toToken}</span><ChevronDown className="w-4 h-4 text-surface-600" />
                </button>
                <AnimatePresence>{showToMenu && (
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute top-full left-0 right-0 mt-1 glass-card z-20 overflow-hidden">
                    {TOKENS.filter((t) => t !== fromToken).map((t) => (<button key={t} onClick={() => { setToToken(t); setShowToMenu(false); }} className="w-full px-4 py-3 text-left hover:bg-black/[0.06] dark:hover:bg-white/[0.06] transition-colors text-sm text-surface-950">{t}</button>))}
                  </motion.div>
                )}</AnimatePresence>
              </div>
              <span className="flex-1 text-surface-950 text-lg font-mono text-right pr-2">{quote?.routeAvailable !== false ? (quote?.outputAmount.toFixed(4) ?? '0.00') : '—'}</span>
            </div>
          </div>

          {quote && quote.routeAvailable !== false && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-surface-600">Rate</span><span className="text-surface-950 font-mono">1 {fromToken} = {quote.rate} {toToken}</span></div>
              <div className="flex justify-between"><span className="text-surface-600">Fee (0.3%)</span><span className="text-surface-950 font-mono">{quote.fee.toFixed(4)} {fromToken}</span></div>
            </motion.div>
          )}

          {quoteError && (
            <div className="glass-card p-3 border-amber-500/20 bg-amber-500/5 flex items-start gap-2">
              <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" /><p className="text-amber-600 dark:text-amber-400 text-sm">{quoteError}</p>
            </div>
          )}

          {step === 'sending' && <button disabled className="btn-primary w-full justify-center opacity-70"><Loader2 className="w-4 h-4 animate-spin" /> Confirm in wallet…</button>}
          {step === 'processing' && <button disabled className="btn-primary w-full justify-center opacity-70"><Loader2 className="w-4 h-4 animate-spin" /> Settling swap…</button>}
          {step === 'error' && errorMsg && <div className="glass-card p-3 border-rose-500/20 bg-rose-500/5 flex items-start gap-2"><AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" /><p className="text-rose-600 dark:text-rose-400 text-sm">{errorMsg}</p></div>}
          {(step === 'idle' || step === 'error') && (
            <button onClick={handleSwap} disabled={!canSwap} className="btn-primary w-full justify-center text-base py-3.5 disabled:opacity-40 disabled:cursor-not-allowed">
              <ArrowLeftRight className="w-4 h-4" /> Swap
            </button>
          )}
          <p className="text-center text-surface-500 text-xs">OTC settlement · Arc Testnet only</p>
        </motion.div>
      ))}
    </div>
  );
}

export default function SwapPage() {
  return (
    <Suspense fallback={<div className="page-container max-w-lg flex items-center justify-center min-h-[60vh]"><div className="text-surface-500 text-sm">Loading…</div></div>}>
      <SwapPageInner />
    </Suspense>
  );
}
