'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccount, useSwitchChain } from 'wagmi';
import { createViemAdapterFromProvider } from '@circle-fin/adapter-viem-v2';
import { createPublicClient, formatEther, formatUnits, http, parseUnits } from 'viem';
import { AppKit } from '@circle-fin/app-kit';
import {
  GitMerge, CheckCircle2, AlertCircle, ExternalLink,
  ChevronDown, RefreshCw, History, Wallet, Info, Loader2,
} from 'lucide-react';
import { cn, formatRelative, formatAddress } from '@/lib/utils';
import { ERC20_ABI, RPC_FALLBACK_URLS } from '@/lib/contracts';
import { ModeTabs, type ExecutionMode } from '@/components/agent/ModeTabs';
import { EconomicAgentPanel } from '@/components/agent/EconomicAgentPanel';
import { useAppStore } from '@/lib/store';
import toast from 'react-hot-toast';

type AppKitChain =
  | 'Arc_Testnet'
  | 'Ethereum_Sepolia'
  | 'Base_Sepolia'
  | 'Arbitrum_Sepolia';

interface BridgeChain {
  chain: string;
  chainId: number;
  domain: number;
  usdc: string;
  explorer: string;
  appKitChain: AppKitChain;
  enabled: boolean;
}

interface BridgeQuote {
  sourceChain: string;
  sourceChainId: number;
  sourceDomain: number;
  destinationChain: string;
  destinationChainId: number;
  destinationDomain: number;
  fee: number;
  feeToken: string;
  estimatedTime: string;
  minAmount: number;
  maxAmount: number;
  feeEstimated?: boolean;
  amount: number;
}

interface BridgeRecord {
  burnTxHash: string;
  walletAddress: string;
  sourceChain: string;
  sourceChainId: number;
  destinationChain?: string;
  destinationChainId?: number;
  amount: number;
  status: string;
  forwardTxHash?: string;
  createdAt: string;
  completedAt?: string;
}

type BridgeStep = 'idle' | 'executing' | 'completed' | 'timeout' | 'error';

const BRIDGE_NATIVE_RPC: Record<number, string> = {
  5042002: RPC_FALLBACK_URLS[0] ?? 'https://rpc.testnet.arc.network',
  11155111: 'https://ethereum-sepolia-rpc.publicnode.com',
  84532: 'https://sepolia.base.org',
  421614: 'https://sepolia-rollup.arbitrum.io/rpc',
};

const BRIDGE_NATIVE_SYMBOL: Record<number, string> = {
  5042002: 'ARC',
  11155111: 'ETH',
  84532: 'ETH',
  421614: 'ETH',
};

async function preflightBridgeFunds(chain: BridgeChain, address: string, amount: string) {
  const rpc = BRIDGE_NATIVE_RPC[chain.chainId];
  if (!rpc) throw new Error(`No balance preflight RPC configured for ${chain.chain}`);

  const client = createPublicClient({ transport: http(rpc) });
  const requiredUsdc = parseUnits(amount, 6);

  try {
    const [nativeBalance, gasPrice, usdcBalance] = await Promise.all([
      client.getBalance({ address: address as `0x${string}` }),
      client.getGasPrice(),
      client.readContract({
        address: chain.usdc as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [address as `0x${string}`],
      }),
    ]);

    // Source-side CCTP execution needs native gas for approval/burn.
    // Keep a conservative envelope, but do not require destination gas from
    // the user: destination minting is not their source-chain transaction.
    const requiredNativeGas = gasPrice * 300_000n * 2n;

    if (usdcBalance < requiredUsdc) {
      throw new Error(
        `Insufficient USDC on ${chain.chain}. Required ${formatUnits(requiredUsdc, 6)} USDC, available ${formatUnits(usdcBalance, 6)} USDC. No USDC will be burned.`,
      );
    }

    if (nativeBalance < requiredNativeGas) {
      const symbol = BRIDGE_NATIVE_SYMBOL[chain.chainId] ?? 'native gas';
      throw new Error(
        `Insufficient ${symbol} on ${chain.chain}. You need approximately ${formatEther(requiredNativeGas)} ${symbol} for the source-chain bridge transaction. No USDC will be burned.`,
      );
    }

    return {
      usdcBalance,
      requiredUsdc,
      nativeBalance,
      requiredNativeGas,
      symbol: BRIDGE_NATIVE_SYMBOL[chain.chainId] ?? 'native gas',
    };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Insufficient ')) throw error;
    throw new Error(`Unable to verify USDC/native balance on ${chain.chain}. Please refresh your wallet balance and try again.`);
  }
}

