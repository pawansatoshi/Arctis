'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from 'wagmi';
import { parseUnits } from 'viem';
import {
  GitMerge, CheckCircle2, AlertCircle, ExternalLink,
  ChevronDown, RefreshCw, History, Wallet, Info, Loader2, Clock,
} from 'lucide-react';
import { cn, formatRelative, formatAddress } from '@/lib/utils';
import { CCTP_TOKEN_MESSENGER_ABI, ERC20_ABI, txUrl } from '@/lib/contracts';
import { buildBridgeMemo } from '@/lib/memo/service';
import { useMemo as useArcMemo } from '@/lib/memo/useMemo';
import { useAppStore } from '@/lib/store';
import { useWalletAuth } from '@/lib/auth/useWalletAuth';
import toast from 'react-hot-toast';

interface BridgeRoute {
  sourceChain: string; sourceChainId: number; sourceDomain: number;
  usdc: string; tokenMessengerV2: string; explorer: string; enabled: boolean;
}
interface BridgeQuote {
  sourceChain: string; sourceChainId: number; sourceDomain: number;
  destinationChain: string; destinationDomain: number;
  fee: number; feeToken: string; estimatedTime: string;
  minAmount: number; maxAmount: number; feeEstimated?: boolean;
}
interface BridgeRecord {
  burnTxHash: string; walletAddress: string; sourceChain: string; sourceChainId: number;
  amount: number; status: string; forwardTxHash?: string; createdAt: string; completedAt?: string;
}
type BridgeStep = 'idle' | 'approving' | 'approved' | 'burning' | 'attesting' | 'completed' | 'timeout' | 'error';

const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000' as const;
const STATUS_POLL_INTERVAL = 5_000;

function addressToBytes32(address: string): `0x${string}` {
  return `0x${'0'.repeat(24)}${address.slice(2).toLowerCase()}` as `0x${string}`;
}

