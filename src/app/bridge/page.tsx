'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAccount, useSwitchChain } from 'wagmi';
import { createViemAdapterFromProvider } from '@circle-fin/adapter-viem-v2';
import { AppKit } from '@circle-fin/app-kit';
import { createPublicClient, formatEther, formatUnits, http, parseUnits } from 'viem';
import { GitMerge, CheckCircle2, AlertCircle, ExternalLink, ChevronDown, RefreshCw, History, Wallet, Info, Loader2, ShieldCheck } from 'lucide-react';
import { cn, formatRelative } from '@/lib/utils';
import { ERC20_ABI, RPC_FALLBACK_URLS } from '@/lib/contracts';
import { getBridgePolicy } from '@/lib/bridge/policy';
import { ModeTabs, type ExecutionMode } from '@/components/agent/ModeTabs';
import { EconomicAgentPanel } from '@/components/agent/EconomicAgentPanel';
import { useAppStore } from '@/lib/store';
import toast from 'react-hot-toast';

type AppKitChain = 'Arc_Testnet' | 'Ethereum_Sepolia' | 'Base_Sepolia' | 'Arbitrum_Sepolia';
interface BridgeChain { chain: string; chainId: number; domain: number; usdc: string; explorer: string; appKitChain: AppKitChain; enabled: boolean; }
interface BridgeQuote { amount: number; fee: number; providerFee: number; forwarderFee: number; gasFee: number; feeToken: string; estimatedOutput: number; feeEstimated?: boolean; }
interface BridgeRecord { burnTxHash: string; walletAddress: string; sourceChain: string; sourceChainId: number; destinationChain?: string; destinationChainId?: number; amount: number; status: string; forwardTxHash?: string; createdAt: string; completedAt?: string; }
type BridgeStep = 'idle' | 'estimating' | 'executing' | 'completed' | 'error';

const BRIDGE_NATIVE_RPC: Record<number, string> = {
  5042002: RPC_FALLBACK_URLS[0] ?? 'https://rpc.testnet.arc.network',
  11155111: 'https://ethereum-sepolia-rpc.publicnode.com',
  84532: 'https://sepolia.base.org',
  421614: 'https://sepolia-rollup.arbitrum.io/rpc',
};
const BRIDGE_NATIVE_SYMBOL: Record<number, string> = { 5042002: 'ARC', 11155111: 'ETH', 84532: 'ETH', 421614: 'ETH' };
const policy = getBridgePolicy();

async function preflightSource(chain: BridgeChain, address: string, amount: string) {
  const rpc = BRIDGE_NATIVE_RPC[chain.chainId];
  if (!rpc) throw new Error(`No source-chain balance check is configured for ${chain.chain}.`);
  const client = createPublicClient({ transport: http(rpc) });
  const requiredUsdc = parseUnits(amount, 6);
  const [nativeBalance, gasPrice, usdcBalance] = await Promise.all([
    client.getBalance({ address: address as `0x${string}` }),
    client.getGasPrice(),
    client.readContract({ address: chain.usdc as `0x${string}`, abi: ERC20_ABI, functionName: 'balanceOf', args: [address as `0x${string}`] }),
  ]);
  if (usdcBalance < requiredUsdc) {
    throw new Error(`Insufficient USDC on ${chain.chain}. Required ${formatUnits(requiredUsdc, 6)}, available ${formatUnits(usdcBalance, 6)}. No USDC will be burned.`);
  }
  // Only source gas is required from the user. Circle Forwarding pays for the destination mint.
  const requiredNativeGas = gasPrice * 300_000n * 2n;
  if (nativeBalance < requiredNativeGas) {
    const symbol = BRIDGE_NATIVE_SYMBOL[chain.chainId] ?? 'native gas';
    throw new Error(`Insufficient ${symbol} on ${chain.chain}. Approximately ${formatEther(requiredNativeGas)} ${symbol} is needed for the source transaction. No USDC will be burned.`);
  }
}