function extractTxHashes(result: unknown): { burnTxHash?: string; forwardTxHash?: string } {
  const value = result as {
    steps?: Array<{ name?: unknown; txHash?: unknown; data?: { txHash?: unknown } }>;
    forwardTxHash?: unknown;
  };

  const steps = Array.isArray(value?.steps) ? value.steps : [];
  const hashes = steps
    .map((step) => ({
      name: String(step?.name ?? ''),
      hash: typeof step?.txHash === 'string'
        ? step.txHash
        : typeof step?.data?.txHash === 'string'
          ? step.data.txHash
          : undefined,
    }))
    .filter((item): item is { name: string; hash: string } => typeof item.hash === 'string');

  const burn = hashes.find((item) => /burn|deposit/i.test(item.name))?.hash;
  const mint = hashes.find((item) => /mint|receive|forward|complete/i.test(item.name))?.hash;

  return {
    burnTxHash: burn ?? hashes[0]?.hash,
    forwardTxHash:
      (typeof value?.forwardTxHash === 'string' ? value.forwardTxHash : undefined) ??
      mint ??
      (hashes.length > 1 ? hashes[hashes.length - 1]?.hash : undefined),
  };
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
  const [forwardTxHash, setForwardTxHash] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [history, setHistory] = useState<BridgeRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [mode, setMode] = useState<ExecutionMode>('manual');
  const [agentExecuting, setAgentExecuting] = useState(false);
  const [bridgeConfirmation, setBridgeConfirmation] = useState<{ amount: string; route: BridgeChain; target: BridgeChain } | null>(null);

  useEffect(() => {
    if (searchParams.get('mode') === 'agent') setMode('agent');
  }, [searchParams]);

  useEffect(() => {
    fetch('/api/bridge')
      .then((r) => r.json())
      .then((data: { chains?: BridgeChain[] }) => {
        const available = (data.chains ?? []).filter((chain) => chain.enabled);
        setChains(available);
        setSourceChain((prev) => prev ?? available.find((c) => c.chainId === 5042002) ?? available[0] ?? null);
        setDestinationChain((prev) =>
          prev ??
          available.find((c) => c.chainId === 84532) ??
          available.find((c) => c.chainId !== 5042002) ??
          null,
        );
      })
      .catch(() => toast.error('Unable to load bridge networks'));
  }, []);

  useEffect(() => {
    if (!address) return;
    try {
      const stored = localStorage.getItem(`arctis-bridge-history:${address.toLowerCase()}`);
      if (stored) setHistory(JSON.parse(stored) as BridgeRecord[]);
    } catch { /* local history is non-critical */ }
  }, [address]);

  useEffect(() => {
    if (!showHistory || !address) return;
    fetch(`/api/bridge/history?wallet=${address}`)
      .then((r) => r.json())
      .then((data: { bridges?: BridgeRecord[] }) => {
        if (!data.bridges?.length) return;
        setHistory((prev) => {
          const merged = [...(data.bridges ?? []), ...prev];
          return Array.from(
            new Map(merged.map((item) => [item.burnTxHash, item])).values(),
          ).slice(0, 50);
        });
      })
      .catch(() => {});
  }, [showHistory, address]);

  useEffect(() => {
    if (pendingAction?.action !== 'bridge') return;

    setAmount(pendingAction.amount);

    if (pendingAction.sourceChainId) {
      setSourceChain(
        chains.find((chain) => chain.chainId === pendingAction.sourceChainId) ?? sourceChain,
      );
    }

    if (pendingAction.destinationChainId) {
      setDestinationChain(
        chains.find((chain) => chain.chainId === pendingAction.destinationChainId) ?? destinationChain,
      );
    }

    setPendingAction(null);
    toast.success('Pre-filled from ARCTIS AI — review before bridging');
  }, [pendingAction, chains, sourceChain, setPendingAction]);

  const amountNum = Number(amount);
  const amountValid =
    Number.isFinite(amountNum) &&
    amountNum >= 0.000001 &&
    amountNum <= 1000;

  const onSourceChain = chainId === sourceChain?.chainId;
  const sourceKitChain = sourceChain?.appKitChain;
  const destinationKitChain = destinationChain?.appKitChain;

  const loadEstimate = useCallback(async () => {
    if (
      !sourceChain ||
      !destinationChain ||
      sourceChain.chainId === destinationChain.chainId ||
      !amountValid ||
      !connector ||
      !sourceKitChain ||
      !destinationKitChain
    ) {
      setQuote(null);
      return;
    }

    if (chainId !== sourceChain.chainId) {
      setQuote({
        sourceChain: sourceChain.chain,
        sourceChainId: sourceChain.chainId,
        sourceDomain: sourceChain.domain,
        destinationChain: destinationChain.chain,
        destinationChainId: destinationChain.chainId,
        destinationDomain: destinationChain.domain,
        fee: 0,
        feeToken: 'USDC',
        amount: amountNum,
        estimatedTime: '~30 seconds',
        minAmount: 0.000001,
        maxAmount: 1000,
        feeEstimated: true,
      });
      return;
    }

    try {
      const provider = await connector.getProvider();
      const adapter = await createViemAdapterFromProvider({ provider: provider as never });
      const kit = new AppKit();

      const estimate = await kit.estimateBridge({
        from: { adapter, chain: sourceKitChain },
        to: { adapter, chain: destinationKitChain },
        amount: amountNum.toFixed(6),
      });

      const estimateValue = estimate as {
        fees?: { total?: string | number; protocol?: string | number };
        fee?: string | number;
      };

      const fee = Number(
        estimateValue?.fees?.total ??
        estimateValue?.fees?.protocol ??
        estimateValue?.fee ??
        0,
      );

      setQuote({
        sourceChain: sourceChain.chain,
        sourceChainId: sourceChain.chainId,
        sourceDomain: sourceChain.domain,
        destinationChain: destinationChain.chain,
        destinationChainId: destinationChain.chainId,
        destinationDomain: destinationChain.domain,
        fee: Number.isFinite(fee) ? fee : 0,
        feeToken: 'USDC',
        amount: amountNum,
        estimatedTime: '~30 seconds',
        minAmount: 0.000001,
        maxAmount: 1000,
      });
    } catch {
      setQuote({
        sourceChain: sourceChain.chain,
        sourceChainId: sourceChain.chainId,
        sourceDomain: sourceChain.domain,
        destinationChain: destinationChain.chain,
        destinationChainId: destinationChain.chainId,
        destinationDomain: destinationChain.domain,
        fee: 0,
        feeToken: 'USDC',
        amount: amountNum,
        estimatedTime: '~30 seconds',
        minAmount: 0.000001,
        maxAmount: 1000,
        feeEstimated: true,
      });
    }
  }, [
    sourceChain,
    destinationChain,
    amountValid,
    connector,
    sourceKitChain,
    destinationKitChain,
    chainId,
    amountNum,
  ]);

  useEffect(() => {
    const timer = setTimeout(() => void loadEstimate(), 350);
    return () => clearTimeout(timer);
  }, [loadEstimate]);

  const saveLocalHistory = useCallback((record: BridgeRecord) => {
    if (!address) return;

    setHistory((prev) => {
      const merged = [
        record,
        ...prev.filter((item) => item.burnTxHash !== record.burnTxHash),
      ].slice(0, 50);

      try {
        localStorage.setItem(
          `arctis-bridge-history:${address.toLowerCase()}`,
          JSON.stringify(merged),
        );
      } catch { /* local history is non-critical */ }

      return merged;
    });
  }, [address]);

  const executeBridge = useCallback(async (
    bridgeAmount: string,
    route: BridgeChain,
    target: BridgeChain = destinationChain!,
  ) => {
    if (!isConnected || !address || !connector) {
      throw new Error('Connect a compatible EVM wallet first');
    }

    if (!target) throw new Error('Choose a destination network');
    if (route.chainId === target.chainId) {
      throw new Error('Source and destination networks must be different');
    }

    const sourceAppKitChain = route.appKitChain;
    const destinationAppKitChain = target.appKitChain;
    const parsed = Number(bridgeAmount);

    if (!Number.isFinite(parsed) || parsed < 0.000001 || parsed > 1000) {
      throw new Error('Amount must be between 0.000001 and 1000 USDC');
    }

    setErrorMsg(null);
    setStep('executing');

    try {
      if (chainId !== route.chainId) {
        await switchChainAsync({ chainId: route.chainId });
      }

      // Verify the exact source-side USDC burn amount and source native gas
      // before App Kit opens the wallet. No USDC is burned when this fails.
      await preflightBridgeFunds(route, address, bridgeAmount);

      const provider = await connector.getProvider();
      const adapter = await createViemAdapterFromProvider({ provider: provider as never });
      const kit = new AppKit();

      // Arc App Kit bridge lifecycle:
      // source wallet -> approve -> burn -> attestation -> destination mint.
      // The same call supports Arc -> external and external -> Arc.
      let result = await kit.bridge({
        from: { adapter, chain: sourceAppKitChain },
        to: { adapter, chain: destinationAppKitChain },
        amount: parsed.toFixed(6),
      });

      // Arc Docs recommends retryBridge() when the bridge returns an error.
      if ((result as { state?: string }).state === 'error') {
        result = await kit.retryBridge(result, {
          from: adapter,
          to: adapter,
        });
      }

      const resultState = (result as { state?: string }).state;

      if (resultState !== 'success') {
        const steps = (result as {
          steps?: Array<{
            name?: string;
            state?: string;
            txHash?: string;
            error?: { message?: string };
          }>;
        }).steps;

        const failedStep = Array.isArray(steps)
          ? steps.find((item) => item.state === 'error')
          : undefined;

        const failedName = failedStep?.name
          ? ` (${failedStep.name})`
          : '';

        throw new Error(
          failedStep?.error?.message ??
          `Bridge did not complete${failedName}`,
        );
      }

      const hashes = extractTxHashes(result);
      setBurnTxHash(hashes.burnTxHash);
      setForwardTxHash(hashes.forwardTxHash ?? null);
      setStep('completed');

      if (hashes.burnTxHash) {
        void fetch('/api/bridge/record', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            burnTxHash: hashes.burnTxHash,
            forwardTxHash: hashes.forwardTxHash,
            sourceChainId: route.chainId,
            destinationChainId: target.chainId,
            walletAddress: address,
            amount: parsed,
          }),
        }).catch(() => {});
      }

      saveLocalHistory({
        burnTxHash: hashes.burnTxHash ?? `appkit-${Date.now()}`,
        walletAddress: address,
        sourceChain: route.chain,
        sourceChainId: route.chainId,
        destinationChain: target.chain,
        destinationChainId: target.chainId,
        amount: parsed,
        status: 'completed',
        forwardTxHash: hashes.forwardTxHash,
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      });

      toast.success(`${parsed} USDC bridged from ${route.chain} to ${target.chain}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Bridge failed';
      setErrorMsg(message);
      setStep('error');
      throw err;
    }
  }, [
    isConnected,
    address,
    connector,
    destinationChain,
    chainId,
    switchChainAsync,
    saveLocalHistory,
  ]);

  const executeAgentBridge = useCallback(async (
    proposal: import('@/lib/store').PendingFinancialAction,
  ) => {
    const route =
      chains.find((chain) => chain.chainId === proposal.sourceChainId) ??
      sourceChain;

    const target =
      chains.find((chain) => chain.chainId === proposal.destinationChainId) ??
      destinationChain;

    if (!route) throw new Error('Choose a supported bridge source chain');
    if (!target) throw new Error('Choose a supported bridge destination chain');
    if (!proposal.amount) throw new Error('Bridge proposal is incomplete');
    if (route.chainId === target.chainId) {
      throw new Error('Source and destination networks must be different');
    }

    setAmount(proposal.amount);
    setSourceChain(route);
    setDestinationChain(target);
    setAgentExecuting(true);

    try {
      // Economic Agent uses the same verified execution path as Manual, but
      // keeps its status/errors inside the Economic Agent panel.
      await executeBridge(proposal.amount, route, target);
    } catch {
      // executeBridge owns step/errorMsg; the agent panel renders that state.
    } finally {
      setAgentExecuting(false);
    }
  }, [chains, sourceChain, destinationChain, executeBridge]);

  const handleManualBridge = async () => {
    if (!sourceChain || !destinationChain || !address) return;

    setErrorMsg(null);
    try {
      await preflightBridgeFunds(sourceChain, address, amount);
      setStep('idle');
      setBridgeConfirmation({ amount, route: sourceChain, target: destinationChain });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to verify bridge balances';
      setErrorMsg(message);
      setStep('error');
    }
  };

  const confirmBridge = async () => {
    if (!bridgeConfirmation) return;
    const pending = bridgeConfirmation;
    setBridgeConfirmation(null);
    try {
      await executeBridge(pending.amount, pending.route, pending.target);
    } catch {
      // executeBridge owns the visible error state.
    } finally {
      setAgentExecuting(false);
    }
  };

  const handleSwitchToSource = async () => {
    if (!sourceChain) return;

    try {
      if (chainId === sourceChain.chainId) {
        toast.success(`Already on ${sourceChain.chain}`);
        return;
      }

      await switchChainAsync({ chainId: sourceChain.chainId });
      toast.success(`Switched to ${sourceChain.chain}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to switch network');
    }
  };

  const swapDirection = () => {
    if (!sourceChain || !destinationChain) return;
    setSourceChain(destinationChain);
    setDestinationChain(sourceChain);
    setQuote(null);
    setStep('idle');
    setErrorMsg(null);
    setBurnTxHash(undefined);
    setForwardTxHash(null);
  };

  const handleReset = () => {
    setStep('idle');
    setAmount('');
    setQuote(null);
    setBurnTxHash(undefined);
    setForwardTxHash(null);
    setErrorMsg(null);
    setAgentExecuting(false);
  };

  if (step === 'completed' && mode === 'manual') {
    return (
      <div className="page-container max-w-lg flex items-center justify-center min-h-[60vh]">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card p-8 text-center space-y-6 w-full"
        >
          <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
          </div>

          <div>
            <h2 className="text-xl font-bold text-surface-950 mb-1">Bridge Complete</h2>
            <p className="text-surface-600 text-sm">
              {amount} USDC bridged from {sourceChain?.chain} to {destinationChain?.chain}
            </p>
          </div>

          <div className="space-y-2">
            {burnTxHash && sourceChain && (
              <a
                href={`${sourceChain.explorer}/tx/${burnTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between glass-card p-3 hover:bg-black/[0.06] dark:hover:bg-white/[0.06] transition-colors"
              >
                <span className="text-surface-600 text-xs">Source transaction</span>
                <span className="text-blue-600 dark:text-blue-400 text-xs flex items-center gap-1">
                  View <ExternalLink className="w-3 h-3" />
                </span>
              </a>
            )}

            {forwardTxHash && destinationChain && (
              <a
                href={`${destinationChain.explorer}/tx/${forwardTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between glass-card p-3 hover:bg-black/[0.06] dark:hover:bg-white/[0.06] transition-colors"
              >
                <span className="text-surface-600 text-xs">Destination transaction</span>
                <span className="text-blue-600 dark:text-blue-400 text-xs flex items-center gap-1">
                  View <ExternalLink className="w-3 h-3" />
                </span>
              </a>
            )}
          </div>

          <button onClick={handleReset} className="btn-ghost w-full justify-center">
            <RefreshCw className="w-4 h-4" /> New Bridge
          </button>
        </motion.div>
      </div>
    );
  }

  const canBridge =
    amountValid &&
    !!sourceChain &&
    !!destinationChain &&
    sourceChain.chainId !== destinationChain.chainId &&
    !!quote &&
    isConnected &&
    onSourceChain &&
    step === 'idle';

  return (
    <div className="page-container max-w-lg safe-bottom">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="flex items-center justify-between mb-8"
      >
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-surface-500 text-xs font-semibold uppercase tracking-widest">
              Stablecoin OS
            </span>
          </div>
          <h1 className="text-2xl font-bold text-surface-950 tracking-tight">Bridge</h1>
          <p className="text-surface-600 text-sm mt-1">
            Circle App Kit · CCTP V2 · Bidirectional USDC bridge
          </p>
        </div>

        <button
          onClick={() => setShowHistory((value) => !value)}
          aria-label="Bridge history"
          className={cn(
            'btn-ghost',
            showHistory && 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
          )}
        >
          <History className="w-4 h-4" />
        </button>
      </motion.div>

      <div className="mb-6">
        <ModeTabs
          mode={mode}
          onChange={(nextMode) => {
            setShowSourceMenu(false);
            setShowDestinationMenu(false);
            setMode(nextMode);
          }}
        />
      </div>

      {mode === 'agent' && (
        <EconomicAgentPanel
          action="bridge"
          onExecute={executeAgentBridge}
          executionStatus={
            step === 'error'
              ? 'failed'
              : step === 'completed'
                ? 'success'
                : agentExecuting
                  ? 'executing'
                  : 'idle'
          }
          executionError={step === 'error' ? errorMsg : null}
          executionTxHash={forwardTxHash ?? burnTxHash ?? null}
        />
      )}

      {mode === 'manual' && (
        !isConnected ? (
          <div className="glass-card p-8 text-center">
            <Wallet className="w-8 h-8 text-surface-600 mx-auto mb-3" />
            <p className="text-surface-700">Connect your wallet to bridge USDC</p>
          </div>
        ) : showHistory ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            <p className="text-surface-600 text-xs font-medium uppercase tracking-wider">
              Bridge History
            </p>

            {history.length === 0 ? (
              <div className="glass-card p-10 text-center">
                <GitMerge className="w-8 h-8 text-surface-500 mx-auto mb-3 opacity-50" />
                <p className="text-surface-600 text-sm">No bridges yet</p>
              </div>
            ) : (
              history.map((item) => (
                <div
                  key={`${item.burnTxHash}-${item.createdAt}`}
                  className="glass-card p-4 flex items-center justify-between"
                >
                  <div>
                    <p className="text-surface-950 text-sm font-medium">
                      {item.amount} USDC
                    </p>
                    <p className="text-surface-500 text-xs">
                      {item.sourceChain} → {item.destinationChain ?? 'Arc Testnet'}
                    </p>
                    <p className="text-surface-500 text-xs">
                      {formatRelative(item.createdAt)}
                    </p>
                  </div>

                  <span
                    className={cn(
                      'text-xs px-2 py-0.5 rounded-full',
                      item.status === 'completed'
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : item.status === 'failed'
                          ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                          : 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
                    )}
                  >
                    {item.status}
                  </span>
                </div>
              ))
            )}
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="glass-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-surface-600 text-xs font-medium uppercase tracking-wider">
                  From
                </label>
                <span className="text-surface-500 text-xs">
                  {onSourceChain ? 'Connected' : 'Switch required'}
                </span>
              </div>

              <div className="relative">
                <button
                  onClick={() => {
                    setShowSourceMenu((value) => !value);
                    setShowDestinationMenu(false);
                  }}
                  disabled={step !== 'idle'}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-black/[0.04] dark:bg-white/[0.04] hover:bg-black/[0.07] dark:hover:bg-white/[0.07] border border-black/[0.08] dark:border-white/[0.08] transition-colors disabled:opacity-60"
                >
                  <span className="text-sm font-medium text-surface-950">
                    {sourceChain?.chain ?? 'Select chain'}
                  </span>
                  <ChevronDown className={cn(
                    'w-4 h-4 text-surface-600 transition-transform',
                    showSourceMenu && 'rotate-180',
                  )} />
                </button>

                <AnimatePresence>
                  {showSourceMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="absolute top-full left-0 right-0 mt-1 glass-card z-50 max-h-[50vh] overflow-y-auto overscroll-contain touch-pan-y"
                    >
                      {chains.map((chain) => (
                        <button
                          key={chain.chainId}
                          onClick={() => {
                            if (chain.chainId === destinationChain?.chainId) {
                              toast.error('Choose a different destination network');
                              return;
                            }
                            setSourceChain(chain);
                            setShowSourceMenu(false);
                            setQuote(null);
                            setStep('idle');
                            setErrorMsg(null);
                          }}
                          className={cn(
                            'w-full px-4 py-3 text-left hover:bg-black/[0.06] dark:hover:bg-white/[0.06] transition-colors text-sm text-surface-950',
                            chain.chainId === sourceChain?.chainId && 'bg-blue-500/10',
                          )}
                        >
                          {chain.chain}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {sourceChain && !onSourceChain && step === 'idle' && (
                <button
                  onClick={handleSwitchToSource}
                  disabled={isSwitching}
                  className="btn-secondary w-full justify-center text-sm"
                >
                  {isSwitching
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : `Switch to ${sourceChain.chain}`}
                </button>
              )}
            </div>

            <div className="flex justify-center -my-2 relative z-10">
              <button
                onClick={swapDirection}
                aria-label="Swap bridge direction"
                className="w-10 h-10 rounded-full border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-surface-900 shadow-sm flex items-center justify-center text-surface-600 hover:text-blue-600 transition-colors"
              >
                <GitMerge className="w-4 h-4 rotate-90" />
              </button>
            </div>

            <div className="glass-card p-5 space-y-3">
              <label className="text-surface-600 text-xs font-medium uppercase tracking-wider">
                To
              </label>

              <div className="relative">
                <button
                  onClick={() => {
                    setShowDestinationMenu((value) => !value);
                    setShowSourceMenu(false);
                  }}
                  disabled={step !== 'idle'}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-black/[0.04] dark:bg-white/[0.04] hover:bg-black/[0.07] dark:hover:bg-white/[0.07] border border-black/[0.08] dark:border-white/[0.08] transition-colors disabled:opacity-60"
                >
                  <span className="text-sm font-medium text-surface-950">
                    {destinationChain?.chain ?? 'Select chain'}
                  </span>
                  <ChevronDown className={cn(
                    'w-4 h-4 text-surface-600 transition-transform',
                    showDestinationMenu && 'rotate-180',
                  )} />
                </button>

                <AnimatePresence>
                  {showDestinationMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="absolute top-full left-0 right-0 mt-1 glass-card z-50 max-h-[50vh] overflow-y-auto overscroll-contain touch-pan-y"
                    >
                      {chains.map((chain) => (
                        <button
                          key={chain.chainId}
                          onClick={() => {
                            if (chain.chainId === sourceChain?.chainId) {
                              toast.error('Choose a different source network');
                              return;
                            }
                            setDestinationChain(chain);
                            setShowDestinationMenu(false);
                            setQuote(null);
                            setStep('idle');
                            setErrorMsg(null);
                          }}
                          className={cn(
                            'w-full px-4 py-3 text-left hover:bg-black/[0.06] dark:hover:bg-white/[0.06] transition-colors text-sm text-surface-950',
                            chain.chainId === destinationChain?.chainId && 'bg-blue-500/10',
                          )}
                        >
                          {chain.chain}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {address && (
                <p className="text-surface-500 text-xs">
                  Destination wallet: {formatAddress(address)}
                </p>
              )}
            </div>

            <div className="glass-card p-5 space-y-2.5">
              <label className="text-surface-600 text-xs font-medium uppercase tracking-wider">
                Amount (USDC)
              </label>

              <input
                type="number"
                value={amount}
                placeholder="0.00"
                onChange={(event) => setAmount(event.target.value)}
                disabled={step !== 'idle'}
                className="input-field"
                min="0"
                step="0.000001"
              />

              {amount && !amountValid && (
                <p className="text-rose-600 dark:text-rose-400 text-xs flex items-center gap-1.5">
                  <AlertCircle className="w-3 h-3" />
                  Amount must be between 0.000001 and 1000 USDC
                </p>
              )}
            </div>

            {quote && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="glass-card p-4 space-y-2 text-sm"
              >
                <div className="flex justify-between">
                  <span className="text-surface-600">Route</span>
                  <span className="text-surface-950 font-medium">
                    {quote.sourceChain} → {quote.destinationChain}
                  </span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span className="text-surface-700">USDC to burn</span>
                  <span className="text-surface-950 font-mono">{quote.amount.toFixed(6)} USDC</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-surface-600">Estimated CCTP fee</span>
                  <span className="text-surface-950 font-mono">
                    {quote.fee.toFixed(6)} USDC
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-surface-600">Estimated receive</span>
                  <span className="text-surface-950 font-mono">{Math.max(0, quote.amount - quote.fee).toFixed(6)} USDC</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-surface-600">Estimated time</span>
                  <span className="text-surface-950">{quote.estimatedTime}</span>
                </div>
                {quote.feeEstimated && (
                  <p className="text-amber-600 dark:text-amber-400 text-xs flex items-center gap-1.5 pt-1">
                    <Info className="w-3 h-3" />
                    Live fee estimate will be refreshed when the wallet is on the source chain.
                  </p>
                )}
              </motion.div>
            )}

            {step === 'executing' && (
              <div className="glass-card p-5 text-center space-y-3 border-blue-500/20 bg-blue-500/5">
                <Loader2 className="w-6 h-6 text-blue-600 dark:text-blue-400 animate-spin mx-auto" />
                <p className="text-surface-950 text-sm font-medium">
                  Circle App Kit is executing the bridge…
                </p>
                <p className="text-surface-600 text-xs">
                  Approval, burn, attestation and destination mint are handled by the SDK.
                </p>
              </div>
            )}

            {step === 'error' && errorMsg && (
              <div className="glass-card p-3 border-rose-500/20 bg-rose-500/5 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
                <p className="text-rose-600 dark:text-rose-400 text-sm">{errorMsg}</p>
              </div>
            )}

            {(step === 'idle' || step === 'error') && (
              !onSourceChain && sourceChain ? (
                <button
                  disabled
                  className="btn-primary w-full justify-center opacity-40 cursor-not-allowed"
                >
                  Switch network to continue
                </button>
              ) : (
                <button
                  onClick={() => void handleManualBridge()}
                  disabled={!canBridge}
                  className="btn-primary w-full justify-center text-base py-3.5 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <GitMerge className="w-4 h-4" />
                  Review Bridge
                </button>
              )
            )}

            {step === 'executing' && (
              <button disabled className="btn-primary w-full justify-center opacity-70">
                <Loader2 className="w-4 h-4 animate-spin" />
                Bridging…
              </button>
            )}

            {step === 'error' && (
              <button onClick={handleReset} className="btn-ghost w-full justify-center">
                <RefreshCw className="w-4 h-4" />
                Try Again
              </button>
            )}

            {mode === 'manual' && <AnimatePresence>
              {bridgeConfirmation && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="bridge-confirm-title"
                >
                  <motion.div
                    initial={{ opacity: 0, y: 12, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className="w-full max-w-md glass-card p-6 space-y-5 shadow-2xl"
                  >
                    <div>
                      <h2 id="bridge-confirm-title" className="text-lg font-bold text-surface-950">Confirm bridge</h2>
                      <p className="text-surface-600 text-xs mt-1">Review the exact USDC amount before your wallet opens.</p>
                    </div>
                    <div className="rounded-xl bg-black/[0.04] dark:bg-white/[0.04] p-4 space-y-2.5">
                      <div className="flex justify-between">
                        <span className="text-surface-600">USDC to burn</span>
                        <span className="font-mono font-semibold text-surface-950">{Number(bridgeConfirmation.amount).toFixed(6)} USDC</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-surface-600">From</span>
                        <span className="text-surface-950">{bridgeConfirmation.route.chain}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-surface-600">To</span>
                        <span className="text-surface-950">{bridgeConfirmation.target.chain}</span>
                      </div>
                      <p className="pt-2 text-[11px] text-surface-500">Native gas is separate from the USDC amount. You can reject the wallet request after this review if anything looks different.</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setBridgeConfirmation(null); setAgentExecuting(false); }} className="btn-ghost flex-1 justify-center">Reject</button>
                      <button onClick={() => void confirmBridge()} className="btn-primary flex-1 justify-center">Confirm {Number(bridgeConfirmation.amount).toFixed(6)} USDC</button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>}

            <p className="text-center text-surface-500 text-xs">
              Circle App Kit · CCTP V2 · Testnet only · Arc ↔ Ethereum / Base / Arbitrum
            </p>
          </motion.div>
        )
      )}
    </div>
  );
}

export default function BridgePage() {
  return (
    <Suspense
      fallback={
        <div className="page-container max-w-lg flex items-center justify-center min-h-[60vh]">
          <div className="text-surface-500 text-sm">Loading…</div>
        </div>
      }
    >
      <BridgePageInner />
    </Suspense>
  );
}
