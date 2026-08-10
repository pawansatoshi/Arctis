'use client';

import { useState, useCallback, useRef } from 'react';
import { useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { parseUnits } from 'viem';
import { PRIMARY_CONTRACT, PRIMARY_DECIMALS, ERC20_ABI, CHAIN_ID } from '@/lib/contracts';
import { useAppStore } from '@/lib/store';
import { parseTransactionError, generateId } from '@/lib/utils';
import toast from 'react-hot-toast';
import type { TransactionRecord } from '@/types';

interface TransferParams { to: string; amount: string; note?: string; }

function isPassportRecipient(value: string): boolean {
  const v = value.trim().toLowerCase();
  return !v.startsWith('0x') && /^[a-z0-9_-]+(?:\\.arc)?$/.test(v);
}

async function resolveTransferRecipient(value: string): Promise<string> {
  const recipient = value.trim();

  // Normal wallet address: no Passport lookup required.
  if (/^0x[a-fA-F0-9]{40}$/.test(recipient)) {
    return recipient;
  }

  if (!isPassportRecipient(recipient)) {
    throw new Error('Enter a valid wallet address or Passport ID');
  }

  const username = recipient.toLowerCase().endsWith('.arc')
    ? recipient.slice(0, -4)
    : recipient;

  const response = await fetch(
    `/api/passport/resolve?username=${encodeURIComponent(username)}`,
  );

  let data: { walletAddress?: string; error?: string } = {};
  try {
    data = await response.json();
  } catch {
    // Keep the explicit error below.
  }

  if (!response.ok || !data.walletAddress) {
    throw new Error(data.error || `Passport not found: ${recipient}`);
  }

  if (!/^0x[a-fA-F0-9]{40}$/.test(data.walletAddress)) {
    throw new Error('Passport resolved to an invalid wallet address');
  }

  return data.walletAddress;
}

// ── Server boundary helpers ─────────────────────────────────
// Replaces direct imports of '@/lib/firebase/transactions' and
// '@/lib/observability/logger' (both 'server-only' / firebase-admin
// modules) with calls to /api/transfer/record — the same
// client → API route → Firebase Admin shape already used by
// useTransfer's Swap/Bridge counterparts. Wallet signing below is
// untouched; only record-keeping/logging moved behind the API.

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
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { id?: string };
    return data.id ?? null;
  } catch {
    return null;
  }
}

function patchTransferRecord(payload: {
  docId?: string | null;
  status: TransactionRecord['status'];
  txHash?: string;
  log?: {
    level: 'info' | 'error';
    message: string;
    data?: Record<string, unknown>;
    walletAddress?: string;
  };
}): void {
  void fetch('/api/transfer/record', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => { /* non-critical */ });
}

export function useTransfer() {
  const { address } = useAccount();
  const { addTransaction, updateTransaction } = useAppStore();
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined);
  const firestoreIdRef = useRef<string | null>(null);
  const localIdRef = useRef<string | null>(null);

  const { writeContractAsync, isPending } = useWriteContract();

  // Real receipt monitoring
  const { isLoading: isConfirming, isSuccess: receiptSuccess, isError: receiptError } =
    useWaitForTransactionReceipt({
      hash: txHash,
      query: { enabled: !!txHash },
    });

  // Handle confirmed
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

  // Handle on-chain failure
  if (receiptError && txHash && localIdRef.current && !isSuccess) {
    updateTransaction(localIdRef.current, { status: 'failed', txHash });
    if (firestoreIdRef.current) {
      patchTransferRecord({ docId: firestoreIdRef.current, status: 'failed', txHash });
    }
    toast.dismiss(txHash);
    toast.error('Transaction failed on-chain');
  }

  const transfer = useCallback(async ({ to, amount, note }: TransferParams) => {
    if (!address) { setError('Wallet not connected'); return; }
    setError(null);
    setIsSuccess(false);
    setTxHash(undefined);

    const localId = generateId();
    localIdRef.current = localId;

    let resolvedTo: string;
    try {
      resolvedTo = await resolveTransferRecipient(to);
    } catch (err) {
      const msg = err instanceof Error
        ? err.message
        : 'Unable to resolve recipient';

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
          createTransferRecord({
            walletAddress: address, toAddress: resolvedTo, amount: amountBigInt.toString(),
            amountFormatted: amount, token: 'USDC', note,
          }),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000)),
        ]);
        if (docId) firestoreIdRef.current = docId;
      } catch { /* non-critical */ }

      const hash = await writeContractAsync({
        address: PRIMARY_CONTRACT,
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [resolvedTo as `0x${string}`, amountBigInt],
      });

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
  }, [address, addTransaction, updateTransaction, writeContractAsync]);

  const reset = useCallback(() => {
    setIsSuccess(false);
    setError(null);
    setTxHash(undefined);
    firestoreIdRef.current = null;
    localIdRef.current = null;
  }, []);

  return {
    transfer,
    isPending,
    isConfirming,
    isSuccess,
    isError: !!error,
    error,
    txHash: txHash ?? null,
    reset,
  };
}
