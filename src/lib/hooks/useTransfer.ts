'use client';

import { useState, useCallback, useRef } from 'react';
import { useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { createViemAdapterFromProvider } from '@circle-fin/adapter-viem-v2';
import { AppKit } from '@circle-fin/app-kit';
import { createPublicClient, formatEther, formatUnits, http, parseUnits } from 'viem';
import { PRIMARY_CONTRACT, PRIMARY_DECIMALS, ERC20_ABI, CHAIN_ID, RPC_URL } from '@/lib/contracts';
import { useAppStore } from '@/lib/store';
import { parseTransactionError, generateId } from '@/lib/utils';
import toast from 'react-hot-toast';
import type { TransactionRecord } from '@/types';

interface TransferParams { to: string; amount: string; note?: string; }

function isPassportRecipient(value: string): boolean {
  const v = value.trim().toLowerCase();
  return !v.startsWith('0x') && /^[a-z0-9_-]+(?:\.arc)?$/.test(v);
}

async function resolveTransferRecipient(value: string): Promise<string> {
  const recipient = value.trim();
  if (/^0x[a-fA-F0-9]{40}$/.test(recipient)) return recipient;

  if (!isPassportRecipient(recipient)) {
    throw new Error('Enter a valid wallet address or Passport ID');
  }

  const username = recipient.toLowerCase().endsWith('.arc')
    ? recipient.slice(0, -4)
    : recipient;

  const response = await fetch(`/api/passport/resolve?username=${encodeURIComponent(username)}`);
  let data: { walletAddress?: string; error?: string } = {};
  try { data = await response.json(); } catch { /* explicit error below */ }

  if (!response.ok || !data.walletAddress) {
    throw new Error(data.error || `Passport not found: ${recipient}`);
  }
  if (!/^0x[a-fA-F0-9]{40}$/.test(data.walletAddress)) {
    throw new Error('Passport resolved to an invalid wallet address');
  }
  return data.walletAddress;
}

async function preflightTransfer(address: `0x${string}`, amount: string) {
  const client = createPublicClient({ transport: http(RPC_URL) });
  const requiredUsdc = parseUnits(amount, PRIMARY_DECIMALS);

  const [nativeBalance, gasPrice, usdcBalance] = await Promise.all([
    client.getBalance({ address }),
    client.getGasPrice(),
    client.readContract({
      address: PRIMARY_CONTRACT,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [address],
    }),
  ]);

  if (usdcBalance < requiredUsdc) {
    throw new Error(`Insufficient USDC. You have ${formatUnits(usdcBalance, PRIMARY_DECIMALS)} USDC, but ${amount} USDC is required. No transaction was submitted.`);
  }

  // Conservative source-side guard. App Kit performs the authoritative gas
  // estimate immediately before opening the wallet.
  const requiredNativeGas = gasPrice * 100_000n * 2n;
  if (nativeBalance < requiredNativeGas) {
    throw new Error(`Insufficient ARC for network fees. You need approximately ${formatEther(requiredNativeGas)} ARC to submit this transfer. No USDC was sent.`);
  }
}

async function createTransferRecord(payload: {
  walletAddress: string;
  toAddress: string;
  amount: string;
  amountFormatted: string;
  token: TransactionRecord['token'];
  note?: string;
}): Promise<string | null> {
  try {
    const res = await fetch('/api/transfer/record', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { id?: string };
    return data.id ?? null;
  } catch { return null; }
}

function patchTransferRecord(payload: {
  docId?: string | null;
  status: TransactionRecord['status'];
  txHash?: string;
  log?: { level: 'info' | 'error'; message: string; data?: Record<string, unknown>; walletAddress?: string };
}): void {
  void fetch('/api/transfer/record', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  }).catch(() => { /* non-critical */ });
}

export function useTransfer() {
  const { address, connector } = useAccount();
  const { addTransaction, updateTransaction } = useAppStore();
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const firestoreIdRef = useRef<string | null>(null);
  const localIdRef = useRef<string | null>(null);

  const { isLoading: isConfirming, isSuccess: receiptSuccess, isError: receiptError } = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: !!txHash },
  });

  if (receiptSuccess && txHash && localIdRef.current && !isSuccess) {
    setIsSuccess(true);
    updateTransaction(localIdRef.current, { status: 'confirmed', txHash });
    patchTransferRecord({
      docId: firestoreIdRef.current,
      status: 'confirmed',
      txHash,
      log: { level: 'info', message: 'Transfer confirmed', data: { hash: txHash }, walletAddress: address },
    });
    toast.dismiss(txHash);
    toast.success('Transfer confirmed on Arc!');
  }

  if (receiptError && txHash && localIdRef.current && !isSuccess) {
    updateTransaction(localIdRef.current, { status: 'failed', txHash });
    if (firestoreIdRef.current) patchTransferRecord({ docId: firestoreIdRef.current, status: 'failed', txHash });
    toast.dismiss(txHash);
    toast.error('Transaction failed on-chain');
  }

  const transfer = useCallback(async ({ to, amount, note }: TransferParams) => {
    if (!address || !connector) { setError('Wallet not connected'); return; }
    setError(null);
    setIsSuccess(false);
    setTxHash(undefined);

    const localId = generateId();
    localIdRef.current = localId;

    let resolvedTo: string;
    try {
      resolvedTo = await resolveTransferRecipient(to);
      await preflightTransfer(address, amount);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to verify transfer';
      setError(msg);
      toast.error(msg);
      return;
    }

    const amountBigInt = parseUnits(amount, PRIMARY_DECIMALS);
    const pendingTx: TransactionRecord = {
      id: localId, walletAddress: address, toAddress: resolvedTo,
      amount: amountBigInt.toString(), amountFormatted: amount,
      status: 'pending', token: 'USDC', chainId: CHAIN_ID,
      createdAt: new Date().toISOString(), note, type: 'send',
    };
    addTransaction(pendingTx);
    toast.loading('Confirm in wallet…', { id: localId });

    try {
      let docId: string | null = null;
      try {
        docId = await Promise.race([
          createTransferRecord({ walletAddress: address, toAddress: resolvedTo, amount: amountBigInt.toString(), amountFormatted: amount, token: 'USDC', note }),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000)),
        ]);
        if (docId) firestoreIdRef.current = docId;
      } catch { /* non-critical */ }

      const provider = await connector.getProvider();
      const adapter = await createViemAdapterFromProvider({ provider: provider as never });
      const kit = new AppKit();
      const sendParams = {
        from: { adapter, chain: 'Arc_Testnet' as const },
        to: resolvedTo,
        amount,
        token: 'USDC' as const,
      };

      // App Kit is now the canonical execution boundary. estimateSend runs
      // immediately before send, while the wallet remains the final signer.
      await kit.estimateSend(sendParams);
      const result = await kit.send(sendParams);
      const hash = result.txHash as `0x${string}`;

      if (!hash || !/^0x[0-9a-fA-F]{64}$/.test(hash)) {
        throw new Error('Arc App Kit returned no valid transaction hash');
      }

      setTxHash(hash);
      updateTransaction(localId, { txHash: hash });
      if (docId) patchTransferRecord({ docId, status: 'pending', txHash: hash });
      toast.dismiss(localId);
      toast.loading('Waiting for confirmation…', { id: hash });
    } catch (err) {
      const msg = parseTransactionError(err);
      setError(msg);
      updateTransaction(localId, { status: 'failed' });
      toast.dismiss(localId);
      toast.error(msg);
      patchTransferRecord({
        docId: firestoreIdRef.current,
        status: 'failed',
        log: { level: 'error', message: 'Transfer failed', data: { error: msg }, walletAddress: address },
      });
    }
  }, [address, connector, addTransaction, updateTransaction]);

  const reset = useCallback(() => {
    setIsSuccess(false);
    setError(null);
    setTxHash(undefined);
    firestoreIdRef.current = null;
    localIdRef.current = null;
  }, []);

  return {
    transfer,
    isPending: false,
    isConfirming,
    isSuccess,
    isError: !!error,
    error,
    txHash: txHash ?? null,
    reset,
  };
}
