'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { motion } from 'framer-motion';
import { useAccount, useSwitchChain, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { createViemAdapterFromProvider } from '@circle-fin/adapter-viem-v2';
import { AppKit } from '@circle-fin/app-kit';
import { ArcTestnet } from '@circle-fin/app-kit/chains';
import { createPublicClient, formatEther, formatUnits, http, parseUnits } from 'viem';
import { ArrowLeftRight, CheckCircle2, AlertCircle, Loader2, ExternalLink, ChevronDown, RefreshCw, History, Wallet, Info, ShieldCheck } from 'lucide-react';
import { cn, formatRelative } from '@/lib/utils';
import { CONTRACTS, ERC20_ABI, RPC_URL, txUrl } from '@/lib/contracts';
import { isCircleSwapPair, isCircleSwapToken } from '@/lib/swap/circle';
import { useAppStore } from '@/lib/store';
import { useWalletAuth } from '@/lib/auth/useWalletAuth';
import { ModeTabs, type ExecutionMode } from '@/components/agent/ModeTabs';
import { EconomicAgentPanel } from '@/components/agent/EconomicAgentPanel';
import toast from 'react-hot-toast';

type SwapToken = 'USDC' | 'EURC' | 'cirBTC' | 'tUSDC' | 'tARC';
const TOKENS: SwapToken[] = ['USDC', 'EURC', 'cirBTC', 'tUSDC', 'tARC'];
const TOKEN_DECIMALS: Record<SwapToken, number> = { USDC: 6, EURC: 6, cirBTC: 8, tUSDC: 6, tARC: 18 };
const OTC_CONTRACT: Partial<Record<SwapToken, `0x${string}`>> = { USDC: CONTRACTS.USDC as `0x${string}`, tUSDC: CONTRACTS.tUSDC as `0x${string}`, tARC: CONTRACTS.tARC as `0x${string}` };
const OTC_TOKENS: readonly SwapToken[] = ['USDC', 'tUSDC', 'tARC'];

interface Quote { rail: 'circle' | 'otc'; inputAmount: number; outputAmount: number; rate: number; fee: number; feeLabel: string; routeAvailable: boolean; stopLimit?: string; }
interface SwapRecord { id: string; fromToken: string; toToken: string; inputAmount: number; outputAmount: number; status: string; inboundTxHash: string; outboundTxHash?: string; createdAt: string; rail?: string; }
type ExecutionOrigin = 'manual' | 'agent' | null;

function isOtcPair(fromToken: SwapToken, toToken: SwapToken) { return OTC_TOKENS.includes(fromToken) && OTC_TOKENS.includes(toToken); }

async function preflightOtc(token: SwapToken, amount: string, address: `0x${string}`) {
  const tokenAddress = OTC_CONTRACT[token];
  if (!tokenAddress) throw new Error(`No ARCTIS contract is configured for ${token}.`);
  const client = createPublicClient({ transport: http(RPC_URL) });
  const amountBig = parseUnits(amount, TOKEN_DECIMALS[token]);
  const [nativeBalance, gasPrice, tokenBalance] = await Promise.all([
    client.getBalance({ address }),
    client.getGasPrice(),
    client.readContract({ address: tokenAddress, abi: ERC20_ABI, functionName: 'balanceOf', args: [address] }),
  ]);
  if (tokenBalance < amountBig) throw new Error(`Insufficient ${token}. Required ${amount}, available ${formatUnits(tokenBalance, TOKEN_DECIMALS[token])}. No transfer was submitted.`);
  const requiredGas = gasPrice * 100_000n * 2n;
  if (nativeBalance < requiredGas) throw new Error(`Insufficient ARC for the swap transaction. Approximately ${formatEther(requiredGas)} ARC is required. No token was sent.`);
}

function feeFromSwapEstimate(fees: unknown): number {
  if (!Array.isArray(fees)) return 0;
  return fees.reduce((sum, item) => {
    const value = Number((item as { amount?: string | number })?.amount ?? 0);
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);
}

function SwapPageInner() {
  const { isConnected, address, chainId, connector } = useAccount();
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const { pendingAction, setPendingAction } = useAppStore();
  const { getAuthHeaders } = useWalletAuth();

  // Manual is intentionally the default. Agent mode is entered only by the user
  // through ModeTabs or an explicit AI action, never by an automatic URL switch.
  const [fromToken, setFromToken] = useState<SwapToken>('USDC');
  const [toToken, setToToken] = useState<SwapToken>('tUSDC');
  const [showFromMenu, setShowFromMenu] = useState(false);
  const [showToMenu, setShowToMenu] = useState(false);
  const [amount, setAmount] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [step, setStep] = useState<'idle' | 'estimating' | 'sending' | 'processing' | 'completed' | 'error'>('idle');
  const [inboundTxHash, setInboundTxHash] = useState<`0x${string}`>();
  const [outboundTxHash, setOutboundTxHash] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [history, setHistory] = useState<SwapRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [mode, setMode] = useState<ExecutionMode>('manual');
  const [agentExecuting, setAgentExecuting] = useState(false);
  const [executionOrigin, setExecutionOrigin] = useState<ExecutionOrigin>(null);

  const { isSuccess: inboundConfirmed } = useWaitForTransactionReceipt({ hash: inboundTxHash, query: { enabled: !!inboundTxHash } });

  useEffect(() => {
    if (pendingAction?.action !== 'swap') return;
    if (pendingAction.fromToken) setFromToken(pendingAction.fromToken as SwapToken);
    if (pendingAction.toToken) setToToken(pendingAction.toToken as SwapToken);
    setAmount(pendingAction.amount);
    setPendingAction(null);
    setMode('agent');
    toast.success('Pre-filled from ARCTIS AI — review before swapping');
  }, [pendingAction, setPendingAction]);

  useEffect(() => {
    if (!showHistory || !address) return;
    Promise.all([
      fetch(`/api/swap/history?wallet=${address}`).then((r) => r.json()).catch(() => ({ swaps: [] })),
      Promise.resolve(localStorage.getItem(`arctis-swap-history:${address.toLowerCase()}`)).then((raw) => raw ? JSON.parse(raw) : []).catch(() => []),
    ]).then(([remote, local]) => {
      const merged = [...(remote.swaps ?? []), ...(local ?? [])] as SwapRecord[];
      setHistory(Array.from(new Map(merged.map((x) => [x.id, x])).values()).slice(0, 50));
    });
  }, [showHistory, address]);

  const amountNum = Number(amount);
  const pairValid = fromToken !== toToken;
  const circlePair = isCircleSwapPair(fromToken, toToken);
  const otcPair = isOtcPair(fromToken, toToken) && !circlePair;
  const amountValid = Number.isFinite(amountNum) && amountNum > 0 && amountNum <= 100000;

  const loadQuote = useCallback(async () => {
    if (!isConnected || !address || !connector || !amountValid || !pairValid || chainId !== 5042002) {
      setQuote(null);
      return;
    }
    setStep('estimating');
    setQuoteError(null);
    try {
      if (circlePair) {
        const provider = await connector.getProvider();
        const adapter = await createViemAdapterFromProvider({ provider: provider as never, capabilities: { addressContext: 'user-controlled', supportedChains: [ArcTestnet] } });
        const kit = new AppKit();
        const estimate = await kit.estimateSwap({ from: { adapter, chain: 'Arc_Testnet' }, tokenIn: fromToken, tokenOut: toToken, amountIn: amountNum.toString(), config: { slippageBps: 100 } });
        const estimatedOutput = Number(estimate.estimatedOutput.amount);
        setQuote({ rail: 'circle', inputAmount: amountNum, outputAmount: estimatedOutput, rate: estimatedOutput / amountNum, fee: feeFromSwapEstimate(estimate.fees), feeLabel: 'Circle provider / kit fees', routeAvailable: true, stopLimit: estimate.stopLimit.amount });
      } else if (otcPair) {
        const response = await fetch(`/api/swap/quote?from=${encodeURIComponent(fromToken)}&to=${encodeURIComponent(toToken)}&amount=${encodeURIComponent(amount)}`);
        const data = await response.json();
        if (!response.ok && data.routeAvailable !== false) throw new Error(data.error ?? 'OTC quote unavailable');
        if (data.routeAvailable === false) {
          setQuote({ rail: 'otc', inputAmount: Number(data.inputAmount ?? amountNum), outputAmount: Number(data.outputAmount ?? 0), rate: Number(data.rate ?? 0), fee: Number(data.fee ?? 0), feeLabel: 'ARCTIS OTC fee', routeAvailable: false });
          setQuoteError(data.error ?? 'ARCTIS OTC liquidity is unavailable.');
        } else {
          setQuote({ rail: 'otc', inputAmount: data.inputAmount, outputAmount: data.outputAmount, rate: data.rate, fee: data.fee, feeLabel: 'ARCTIS OTC fee (0.3%)', routeAvailable: true });
        }
      }
      setStep('idle');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to get a live swap quote.';
      setQuote(null);
      setQuoteError(message);
      setStep('idle');
      if (agentExecuting) setAgentExecuting(false);
    }
  }, [isConnected, address, connector, amountValid, pairValid, chainId, circlePair, otcPair, fromToken, toToken, amountNum, amount, agentExecuting]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadQuote(), 450);
    return () => window.clearTimeout(timer);
  }, [loadQuote]);

  const saveLocal = useCallback((record: SwapRecord) => {
    if (!address) return;
    setHistory((prev) => [record, ...prev.filter((x) => x.id !== record.id)].slice(0, 50));
    try {
      localStorage.setItem(`arctis-swap-history:${address.toLowerCase()}`, JSON.stringify([record, ...history.filter((x) => x.id !== record.id)].slice(0, 50)));
    } catch {}
  }, [address, history]);

  useEffect(() => {
    if (!inboundConfirmed || step !== 'sending' || !inboundTxHash || !address || !quote || quote.rail !== 'otc') return;
    setStep('processing');
    void (async () => {
      try {
        const headers = await getAuthHeaders();
        const response = await fetch('/api/swap/execute', { method: 'POST', headers, body: JSON.stringify({ walletAddress: address, fromToken, toToken, amount: amountNum, inboundTxHash }) });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error ?? 'ARCTIS OTC settlement failed.');
        setOutboundTxHash(data.outboundTxHash ?? null);
        setStep('completed');
        saveLocal({ id: inboundTxHash, fromToken, toToken, inputAmount: amountNum, outputAmount: Number(data.outputAmount), status: 'completed', inboundTxHash, outboundTxHash: data.outboundTxHash, createdAt: new Date().toISOString(), rail: 'ARCTIS OTC' });
        toast.success(`Swapped ${amount} ${fromToken} → ${Number(data.outputAmount).toFixed(4)} ${toToken}`);
      } catch (error) {
        setErrorMsg(error instanceof Error ? error.message : 'Swap settlement failed.');
        setStep('error');
        setAgentExecuting(false);
      }
    })();
  }, [inboundConfirmed, step, inboundTxHash, address, quote, fromToken, toToken, amountNum, getAuthHeaders, saveLocal, amount]);

  const executeSwap = useCallback(async () => {
    if (!isConnected || !address || !connector || !quote || !quote.routeAvailable || !amountValid) return;
    setExecutionOrigin((current) => current ?? 'manual');
    setErrorMsg(null);
    setStep('sending');
    try {
      if (chainId !== 5042002) await switchChainAsync({ chainId: 5042002 });
      const provider = await connector.getProvider();
      const adapter = await createViemAdapterFromProvider({ provider: provider as never, capabilities: { addressContext: 'user-controlled', supportedChains: [ArcTestnet] } });
      const kit = new AppKit();
      if (quote.rail === 'circle') {
        const estimate = await kit.estimateSwap({ from: { adapter, chain: 'Arc_Testnet' }, tokenIn: fromToken, tokenOut: toToken, amountIn: amountNum.toString(), config: { slippageBps: 100 } });
        const result = await kit.swap({ from: { adapter, chain: 'Arc_Testnet' }, tokenIn: fromToken, tokenOut: toToken, amountIn: amountNum.toString(), config: { slippageBps: 100, stopLimit: estimate.stopLimit.amount } });
        const txHash = result.txHash as `0x${string}`;
        const output = Number(result.amountOut ?? estimate.estimatedOutput.amount);
        setInboundTxHash(txHash);
        setOutboundTxHash(txHash);
        setStep('completed');
        saveLocal({ id: txHash, fromToken, toToken, inputAmount: amountNum, outputAmount: output, status: 'completed', inboundTxHash: txHash, outboundTxHash: txHash, createdAt: new Date().toISOString(), rail: 'Circle Swap' });
        toast.success(`Circle Swap complete: ${amount} ${fromToken} → ${output.toFixed(6)} ${toToken}`);
        return;
      }
      const swapWallet = process.env.NEXT_PUBLIC_SWAP_WALLET_ADDRESS as `0x${string}` | undefined;
      if (!swapWallet || /^0x0{40}$/i.test(swapWallet)) throw new Error('ARCTIS swap wallet is not configured.');
      await preflightOtc(fromToken, amount, address as `0x${string}`);
      const amountBig = parseUnits(amountNum.toFixed(TOKEN_DECIMALS[fromToken]), TOKEN_DECIMALS[fromToken]);
      const hash = await writeContractAsync({ address: OTC_CONTRACT[fromToken]!, abi: ERC20_ABI, functionName: 'transfer', args: [swapWallet, amountBig] });
      setInboundTxHash(hash);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Swap failed.';
      setErrorMsg(message);
      setStep('error');
      setAgentExecuting(false);
    }
  }, [isConnected, address, connector, quote, amountValid, chainId, switchChainAsync, fromToken, toToken, amountNum, amount, writeContractAsync, saveLocal]);

  const executeAgentSwap = useCallback(async (proposal: import('@/lib/store').PendingFinancialAction) => {
    if (!proposal.amount || !proposal.fromToken || !proposal.toToken) throw new Error('Swap proposal is incomplete.');
    const from = proposal.fromToken as SwapToken;
    const to = proposal.toToken as SwapToken;
    if (from === to || (!isCircleSwapPair(from, to) && !isOtcPair(from, to))) throw new Error('This swap pair is not supported.');
    setExecutionOrigin('agent');
    setErrorMsg(null);
    setQuoteError(null);
    setFromToken(from);
    setToToken(to);
    setAmount(proposal.amount);
    setMode('agent');
    setAgentExecuting(true);
  }, []);

  useEffect(() => {
    if (!agentExecuting || !quote || !quote.routeAvailable || step !== 'idle') return;
    void executeSwap();
  }, [agentExecuting, quote, step, executeSwap]);

  useEffect(() => {
    if (agentExecuting && (step === 'completed' || step === 'error')) setAgentExecuting(false);
  }, [agentExecuting, step]);

  const reset = () => {
    setStep('idle');
    setAmount('');
    setQuote(null);
    setQuoteError(null);
    setErrorMsg(null);
    setInboundTxHash(undefined);
    setOutboundTxHash(null);
    setAgentExecuting(false);
    setExecutionOrigin(null);
  };

  return (
    <div className="page-container max-w-lg safe-bottom">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-7">
        <div>
          <span className="text-surface-500 text-xs font-semibold uppercase tracking-widest">Stablecoin OS</span>
          <h1 className="text-2xl font-bold text-surface-950 tracking-tight mt-1">Swap</h1>
          <p className="text-surface-600 text-sm mt-1">Circle liquidity + ARCTIS OTC settlement</p>
        </div>
        <button onClick={() => setShowHistory((v) => !v)} aria-label="Swap history" className={cn('btn-ghost', showHistory && 'bg-blue-500/10 text-blue-600')}>
          <History className="w-4 h-4" />
        </button>
      </motion.div>

      <div className="mb-5"><ModeTabs mode={mode} onChange={(nextMode) => { setMode(nextMode); setExecutionOrigin(null); setAgentExecuting(false); setStep('idle'); setErrorMsg(null); setQuoteError(null); }} /></div>

      {mode === 'agent' ? (
        <>
          <EconomicAgentPanel
            action="swap"
            onExecute={executeAgentSwap}
            executionStatus={executionOrigin === 'agent' ? (agentExecuting ? (step === 'error' ? 'failed' : step === 'completed' ? 'success' : 'executing') : step === 'completed' ? 'success' : step === 'error' ? 'failed' : 'idle') : 'idle'}
            executionError={executionOrigin === 'agent' && step === 'error' ? (errorMsg ?? quoteError) : null}
            executionTxHash={executionOrigin === 'agent' ? (outboundTxHash ?? inboundTxHash ?? null) : null}
          />
          {quoteError && !agentExecuting && <div className="mt-3 glass-card p-3 border-amber-500/20 bg-amber-500/5 flex gap-2"><Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" /><p className="text-sm text-amber-700 dark:text-amber-400">Circle quote failed: {quoteError}</p></div>}
        </>
      ) : showHistory ? (
        <div className="space-y-3">
          {history.length === 0 ? <div className="glass-card p-10 text-center"><History className="w-8 h-8 mx-auto mb-3 text-surface-500" /><p className="text-surface-600 text-sm">No swaps yet.</p></div> : history.map((s) => <div key={s.id} className="glass-card p-4 flex items-center justify-between gap-3"><div><p className="text-sm font-medium text-surface-950">{s.inputAmount} {s.fromToken} → {s.outputAmount.toFixed(6)} {s.toToken}</p><p className="text-xs text-surface-500 mt-1">{s.rail ?? 'Swap'} · {formatRelative(s.createdAt)}</p></div><span className="text-xs px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-600">{s.status}</span></div>)}
        </div>
      ) : step === 'completed' && executionOrigin === 'manual' ? (
        <motion.div initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} className="glass-card p-7 text-center space-y-5">
          <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto"><CheckCircle2 className="w-8 h-8 text-emerald-600" /></div>
          <div><h2 className="text-xl font-bold text-surface-950">Swap Complete</h2><p className="text-surface-600 text-sm mt-1">{amount} {fromToken} → {quote?.outputAmount.toFixed(6)} {toToken}</p></div>
          <div className="rounded-xl bg-surface-100/70 dark:bg-white/[.04] p-4 text-left space-y-2 text-sm"><div className="flex justify-between"><span className="text-surface-600">Execution rail</span><span className="font-medium text-surface-950">{quote?.rail === 'circle' ? 'Circle App Kit Swap' : 'ARCTIS OTC'}</span></div><div className="flex justify-between"><span className="text-surface-600">Transaction</span><span className="font-mono text-surface-950">{inboundTxHash ? `${inboundTxHash.slice(0, 8)}…${inboundTxHash.slice(-6)}` : 'confirmed'}</span></div></div>
          {inboundTxHash && <a href={txUrl(inboundTxHash)} target="_blank" rel="noopener noreferrer" className="btn-ghost w-full justify-center">View transaction <ExternalLink className="w-4 h-4" /></a>}
          <button onClick={reset} className="btn-primary w-full justify-center"><RefreshCw className="w-4 h-4" /> New swap</button>
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {!isConnected && <div className="glass-card p-9 text-center"><Wallet className="w-9 h-9 mx-auto mb-3 text-surface-500" /><p className="text-surface-600 text-sm">Connect your wallet to swap.</p></div>}
          {isConnected && <>
            <div className="glass-card p-5 space-y-4">
              <div className="flex items-center justify-between"><div><p className="text-sm font-semibold text-surface-950">Manual swap</p><p className="text-xs text-surface-500 mt-0.5">Choose the pair and enter the amount yourself.</p></div><span className="text-xs px-2 py-1 rounded-full bg-blue-500/10 text-blue-600">User controlled</span></div>
              <div className="relative">
                <label className="text-surface-600 text-xs font-medium uppercase tracking-wider">From</label>
                <button onClick={() => setShowFromMenu((v) => !v)} className="mt-1 w-full flex items-center justify-between px-4 py-3 rounded-xl bg-black/[.04] dark:bg-white/[.04] border border-black/[.08] dark:border-white/[.08]"><span className="font-medium text-surface-950">{fromToken}</span><ChevronDown className="w-4 h-4 text-surface-500" /></button>
                {showFromMenu && <div className="absolute left-0 right-0 top-full mt-1 z-30 glass-card overflow-hidden">{TOKENS.filter((t) => t !== toToken).map((t) => <button key={t} onClick={() => { setFromToken(t); setShowFromMenu(false); setQuote(null); }} className="w-full text-left px-4 py-3 text-sm hover:bg-black/[.05] dark:hover:bg-white/[.05]">{t}{isCircleSwapToken(t) ? ' · Circle' : ' · ARCTIS OTC'}</button>)}</div>}
              </div>
              <div>
                <label htmlFor="manual-swap-amount" className="text-surface-600 text-xs font-medium uppercase tracking-wider">Amount</label>
                <div className="relative mt-1">
                  <input id="manual-swap-amount" value={amount} onChange={(e) => { setAmount(e.target.value); setErrorMsg(null); setQuoteError(null); }} type="number" min="0" step="any" inputMode="decimal" placeholder="0.00" aria-label={`Amount of ${fromToken} to swap`} className="input-field w-full pr-20 text-lg font-mono" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-surface-500">{fromToken}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-center -my-1 relative z-10"><button onClick={() => { const f = fromToken; setFromToken(toToken); setToToken(f); setAmount(''); setQuote(null); }} className="w-9 h-9 rounded-full bg-surface-0 border border-black/[.08] shadow-sm text-surface-600 hover:text-blue-600 flex items-center justify-center" aria-label="Flip swap"><ArrowLeftRight className="w-4 h-4" /></button></div>

            <div className="glass-card p-5 space-y-3">
              <label className="text-surface-600 text-xs font-medium uppercase tracking-wider">To</label>
              <div className="relative"><button onClick={() => setShowToMenu((v) => !v)} className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-black/[.04] dark:bg-white/[.04] border border-black/[.08] dark:border-white/[.08]"><span className="font-medium text-surface-950">{toToken}</span><ChevronDown className="w-4 h-4 text-surface-500" /></button>{showToMenu && <div className="absolute left-0 right-0 top-full mt-1 z-30 glass-card overflow-hidden">{TOKENS.filter((t) => t !== fromToken).map((t) => <button key={t} onClick={() => { setToToken(t); setShowToMenu(false); setQuote(null); }} className="w-full text-left px-4 py-3 text-sm hover:bg-black/[.05] dark:hover:bg-white/[.05]">{t}{isCircleSwapToken(t) ? ' · Circle' : ' · ARCTIS OTC'}</button>)}</div>}</div>
              <div className="text-right text-xl font-mono text-surface-950">{quote?.routeAvailable ? quote.outputAmount.toFixed(6) : '—'}</div>
            </div>

            <div className="rounded-xl border border-violet-500/15 bg-violet-500/[.04] p-4 space-y-2"><div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-violet-600" /><span className="text-sm font-semibold text-surface-950">{circlePair ? 'Circle App Kit Swap' : 'ARCTIS OTC Settlement'}</span></div><p className="text-xs text-surface-600 leading-relaxed">{circlePair ? 'Arc Testnet Circle liquidity: USDC, EURC and cirBTC. Quote and slippage are checked immediately before wallet approval.' : 'Custom tUSDC and tARC are ARCTIS-owned assets. Pricing, reserve checks and settlement remain in the ARCTIS OTC layer.'}</p></div>
            {chainId !== 5042002 && <div className="glass-card p-3 bg-amber-500/5 border-amber-500/20 text-sm text-amber-700 dark:text-amber-400">Switch to Arc Testnet for Swap. Circle Testnet Swap is currently available on Arc Testnet only.</div>}
            {quote && quote.routeAvailable && <div className="glass-card p-4 space-y-2 text-sm"><div className="flex justify-between"><span className="text-surface-600">Rate</span><span className="font-mono text-surface-950">1 {fromToken} ≈ {quote.rate.toFixed(8)} {toToken}</span></div><div className="flex justify-between"><span className="text-surface-600">Fee</span><span className="font-mono text-surface-950">{quote.fee > 0 ? `${quote.fee.toFixed(6)} ${fromToken}` : 'Included in quote'}</span></div>{quote.stopLimit && <div className="flex justify-between"><span className="text-surface-600">Minimum output</span><span className="font-mono font-semibold text-surface-950">{quote.stopLimit} {toToken}</span></div>}</div>}
            {quoteError && <div className="glass-card p-3 border-amber-500/20 bg-amber-500/5 flex gap-2"><Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" /><p className="text-sm text-amber-700 dark:text-amber-400">{quoteError}</p></div>}
            {errorMsg && <div className="glass-card p-3 border-rose-500/20 bg-rose-500/5 flex gap-2"><AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" /><p className="text-sm text-rose-600 dark:text-rose-400">{errorMsg}</p></div>}
            {step === 'estimating' && <div className="text-center text-xs text-surface-500"><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Getting live quote…</div>}
            {(step === 'sending' || step === 'processing') && <button disabled className="btn-primary w-full justify-center opacity-70"><Loader2 className="w-4 h-4 animate-spin" />{step === 'sending' ? 'Confirm in wallet…' : 'Settling…'}</button>}
            {(step === 'idle' || step === 'error') && <button onClick={() => void executeSwap()} disabled={!quote?.routeAvailable || !amountValid || !pairValid || chainId !== 5042002 || isSwitching} className="btn-primary w-full justify-center text-base py-3.5 disabled:opacity-40"><ArrowLeftRight className="w-4 h-4" />{isSwitching ? 'Switching…' : 'Review & Swap'}</button>}
            <p className="text-center text-surface-500 text-xs">Preflight → live quote → slippage guard → wallet approval → settlement</p>
          </>}
        </motion.div>
      )}
    </div>
  );
}

export default function SwapPage() { return <Suspense fallback={<div className="page-container max-w-lg flex items-center justify-center min-h-[60vh]"><div className="text-surface-500 text-sm">Loading…</div></div>}><SwapPageInner /></Suspense>; }