export default function BridgePage() {
  const { isConnected, address, chainId } = useAccount();
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const { dispatchMemo } = useArcMemo();

  const [routes, setRoutes] = useState<BridgeRoute[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<BridgeRoute | null>(null);
  const [showChainMenu, setShowChainMenu] = useState(false);
  const [amount, setAmount] = useState('');
  const [quote, setQuote] = useState<BridgeQuote | null>(null);

  const [step, setStep] = useState<BridgeStep>('idle');
  const [approveTxHash, setApproveTxHash] = useState<`0x${string}` | undefined>();
  const [burnTxHash, setBurnTxHash] = useState<`0x${string}` | undefined>();
  const [forwardTxHash, setForwardTxHash] = useState<string | null>(null);
  const { pendingAction, setPendingAction } = useAppStore();
  const { getAuthHeaders } = useWalletAuth();

  // AI-orchestrated handoff — pre-fill the amount from a confirmed chat
  // proposal, then clear it so it's only ever consumed once. The source
  // chain/route still needs the user's own selection below — that can't
  // be reliably inferred from a short chat message.
  useEffect(() => {
    if (pendingAction?.action === 'bridge') {
      setAmount(pendingAction.amount);
      toast.success('Pre-filled from ARCTIS AI — choose your source chain and review before bridging');
      setPendingAction(null);
    }
  }, [pendingAction, setPendingAction]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [history, setHistory] = useState<BridgeRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const { isSuccess: approveConfirmed } = useWaitForTransactionReceipt({ hash: approveTxHash, query: { enabled: !!approveTxHash } });
  const { isSuccess: burnConfirmed } = useWaitForTransactionReceipt({ hash: burnTxHash, query: { enabled: !!burnTxHash } });

  useEffect(() => {
    fetch('/api/bridge').then((r) => r.json()).then((d) => {
      if (d.routes) { setRoutes(d.routes); setSelectedRoute((prev: BridgeRoute | null) => prev ?? d.routes[0] ?? null); }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!showHistory || !address) return;
    fetch(`/api/bridge/history?wallet=${address}`).then((r) => r.json())
      .then((d) => { if (d.bridges) setHistory(d.bridges); }).catch(() => {});
  }, [showHistory, address]);

  useEffect(() => {
    const num = parseFloat(amount);
    if (!selectedRoute || !amount || isNaN(num) || num <= 0) { setQuote(null); return; }
    const t = setTimeout(() => {
      fetch(`/api/bridge/quote?sourceChain=${selectedRoute.sourceChainId}&amount=${amount}`)
        .then((r) => r.json()).then((d) => { if (!d.error) setQuote(d); else setQuote(null); })
        .catch(() => setQuote(null));
    }, 500);
    return () => clearTimeout(t);
  }, [selectedRoute, amount]);

  useEffect(() => { if (approveConfirmed && step === 'approving') setStep('approved'); }, [approveConfirmed, step]);

  useEffect(() => {
    if (!burnConfirmed || step !== 'burning' || !burnTxHash || !address || !selectedRoute) return;
    setStep('attesting');
    void (async () => {
      const headers = await getAuthHeaders();
      fetch('/api/bridge/execute', {
        method: 'POST', headers,
        body: JSON.stringify({ burnTxHash, sourceChainId: selectedRoute.sourceChainId, walletAddress: address, amount: parseFloat(amount) }),
      }).then((r) => r.json()).then((d) => {
        if (d.error && !d.bridgeId) { setErrorMsg(d.error); setStep('error'); }
      }).catch((err) => { setErrorMsg(err.message); setStep('error'); });
    })();
  }, [burnConfirmed, step, burnTxHash, address, selectedRoute, amount, getAuthHeaders]);

  useEffect(() => {
    if (step !== 'attesting' || !burnTxHash) return;
    const interval = setInterval(() => {
      fetch(`/api/bridge/status?bridgeId=${burnTxHash}`).then((r) => r.json()).then((d) => {
        if (d.status === 'completed' && d.forwardTxHash) {
          setForwardTxHash(d.forwardTxHash); setStep('completed');
          toast.success(`${amount} USDC arrived on Arc Testnet!`);
          if (burnTxHash && selectedRoute) {
            void dispatchMemo(buildBridgeMemo(burnTxHash, selectedRoute.sourceDomain, 26, selectedRoute.sourceChain));
          }
          clearInterval(interval);
        } else if (d.status === 'timeout') { setStep('timeout'); clearInterval(interval); }
        else if (d.status === 'failed') { setErrorMsg(d.failureReason ?? 'Bridge failed'); setStep('error'); clearInterval(interval); }
      }).catch(() => {});
    }, STATUS_POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [step, burnTxHash, amount, dispatchMemo, selectedRoute]);

  const amountNum = parseFloat(amount);
  const amountValid = amount !== '' && !isNaN(amountNum) && amountNum > 0 &&
    (!quote || (amountNum >= quote.minAmount && amountNum <= quote.maxAmount));
  const onSourceChain = chainId === selectedRoute?.sourceChainId;
  const canBridge = amountValid && !!quote && isConnected && !!selectedRoute && onSourceChain && step === 'idle';

  const handleSwitchToSource = async () => {
    if (!selectedRoute) return;
    try { await switchChainAsync({ chainId: selectedRoute.sourceChainId }); }
    catch { toast.error('Failed to switch network'); }
  };

  const handleApprove = async () => {
    if (!canBridge || !selectedRoute || !address) return;
    setStep('approving');
    try {
      const amountBig = parseUnits(amountNum.toFixed(6), 6);
      const hash = await writeContractAsync({
        address: selectedRoute.usdc as `0x${string}`, abi: ERC20_ABI, functionName: 'approve',
        args: [selectedRoute.tokenMessengerV2 as `0x${string}`, amountBig], chainId: selectedRoute.sourceChainId,
      });
      setApproveTxHash(hash);
    } catch (err) { setErrorMsg((err as Error).message); setStep('error'); }
  };

  const handleBurn = async () => {
    if (step !== 'approved' || !selectedRoute || !address || !quote) return;
    setStep('burning');
    try {
      const amountBig = parseUnits(amountNum.toFixed(6), 6);
      const maxFeeBig = parseUnits(quote.fee.toFixed(6), 6);
      const hash = await writeContractAsync({
        address: selectedRoute.tokenMessengerV2 as `0x${string}`, abi: CCTP_TOKEN_MESSENGER_ABI, functionName: 'depositForBurn',
        args: [amountBig, quote.destinationDomain, addressToBytes32(address), selectedRoute.usdc as `0x${string}`, ZERO_BYTES32, maxFeeBig, 1000],
        chainId: selectedRoute.sourceChainId,
      });
      setBurnTxHash(hash);
    } catch (err) { setErrorMsg((err as Error).message); setStep('error'); }
  };

  const handleReset = () => {
    setStep('idle'); setAmount(''); setQuote(null);
    setApproveTxHash(undefined); setBurnTxHash(undefined); setForwardTxHash(null); setErrorMsg(null);
  };

  if (step === 'completed') {
    return (
      <div className="page-container max-w-lg flex items-center justify-center min-h-[60vh]">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card p-8 text-center space-y-6 w-full">
          <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-surface-950 mb-1">Bridge Complete</h2>
            <p className="text-surface-600 text-sm">{amount} USDC arrived on Arc Testnet from {selectedRoute?.sourceChain}</p>
          </div>
          <div className="space-y-2">
            {burnTxHash && selectedRoute && (
              <a href={`${selectedRoute.explorer}/tx/${burnTxHash}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-between glass-card p-3 hover:bg-black/[0.06] dark:hover:bg-white/[0.06] transition-colors">
                <span className="text-surface-600 text-xs">Source tx ({selectedRoute.sourceChain})</span>
                <span className="text-blue-600 dark:text-blue-400 text-xs flex items-center gap-1">View <ExternalLink className="w-3 h-3" /></span>
              </a>
            )}
            {forwardTxHash && (
              <a href={txUrl(forwardTxHash)} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-between glass-card p-3 hover:bg-black/[0.06] dark:hover:bg-white/[0.06] transition-colors">
                <span className="text-surface-600 text-xs">Arc Testnet arrival</span>
                <span className="text-blue-600 dark:text-blue-400 text-xs flex items-center gap-1">ArcScan <ExternalLink className="w-3 h-3" /></span>
              </a>
            )}
          </div>
          <div className="flex gap-2">
            <a href="/credits" className="btn-secondary flex-1 justify-center text-sm">Buy Credits</a>
            <a href="/swap" className="btn-secondary flex-1 justify-center text-sm">Swap Tokens</a>
          </div>
          <button onClick={handleReset} className="btn-ghost w-full justify-center">
            <RefreshCw className="w-4 h-4" /> New Bridge
          </button>
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
          <h1 className="text-2xl font-bold text-surface-950 tracking-tight">Bridge</h1>
          <p className="text-surface-600 text-sm mt-1">CCTP V2 · Bring USDC to Arc Testnet</p>
        </div>
        <button onClick={() => setShowHistory((s: boolean) => !s)} aria-label="Bridge history" className={cn('btn-ghost', showHistory && 'bg-blue-500/10 text-blue-600 dark:text-blue-400')}>
          <History className="w-4 h-4" />
        </button>
      </motion.div>

      {!isConnected ? (
        <div className="glass-card p-8 text-center">
          <Wallet className="w-8 h-8 text-surface-600 mx-auto mb-3" />
          <p className="text-surface-700">Connect your wallet to bridge USDC</p>
        </div>
      ) : showHistory ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          <p className="text-surface-600 text-xs font-medium uppercase tracking-wider">Bridge History</p>
          {history.length === 0 ? (
            <div className="glass-card p-10 text-center">
              <GitMerge className="w-8 h-8 text-surface-500 mx-auto mb-3 opacity-50" />
              <p className="text-surface-600 text-sm">No bridges yet</p>
            </div>
          ) : history.map((b: BridgeRecord) => (
            <div key={b.burnTxHash} className="glass-card p-4 flex items-center justify-between">
              <div>
                <p className="text-surface-950 text-sm font-medium">{b.amount} USDC from {b.sourceChain}</p>
                <p className="text-surface-500 text-xs">{formatRelative(b.createdAt)}</p>
              </div>
              <span className={cn('text-xs px-2 py-0.5 rounded-full',
                b.status === 'completed' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                b.status === 'failed' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400' :
                b.status === 'timeout' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'bg-blue-500/10 text-blue-600 dark:text-blue-400')}>
                {b.status}
              </span>
            </div>
          ))}
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="glass-card p-5 space-y-3">
            <label className="text-surface-600 text-xs font-medium uppercase tracking-wider">From</label>
            <div className="relative">
              <button onClick={() => setShowChainMenu((s: boolean) => !s)} disabled={step !== 'idle'}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-black/[0.04] dark:bg-white/[0.04] hover:bg-black/[0.07] dark:hover:bg-white/[0.07] border border-black/[0.08] dark:border-white/[0.08] transition-colors disabled:opacity-60">
                <span className="text-sm font-medium text-surface-950">{selectedRoute?.sourceChain ?? 'Select chain'}</span>
                <ChevronDown className={cn('w-4 h-4 text-surface-600 transition-transform', showChainMenu && 'rotate-180')} />
              </button>
              <AnimatePresence>
                {showChainMenu && (
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="absolute top-full left-0 right-0 mt-1 glass-card z-20 overflow-hidden">
                    {routes.map((r: BridgeRoute) => (
                      <button key={r.sourceChainId} onClick={() => { setSelectedRoute(r); setShowChainMenu(false); setAmount(''); setQuote(null); }}
                        className={cn('w-full px-4 py-3 text-left hover:bg-black/[0.06] dark:hover:bg-white/[0.06] transition-colors text-sm text-surface-950',
                          r.sourceChainId === selectedRoute?.sourceChainId && 'bg-blue-500/10')}>
                        {r.sourceChain}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            {selectedRoute && !onSourceChain && step === 'idle' && (
              <button onClick={handleSwitchToSource} disabled={isSwitching} className="btn-secondary w-full justify-center text-sm">
                {isSwitching ? <Loader2 className="w-4 h-4 animate-spin" /> : `Switch to ${selectedRoute.sourceChain}`}
              </button>
            )}
          </div>

          <div className="glass-card p-5 space-y-2.5">
            <label className="text-surface-600 text-xs font-medium uppercase tracking-wider">Amount (USDC)</label>
            <input type="number" value={amount} placeholder="0.00" onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)}
              disabled={step !== 'idle'} className="input-field" min="0" step="0.01" />
            {quote && (amountNum < quote.minAmount || amountNum > quote.maxAmount) && (
              <p className="text-rose-600 dark:text-rose-400 text-xs flex items-center gap-1.5">
                <AlertCircle className="w-3 h-3" /> Amount must be between {quote.minAmount} and {quote.maxAmount} USDC
              </p>
            )}
          </div>

          <div className="glass-card p-4 flex items-center justify-between">
            <span className="text-surface-600 text-xs uppercase tracking-wider">To</span>
            <span className="text-surface-950 text-sm font-medium">Arc Testnet {address && `(${formatAddress(address)})`}</span>
          </div>

          {quote && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-surface-600">Fee</span><span className="text-surface-950 font-mono">{quote.fee.toFixed(4)} USDC</span></div>
              <div className="flex justify-between"><span className="text-surface-600">Estimated time</span><span className="text-surface-950">{quote.estimatedTime}</span></div>
              {quote.feeEstimated && (
                <p className="text-amber-600 dark:text-amber-400 text-xs flex items-center gap-1.5 pt-1"><Info className="w-3 h-3" /> Estimated fee — live quote unavailable</p>
              )}
            </motion.div>
          )}

          {step === 'attesting' && (
            <div className="glass-card p-5 text-center space-y-3 border-blue-500/20 bg-blue-500/5">
              <Loader2 className="w-6 h-6 text-blue-600 dark:text-blue-400 animate-spin mx-auto" />
              <p className="text-surface-950 text-sm font-medium">Waiting for Circle attestation…</p>
              <p className="text-surface-600 text-xs">Your USDC has been burned on {selectedRoute?.sourceChain}. Minting on Arc Testnet shortly.</p>
              {burnTxHash && selectedRoute && (
                <a href={`${selectedRoute.explorer}/tx/${burnTxHash}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 text-xs inline-flex items-center gap-1">
                  View source tx <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          )}

          {step === 'timeout' && (
            <div className="glass-card p-5 text-center space-y-3 border-amber-500/20 bg-amber-500/5">
              <Clock className="w-6 h-6 text-amber-600 dark:text-amber-400 mx-auto" />
              <p className="text-surface-950 text-sm font-medium">Taking longer than expected</p>
              <p className="text-surface-600 text-xs">Your USDC is in transit, not lost. The burn transaction succeeded — attestation is just slow.</p>
              {burnTxHash && selectedRoute && (
                <a href={`${selectedRoute.explorer}/tx/${burnTxHash}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 text-xs inline-flex items-center gap-1">
                  View source tx <ExternalLink className="w-3 h-3" />
                </a>
              )}
              <button onClick={handleReset} className="btn-ghost text-sm">Start new bridge</button>
            </div>
          )}

          {step === 'error' && errorMsg && (
            <div className="glass-card p-3 border-rose-500/20 bg-rose-500/5 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
              <p className="text-rose-600 dark:text-rose-400 text-sm">{errorMsg}</p>
            </div>
          )}

          {(step === 'idle' || step === 'error') && (
            !onSourceChain && selectedRoute ? (
              <button disabled className="btn-primary w-full justify-center opacity-40 cursor-not-allowed">Switch network to continue</button>
            ) : (
              <button onClick={handleApprove} disabled={!canBridge} className="btn-primary w-full justify-center text-base py-3.5 disabled:opacity-40 disabled:cursor-not-allowed">
                <GitMerge className="w-4 h-4" /> Bridge USDC to Arc
              </button>
            )
          )}
          {step === 'approving' && <button disabled className="btn-primary w-full justify-center opacity-70"><Loader2 className="w-4 h-4 animate-spin" /> Approving…</button>}
          {step === 'approved' && <button onClick={handleBurn} className="btn-primary w-full justify-center bg-emerald-600 hover:bg-emerald-700"><CheckCircle2 className="w-4 h-4" /> Confirm Bridge</button>}
          {step === 'burning' && <button disabled className="btn-primary w-full justify-center opacity-70"><Loader2 className="w-4 h-4 animate-spin" /> Burning on {selectedRoute?.sourceChain}…</button>}

          <p className="text-center text-surface-500 text-xs">Circle CCTP V2 · Testnet only · Inbound to Arc only</p>
        </motion.div>
      )}
    </div>
  );
}
