'use client';

import { useState, useCallback, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccount } from 'wagmi';
import {
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Copy,
  RotateCcw,
  Wallet,
  Info,
} from 'lucide-react';
import { useTransfer } from '@/lib/hooks/useTransfer';
import { buildTransferMemo } from '@/lib/memo/service';
import { useMemo as useArcMemo } from '@/lib/memo/useMemo';
import { useUSDCBalance } from '@/lib/hooks/useUSDCBalance';
import { useChainSwitch } from '@/lib/hooks/useChainSwitch';
import { isValidAddress, copyToClipboard, getTxExplorerUrl, formatAddress } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import { ModeTabs, type ExecutionMode } from '@/components/agent/ModeTabs';
import { EconomicAgentPanel } from '@/components/agent/EconomicAgentPanel';
import toast from 'react-hot-toast';

// ============================================================
// Transfer Page — Institutional USDC Send UX
// ============================================================

function TransferPageInner() {
  const searchParams = useSearchParams();
  const { isConnected } = useAccount();
  const { dispatchMemo } = useArcMemo();
  const { formatted: balance, raw: balanceRaw, refetch } = useUSDCBalance();
  const { isCorrectChain, switchToArc, isSwitching } = useChainSwitch();
  const { transfer, isPending, isConfirming, isSuccess, isError, error, txHash, reset } = useTransfer();

  const [toAddress, setToAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState<ExecutionMode>('manual');
  const [agentExecuting, setAgentExecuting] = useState(false);

  // Keep the execution surface stable across wallet/receipt-driven
  // remounts. An Economic Agent transaction must never fall back
  // into the Manual success screen.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedMode = window.sessionStorage.getItem('arctis-transfer-mode');
    if (storedMode === 'agent' || storedMode === 'manual') {
      setMode(storedMode as ExecutionMode);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.sessionStorage.setItem('arctis-transfer-mode', mode);
  }, [mode]);
  const { pendingAction, setPendingAction } = useAppStore();

  useEffect(() => {
    const to = searchParams.get('to');
    if (to) setToAddress(to);
    if (searchParams.get('mode') === 'agent') setMode('agent');
  }, [searchParams]);

  // AI-orchestrated handoff — pre-fill from a confirmed chat proposal,
  // then clear it so it's only ever consumed once.
  useEffect(() => {
    if (pendingAction?.action === 'transfer') {
      if (pendingAction.recipient) setToAddress(pendingAction.recipient);
      setAmount(pendingAction.amount);
      toast.success('Pre-filled from ARCTIS AI — review before sending');
      setPendingAction(null);
    }
  }, [pendingAction, setPendingAction]);
  const [note, setNote] = useState('');
  const [touched, setTouched] = useState({ to: false, amount: false });
  const [passportResolving, setPassportResolving] = useState(false);
  const [passportResolvedAddress, setPassportResolvedAddress] = useState<string | null>(null);
  const [passportError, setPassportError] = useState<string | null>(null);

  const addressValid = isValidAddress(toAddress);

  const passportName = toAddress.trim().toLowerCase().replace(/\\.arc$/, '');
  const passportFormatValid =
    !addressValid &&
    /^[a-z0-9_-]{3,20}$/.test(passportName);

  useEffect(() => {
    let cancelled = false;

    setPassportResolvedAddress(null);
    setPassportError(null);

    if (!passportFormatValid) {
      setPassportResolving(false);
      return;
    }

    setPassportResolving(true);

    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/passport/resolve?username=${encodeURIComponent(passportName)}`
        );

        const data = await response.json() as {
          walletAddress?: string;
          error?: string;
        };

        if (cancelled) return;

        if (!response.ok || !data.walletAddress) {
          setPassportError(data.error || 'Passport not found');
          setPassportResolvedAddress(null);
          return;
        }

        setPassportResolvedAddress(data.walletAddress);
        setPassportError(null);
      } catch {
        if (!cancelled) {
          setPassportError('Unable to verify Passport');
          setPassportResolvedAddress(null);
        }
      } finally {
        if (!cancelled) setPassportResolving(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [passportFormatValid, passportName]);

  const recipientValid = addressValid || !!passportResolvedAddress;

  const amountNum = parseFloat(amount);
  const amountValid = amount !== '' && !isNaN(amountNum) && amountNum > 0;

  const canSubmit =
    recipientValid &&
    amountValid &&
    !passportResolving &&
    !isPending &&
    !isConfirming &&
    isConnected &&
    isCorrectChain;

  const handleMaxAmount = useCallback(() => {
    if (balanceRaw > 0n) {
      const max = (Number(balanceRaw) / 1_000_000).toFixed(6);
      setAmount(max);
    }
  }, [balanceRaw]);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    await transfer({ to: toAddress, amount, note: note || undefined });
    await refetch();
  }, [canSubmit, transfer, toAddress, amount, note, refetch]);

  const executeAgentTransfer = useCallback(async (proposal: import('@/lib/store').PendingFinancialAction) => {
    if (!proposal.recipient || !proposal.amount) throw new Error('Transfer proposal is incomplete');

    // Explicitly lock the UI to the Economic Agent surface before
    // starting wallet execution.
    setMode('agent');
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('arctis-transfer-mode', 'agent');
    }

    setToAddress(proposal.recipient);
    setAmount(proposal.amount);
    setAgentExecuting(true);
  }, []);

  useEffect(() => {
    if (!agentExecuting || !isConnected) return;
    if (!isCorrectChain) {
      void switchToArc().catch((err) => {
        toast.error((err as Error).message || 'Unable to switch to Arc Testnet');
        setAgentExecuting(false);
      });
      return;
    }
    if (!isPending && !isConfirming && !isSuccess && !isError) {
      void transfer({ to: toAddress, amount, note: undefined }).catch((err) => {
        toast.error((err as Error).message || 'Transfer failed');
        setAgentExecuting(false);
      });
    }
  }, [agentExecuting, isConnected, isCorrectChain, switchToArc, isPending, isConfirming, isSuccess, isError, transfer, toAddress, amount]);

  const handleReset = useCallback(() => {
    reset();
    setToAddress('');
    setAmount('');
    setNote('');
    setTouched({ to: false, amount: false });
    setPassportResolvedAddress(null);
    setPassportError(null);
    setPassportResolving(false);
  }, [reset]);

  // Fire Transaction Memo once, after transfer confirms — non-blocking, never surfaced to user on failure
  useEffect(() => {
    if (isSuccess && txHash) {
      if (agentExecuting) setAgentExecuting(false);
      void dispatchMemo(buildTransferMemo(txHash, toAddress.endsWith('.arc') ? toAddress : undefined, note || undefined));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess, txHash]);

  return (
    <div className="max-w-lg mx-auto space-y-6 safe-bottom">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.22,1,0.36,1] }}>
        <div className="flex items-center gap-2 mb-1"><span className="text-surface-500 text-xs font-semibold uppercase tracking-widest">Stablecoin OS</span></div>
        <h1 className="text-2xl font-bold text-surface-950 tracking-tight">Send USDC</h1>
        <p className="text-surface-600 text-sm mt-1">Transfer USDC on Arc Testnet · Verified on-chain</p>
      </motion.div>

      {/* Manual / Economic Agent switcher */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <ModeTabs mode={mode} onChange={setMode} />
      </motion.div>

      {mode === 'agent' && (
        <EconomicAgentPanel
          action="transfer"
          onExecute={executeAgentTransfer}
          executionStatus={agentExecuting ? (isError ? 'failed' : isSuccess ? 'success' : 'executing') : 'idle'}
          executionError={isError ? error : null}
          executionTxHash={txHash}
        />
      )}

      {mode === 'manual' && (
      <>
      {/* Main transfer card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card p-6"
      >
        <AnimatePresence mode="wait">
          {/* Success state */}
          {mode === 'manual' && isSuccess && txHash && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="text-center py-6"
            >
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/12 border border-emerald-500/20 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-emerald-500/10">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="text-surface-950 font-bold text-lg mb-1 tracking-tight">Transfer Confirmed</h3>
              <p className="text-surface-600 text-sm mb-6"><span className="text-surface-950 font-mono font-semibold">{amount} USDC</span> sent successfully · Verified on-chain</p>

              <div className="bg-surface-200/50 rounded-xl p-4 mb-6 text-left">
                <div className="text-surface-600 text-xs mb-2">Transaction Hash</div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-surface-950 font-mono text-sm truncate">{formatAddress(txHash, 8)}</span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => { copyToClipboard(txHash); toast.success('Copied!'); }}
                      className="p-1.5 text-surface-600 hover:text-surface-950 transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <a
                      href={getTxExplorerUrl(txHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-surface-600 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </div>

              <button onClick={handleReset} className="btn-ghost w-full gap-2">
                <RotateCcw className="w-4 h-4" />
                New Transfer
              </button>
            </motion.div>
          )}

          {/* Form state */}
          {mode === 'manual' && !isSuccess && (
            <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {/* Not connected */}
              {!isConnected && (
                <div className="text-center py-8">
                  <Wallet className="w-10 h-10 text-surface-600 mx-auto mb-3" />
                  <p className="text-surface-600 text-sm">Connect your wallet to send USDC</p>
                </div>
              )}

              {/* Wrong chain */}
              {isConnected && !isCorrectChain && (
                <div className="mb-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="text-amber-600 dark:text-amber-400 font-medium text-sm mb-1">Wrong Network</div>
                      <p className="text-amber-500/70 text-xs mb-3">Switch to Arc Testnet to send USDC.</p>
                      <button
                        onClick={switchToArc}
                        disabled={isSwitching}
                        className="btn-primary text-xs px-4 py-2"
                      >
                        {isSwitching ? 'Switching...' : 'Switch to Arc Testnet'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {isConnected && (
                <div className="space-y-4">
                  {/* Balance display */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-surface-200/40">
                    <span className="text-surface-600 text-xs">Available Balance</span>
                    <span className="text-surface-950 font-mono text-sm font-semibold">{balance} USDC</span>
                  </div>

                  {/* Recipient: Wallet Address or Passport */}
                  <div className="space-y-1.5">
                    <label className="text-surface-700 text-xs font-medium">
                      Recipient
                    </label>

                    <input
                      type="text"
                      value={toAddress}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setToAddress(e.target.value)}
                      onBlur={() => setTouched((t: { to: boolean; amount: boolean }) => ({ ...t, to: true }))}
                      placeholder="0x... or Passport ID"
                      className={cn(
                        'input-base font-mono',
                        passportResolvedAddress && 'border-emerald-500/40 focus:border-emerald-500/50',
                        touched.to && toAddress && !recipientValid && !passportResolving &&
                          'border-rose-500/50 focus:border-rose-500/50 focus:ring-rose-500/10'
                      )}
                      spellCheck={false}
                      autoComplete="off"
                    />

                    {passportResolving && (
                      <p className="text-surface-500 text-xs flex items-center gap-1.5">
                        <span className="w-3 h-3 border-2 border-surface-400/30 border-t-surface-600 rounded-full animate-spin" />
                        Verifying Passport…
                      </p>
                    )}

                    {passportResolvedAddress && (
                      <div className="flex items-start gap-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="text-emerald-700 dark:text-emerald-400 text-xs font-medium">
                            Passport verified
                          </p>
                          <p className="text-surface-500 text-[11px] font-mono truncate mt-0.5">
                            {passportResolvedAddress}
                          </p>
                        </div>
                      </div>
                    )}

                    {passportError && (
                      <p className="text-rose-600 dark:text-rose-400 text-xs flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {passportError}
                      </p>
                    )}

                    {touched.to && toAddress && !recipientValid && !passportResolving && !passportError && (
                      <p className="text-rose-600 dark:text-rose-400 text-xs flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Enter a valid wallet address or Passport ID
                      </p>
                    )}
                  </div>

                  {/* Amount */}
                  <div className="space-y-1.5">
                    <label className="text-surface-700 text-xs font-medium">Amount (USDC)</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={amount}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)}
                        onBlur={() => setTouched((t: { to: boolean; amount: boolean }) => ({ ...t, amount: true }))}
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                        className={cn(
                          'input-base pr-16',
                          touched.amount && amount && !amountValid && 'border-rose-500/50'
                        )}
                      />
                      <button
                        onClick={handleMaxAmount}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-600 dark:text-blue-400 text-xs font-medium hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                      >
                        MAX
                      </button>
                    </div>
                    {touched.amount && amount && !amountValid && (
                      <p className="text-rose-600 dark:text-rose-400 text-xs flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Enter a valid amount
                      </p>
                    )}
                  </div>

                  {/* Note */}
                  <div className="space-y-1.5">
                    <label className="text-surface-700 text-xs font-medium flex items-center gap-1.5">
                      Note <span className="text-surface-500">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={note}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNote(e.target.value)}
                      placeholder="Payment note..."
                      className="input-base"
                      maxLength={120}
                    />
                  </div>

                  {/* Error */}
                  {isError && error && (
                    <div className="flex items-start gap-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
                      <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
                      <p className="text-rose-600 dark:text-rose-400 text-xs leading-relaxed">{error}</p>
                    </div>
                  )}

                  {/* Preview */}
                  {recipientValid && amountValid && (
                    <div className="p-3 rounded-xl bg-surface-200/30 border border-black/[0.04] dark:border-white/[0.04] space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-surface-600">Sending</span>
                        <span className="text-surface-950 font-mono font-medium">{amount} USDC</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-surface-600">To</span>
                        <span className="text-surface-950 font-mono">
                          {addressValid
                            ? formatAddress(toAddress, 6)
                            : `${toAddress.replace(/\\.arc$/i, '')} → ${formatAddress(passportResolvedAddress || '', 6)}`}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-surface-600">Network</span>
                        <span className="text-surface-950">Arc Testnet</span>
                      </div>
                      <div className="flex items-center gap-1.5 pt-1 text-surface-500">
                        <Info className="w-3 h-3" />
                        <span>Gas fees paid in ARC native token</span>
                      </div>
                    </div>
                  )}

                  {/* Submit */}
                  <button
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                    className="btn-primary w-full py-3.5 text-base shadow-lg shadow-blue-500/20 disabled:shadow-none"
                  >
                    {passportResolving && <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Verifying Passport…</>}
                    {!passportResolving && isPending && <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Confirm in wallet…</>}
                    {!passportResolving && isConfirming && <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Confirming on Arc…</>}
                    {!passportResolving && !isPending && !isConfirming && <><ArrowUpRight className="w-5 h-5" />Send USDC</>}
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Info card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass-card p-4"
      >
        <div className="flex items-start gap-3">
          <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-surface-600 text-xs leading-relaxed space-y-1">
            <p>Transfers use ERC-20 standard with 6 decimal precision (USDC).</p>
            <p>Transactions are monitored until confirmed on Arc Testnet.</p>
            <p>All activity is saved locally and synced to Firebase.</p>
          </div>
        </div>
      </motion.div>
      </>
      )}
    </div>
  );
}

export default function TransferPage() {
  return (
    <Suspense fallback={<div className="page-container max-w-lg flex items-center justify-center min-h-[60vh]"><div className="text-surface-500 text-sm">Loading…</div></div>}>
      <TransferPageInner />
    </Suspense>
  );
}