function getFeeNumber(entries: unknown, type: string): number {
  if (!Array.isArray(entries)) return 0;
  const item = entries.find((entry) => typeof entry === 'object' && entry !== null && (entry as { type?: string }).type === type) as { amount?: string | number } | undefined;
  const value = Number(item?.amount ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function extractForwardTx(result: unknown): string | undefined {
  const value = result as { forwardTxHash?: unknown; steps?: Array<{ name?: string; txHash?: string; data?: { txHash?: string } }> };
  if (typeof value.forwardTxHash === 'string') return value.forwardTxHash;
  const steps = Array.isArray(value.steps) ? value.steps : [];
  return steps.find((s) => /forward|mint|receive|complete/i.test(String(s.name)))?.txHash ??
    steps.find((s) => typeof s.data?.txHash === 'string')?.data?.txHash;
}

function BridgePageInner() {
  const searchParams = useSearchParams();
  const { isConnected, address, chainId, connector } = useAccount();
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain();
  const { pendingAction, setPendingAction } = useAppStore();

  const [chains, setChains] = useState<BridgeChain[]>([]);
  const [sourceChain, setSourceChain] = useState<BridgeChain | null>(null);
  const [destinationChain, setDestinationChain] = useState<BridgeChain | null>(null);
  const [showSourceMenu, setShowSourceMenu] = useState(false);
  const [showDestinationMenu, setShowDestinationMenu] = useState(false);
  const [amount, setAmount] = useState('');
  const [quote, setQuote] = useState<BridgeQuote | null>(null);
  const [step, setStep] = useState<BridgeStep>('idle');
  const [burnTxHash, setBurnTxHash] = useState<string>();
  const [forwardTxHash, setForwardTxHash] = useState<string>();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [history, setHistory] = useState<BridgeRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [mode, setMode] = useState<ExecutionMode>('manual');
  const [agentExecuting, setAgentExecuting] = useState(false);

  useEffect(() => { if (searchParams.get('mode') === 'agent') setMode('agent'); }, [searchParams]);

  useEffect(() => {
    fetch('/api/bridge').then((r) => r.json()).then((data: { chains?: BridgeChain[] }) => {
      const available = (data.chains ?? []).filter((c) => c.enabled);
      setChains(available);
      setSourceChain((prev) => prev ?? available.find((c) => c.chainId === 5042002) ?? available[0] ?? null);
      setDestinationChain((prev) => prev ?? available.find((c) => c.chainId === 84532) ?? available.find((c) => c.chainId !== 5042002) ?? null);
    }).catch(() => toast.error('Unable to load bridge networks'));
  }, []);

  useEffect(() => {
    if (pendingAction?.action !== 'bridge') return;
    setAmount(pendingAction.amount);
    if (pendingAction.sourceChainId) setSourceChain(chains.find((c) => c.chainId === pendingAction.sourceChainId) ?? sourceChain);
    if (pendingAction.destinationChainId) setDestinationChain(chains.find((c) => c.chainId === pendingAction.destinationChainId) ?? destinationChain);
    setPendingAction(null);
    toast.success('Pre-filled from ARCTIS AI — review before bridging');
  }, [pendingAction, chains, sourceChain, destinationChain, setPendingAction]);

  useEffect(() => {
    if (!showHistory || !address) return;
    Promise.all([
      fetch(`/api/bridge/history?wallet=${address}`).then((r) => r.json()).catch(() => ({ bridges: [] })),
      Promise.resolve(localStorage.getItem(`arctis-bridge-history:${address.toLowerCase()}`)).then((raw) => raw ? JSON.parse(raw) : []).catch(() => []),
    ]).then(([remote, local]) => {
      const merged = [...(remote.bridges ?? []), ...(local ?? [])] as BridgeRecord[];
      setHistory(Array.from(new Map(merged.map((x) => [x.burnTxHash, x])).values()).slice(0, 50));
    });
  }, [showHistory, address]);

  const amountNum = Number(amount);
  const amountValid = Number.isFinite(amountNum) && amountNum >= 0.000001 && amountNum <= 1000;
  const onSourceChain = chainId === sourceChain?.chainId;

  const estimate = useCallback(async () => {
    if (!sourceChain || !destinationChain || !address || !connector || !amountValid || sourceChain.chainId === destinationChain.chainId || !onSourceChain) {
      setQuote(null);
      return;
    }
    setStep('estimating');
    try {
      const provider = await connector.getProvider();
      const adapter = await createViemAdapterFromProvider({ provider: provider as never });
      const kit = new AppKit();
      const params = {
        from: { adapter, chain: sourceChain.appKitChain },
        to: { recipientAddress: address, chain: destinationChain.appKitChain, useForwarder: true },
        amount: amountNum.toFixed(6),
      } as const;
      const result = await kit.estimateBridge(params);
      const fees = (result as { fees?: unknown[]; gasFees?: unknown[] }).fees ?? [];
      const gasFees = (result as { gasFees?: unknown[] }).gasFees ?? [];
      const providerFee = getFeeNumber(fees, 'provider');
      const forwarderFee = getFeeNumber(fees, 'forwarder');
      const gasFee = getFeeNumber(gasFees, 'gasFee') || getFeeNumber(fees, 'gasFee');
      const totalFee = providerFee + forwarderFee + gasFee;
      setQuote({ amount: amountNum, fee: totalFee, providerFee, forwarderFee, gasFee, feeToken: 'USDC', estimatedOutput: Math.max(0, amountNum - totalFee) });
      setStep('idle');
    } catch (error) {
      setQuote(null);
      setStep('idle');
      setErrorMsg(error instanceof Error ? `Live Circle estimate unavailable: ${error.message}` : 'Live Circle estimate unavailable.');
    }
  }, [sourceChain, destinationChain, address, connector, amountValid, onSourceChain, amountNum]);

  useEffect(() => {
    const timer = window.setTimeout(() => void estimate(), 450);
    return () => window.clearTimeout(timer);
  }, [estimate]);

  const saveLocalHistory = useCallback((record: BridgeRecord) => {
    if (!address) return;
    setHistory((prev) => [record, ...prev.filter((x) => x.burnTxHash !== record.burnTxHash)].slice(0, 50));
    try { localStorage.setItem(`arctis-bridge-history:${address.toLowerCase()}`, JSON.stringify([record, ...history.filter((x) => x.burnTxHash !== record.burnTxHash)].slice(0, 50))); } catch {}
  }, [address, history]);

  const executeBridge = useCallback(async (bridgeAmount: string, route: BridgeChain, target: BridgeChain) => {
    if (!isConnected || !address || !connector) throw new Error('Connect a compatible EVM wallet first.');
    if (route.chainId === target.chainId) throw new Error('Source and destination networks must be different.');
    const parsed = Number(bridgeAmount);
    if (!Number.isFinite(parsed) || parsed < 0.000001 || parsed > 1000) throw new Error('Amount must be between 0.000001 and 1000 USDC.');

    setErrorMsg(null);
    setStep('executing');
    try {
      if (chainId !== route.chainId) await switchChainAsync({ chainId: route.chainId });
      await preflightSource(route, address, bridgeAmount);

      const provider = await connector.getProvider();
      const adapter = await createViemAdapterFromProvider({ provider: provider as never });
      const kit = new AppKit();

      // Critical safety property: Circle Forwarding handles destination minting.
      // The user only needs source-chain gas; Base/ETH/Arbitrum destination gas is not required.
      const params = {
        from: { adapter, chain: route.appKitChain },
        to: { recipientAddress: address, chain: target.appKitChain, useForwarder: true },
        amount: parsed.toFixed(6),
      } as const;

      // Re-estimate immediately before burn so the Forwarding fee is current.
      const liveEstimate = await kit.estimateBridge(params);
      const fees = (liveEstimate as { fees?: unknown[] }).fees ?? [];
      const forwarderFee = getFeeNumber(fees, 'forwarder');
      const providerFee = getFeeNumber(fees, 'provider');
      if (parsed <= providerFee + forwarderFee) throw new Error('The current Circle fees leave no transferable USDC amount.');

      const result = await kit.bridge(params);
      const state = (result as { state?: string }).state;
      if (state && state !== 'success') throw new Error(`Circle bridge did not complete (${state}).`);

      const value = result as { txHash?: string; forwardTxHash?: string; steps?: Array<{ name?: string; txHash?: string }> };
      const burn = value.txHash ?? value.steps?.find((s) => /burn|deposit/i.test(String(s.name)))?.txHash;
      const forward = extractForwardTx(result);
      setBurnTxHash(burn);
      setForwardTxHash(forward);
      setStep('completed');

      if (burn) {
        void fetch('/api/bridge/record', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ burnTxHash: burn, forwardTxHash: forward, sourceChainId: route.chainId, destinationChainId: target.chainId, walletAddress: address, amount: parsed }) }).catch(() => {});
      }
      saveLocalHistory({ burnTxHash: burn ?? `appkit-${Date.now()}`, walletAddress: address, sourceChain: route.chain, sourceChainId: route.chainId, destinationChain: target.chain, destinationChainId: target.chainId, amount: parsed, status: 'completed', forwardTxHash: forward, createdAt: new Date().toISOString(), completedAt: new Date().toISOString() });
      toast.success(`${parsed} USDC bridged with Circle Forwarding`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Bridge failed.';
      setErrorMsg(message);
      setStep('error');
      throw error;
    }
  }, [isConnected, address, connector, chainId, switchChainAsync, saveLocalHistory]);

  const executeAgentBridge = useCallback(async (proposal: import('@/lib/store').PendingFinancialAction) => {
    const route = chains.find((c) => c.chainId === proposal.sourceChainId) ?? sourceChain;
    const target = chains.find((c) => c.chainId === proposal.destinationChainId) ?? destinationChain;
    if (!route || !target || !proposal.amount) throw new Error('Bridge proposal is incomplete.');
    setSourceChain(route); setDestinationChain(target); setAmount(proposal.amount); setAgentExecuting(true);
    try { await executeBridge(proposal.amount, route, target); } catch {} finally { setAgentExecuting(false); }
  }, [chains, sourceChain, destinationChain, executeBridge]);

  const reset = () => { setStep('idle'); setAmount(''); setQuote(null); setBurnTxHash(undefined); setForwardTxHash(undefined); setErrorMsg(null); setAgentExecuting(false); };

  return (
    <div className="page-container max-w-lg safe-bottom">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-7">
        <div>
          <span className="text-surface-500 text-xs font-semibold uppercase tracking-widest">Stablecoin OS</span>
          <h1 className="text-2xl font-bold text-surface-950 tracking-tight mt-1">Bridge USDC</h1>
          <p className="text-surface-600 text-sm mt-1">Circle CCTP V2 · Forwarding-first execution</p>
        </div>
        <button onClick={() => setShowHistory((v) => !v)} aria-label="Bridge history" className={cn('btn-ghost', showHistory && 'bg-blue-500/10 text-blue-600')}><History className="w-4 h-4" /></button>
      </motion.div>

      <div className="mb-5"><ModeTabs mode={mode} onChange={setMode} /></div>

      {mode === 'agent' ? (
        <EconomicAgentPanel action="bridge" onExecute={executeAgentBridge} executionStatus={agentExecuting ? (step === 'error' ? 'failed' : step === 'completed' ? 'success' : 'executing') : 'idle'} executionError={step === 'error' ? errorMsg : null} executionTxHash={forwardTxHash ?? burnTxHash ?? null} />
      ) : showHistory ? (
        <div className="space-y-3">
          {history.length === 0 ? <div className="glass-card p-10 text-center"><History className="w-8 h-8 mx-auto mb-3 text-surface-500" /><p className="text-surface-600 text-sm">No bridge transfers yet.</p></div> : history.map((item) => (
            <div key={item.burnTxHash} className="glass-card p-4 flex items-center justify-between gap-3"><div><p className="text-sm font-medium text-surface-950">{item.amount} USDC · {item.sourceChain} → {item.destinationChain}</p><p className="text-xs text-surface-500 mt-1">{formatRelative(item.createdAt)}</p></div><span className="text-xs px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-600">{item.status}</span></div>
          ))}
        </div>
      ) : step === 'completed' ? (
        <motion.div initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} className="glass-card p-7 text-center space-y-5">
          <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto"><CheckCircle2 className="w-8 h-8 text-emerald-600" /></div>
          <div><h2 className="text-xl font-bold text-surface-950">Bridge Submitted</h2><p className="text-surface-600 text-sm mt-1">Circle Forwarding is handling the destination mint.</p></div>
          <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/15 p-4 text-left space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-surface-600">Route</span><span className="font-medium text-surface-950">{sourceChain?.chain} → {destinationChain?.chain}</span></div>
            <div className="flex justify-between"><span className="text-surface-600">Amount</span><span className="font-mono text-surface-950">{amount} USDC</span></div>
            <div className="flex justify-between"><span className="text-surface-600">Destination gas</span><span className="font-semibold text-emerald-600">Covered by Circle Forwarding</span></div>
          </div>
          {burnTxHash && <a href={`${sourceChain?.explorer}/tx/${burnTxHash}`} target="_blank" rel="noopener noreferrer" className="btn-ghost w-full justify-center">View source burn <ExternalLink className="w-4 h-4" /></a>}
          {forwardTxHash && <a href={`${destinationChain?.explorer}/tx/${forwardTxHash}`} target="_blank" rel="noopener noreferrer" className="btn-ghost w-full justify-center">View destination mint <ExternalLink className="w-4 h-4" /></a>}
          <button onClick={reset} className="btn-primary w-full justify-center"><RefreshCw className="w-4 h-4" /> New bridge</button>
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {!isConnected && <div className="glass-card p-8 text-center"><Wallet className="w-9 h-9 mx-auto mb-3 text-surface-500" /><p className="text-surface-600 text-sm">Connect your wallet to bridge USDC.</p></div>}
          {isConnected && (
            <>
              <div className="glass-card p-5 space-y-4">
                <div className="relative"><label className="text-surface-600 text-xs font-medium uppercase tracking-wider">From</label><button onClick={() => setShowSourceMenu((v) => !v)} className="mt-1 w-full flex items-center justify-between px-4 py-3 rounded-xl bg-black/[.04] dark:bg-white/[.04] border border-black/[.08] dark:border-white/[.08]"><span className="text-sm font-medium text-surface-950">{sourceChain?.chain ?? 'Select source'}</span><ChevronDown className="w-4 h-4 text-surface-500" /></button>{showSourceMenu && <div className="absolute left-0 right-0 top-full mt-1 z-30 glass-card overflow-hidden">{chains.map((c) => <button key={c.chainId} onClick={() => { setSourceChain(c); setShowSourceMenu(false); }} className="w-full text-left px-4 py-3 text-sm hover:bg-black/[.05] dark:hover:bg-white/[.05]">{c.chain}</button>)}</div>}</div>
                <div className="relative"><label className="text-surface-600 text-xs font-medium uppercase tracking-wider">To</label><button onClick={() => setShowDestinationMenu((v) => !v)} className="mt-1 w-full flex items-center justify-between px-4 py-3 rounded-xl bg-black/[.04] dark:bg-white/[.04] border border-black/[.08] dark:border-white/[.08]"><span className="text-sm font-medium text-surface-950">{destinationChain?.chain ?? 'Select destination'}</span><ChevronDown className="w-4 h-4 text-surface-500" /></button>{showDestinationMenu && <div className="absolute left-0 right-0 top-full mt-1 z-30 glass-card overflow-hidden">{chains.filter((c) => c.chainId !== sourceChain?.chainId).map((c) => <button key={c.chainId} onClick={() => { setDestinationChain(c); setShowDestinationMenu(false); }} className="w-full text-left px-4 py-3 text-sm hover:bg-black/[.05] dark:hover:bg-white/[.05]">{c.chain}</button>)}</div>}</div>
                <div><label className="text-surface-600 text-xs font-medium uppercase tracking-wider">Amount</label><input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min="0" step="0.000001" placeholder="0.00" className="input-field w-full mt-1" /></div>
              </div>

              <div className="rounded-xl border border-blue-500/15 bg-blue-500/[.04] p-4 space-y-2">
                <div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-blue-600" /><span className="text-sm font-semibold text-surface-950">{policy.label}</span></div>
                <p className="text-xs leading-relaxed text-surface-600">{policy.explanation}</p>
                <div className="flex items-center gap-2 text-xs text-emerald-600"><CheckCircle2 className="w-3.5 h-3.5" /> Destination native gas is not required from you.</div>
              </div>

              {chainId !== sourceChain?.chainId && <div className="glass-card p-3 border-amber-500/20 bg-amber-500/5 text-sm text-amber-700 dark:text-amber-400">Switch to <strong>{sourceChain?.chain}</strong> to get a live Circle quote and execute.</div>}

              {quote && <div className="glass-card p-4 space-y-2 text-sm"><div className="flex justify-between"><span className="text-surface-600">You send</span><span className="font-mono text-surface-950">{quote.amount.toFixed(6)} USDC</span></div><div className="flex justify-between"><span className="text-surface-600">Circle protocol fee</span><span className="font-mono text-surface-950">{quote.providerFee.toFixed(6)} USDC</span></div><div className="flex justify-between"><span className="text-surface-600">Forwarding fee</span><span className="font-mono text-surface-950">{quote.forwarderFee.toFixed(6)} USDC</span></div><div className="flex justify-between"><span className="text-surface-600">Estimated receive</span><span className="font-mono font-semibold text-surface-950">{quote.estimatedOutput.toFixed(6)} USDC</span></div></div>}

              {errorMsg && <div className="glass-card p-3 border-rose-500/20 bg-rose-500/5 flex gap-2"><AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" /><p className="text-sm text-rose-600 dark:text-rose-400">{errorMsg}</p></div>}
              {step === 'estimating' && <div className="text-center text-xs text-surface-500"><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Refreshing Circle quote…</div>}

              <button onClick={() => sourceChain && destinationChain && void executeBridge(amount, sourceChain, destinationChain)} disabled={!amountValid || !sourceChain || !destinationChain || !quote || step === 'executing' || isSwitching} className="btn-primary w-full justify-center text-base py-3.5 disabled:opacity-40"><GitMerge className="w-4 h-4" />{step === 'executing' ? 'Confirm in wallet…' : isSwitching ? 'Switching network…' : 'Review & Bridge'}</button>
              <p className="text-center text-surface-500 text-xs">Preflight → live fee estimate → human approval → CCTP burn → Circle Forwarding mint</p>
            </>
          )}
        </motion.div>
      )}
    </div>
  );
}

export default function BridgePage() {
  return <Suspense fallback={<div className="page-container max-w-lg flex items-center justify-center min-h-[60vh]"><div className="text-surface-500 text-sm">Loading…</div></div>}><BridgePageInner /></Suspense>;
}
