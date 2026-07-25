'use client';

import { useState, useCallback, useRef } from 'react';
import { useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { parseUnits } from 'viem';
import { PRIMARY_CONTRACT, PRIMARY_DECIMALS, ERC20_ABI, CHAIN_ID } from '@/lib/contracts';
import { useAppStore } from '@/lib/store';
import { parseTransactionError, generateId } from '@/lib/utils';
import { saveTransaction, updateTransactionStatus } from '@/lib/firebase/transactions';
import { obs } from '@/lib/observability/logger';
import toast from 'react-hot-toast';
import type { TransactionRecord } from '@/types';

interface TransferParams { to: string; amount: string; note?: string; }

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
    if (firestoreIdRef.current) {
      void updateTransactionStatus(firestoreIdRef.current, 'confirmed', txHash);
    }
    toast.dismiss(txHash);
    toast.success('Transfer confirmed on Arc!');
    void obs.info('wallet', 'Transfer confirmed', { hash: txHash }, address);
  }

  // Handle on-chain failure
  if (receiptError && txHash && localIdRef.current && !isSuccess) {
    updateTransaction(localIdRef.current, { status: 'failed', txHash });
    if (firestoreIdRef.current) {
      void updateTransactionStatus(firestoreIdRef.current, 'failed', txHash);
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
    const amountBigInt = parseUnits(amount, PRIMARY_DECIMALS);

    const pendingTx: TransactionRecord = {
      id: localId, walletAddress: address, toAddress: to,
      amount: amountBigInt.toString(), amountFormatted: amount,
      status: 'pending', token: 'USDC', chainId: CHAIN_ID,
      createdAt: new Date().toISOString(), note, type: 'send',
    };
    addTransaction(pendingTx);
    toast.loading('Confirm in wallet…', { id: localId });

    try {
      let docId: string | null = null;
      try {
        docId = await saveTransaction(address, {
          toAddress: to, amount: amountBigInt.toString(), amountFormatted: amount,
          status: 'pending', token: 'USDC', chainId: CHAIN_ID, note,
        });
        firestoreIdRef.current = docId;
      } catch { /* non-critical */ }

      const hash = await writeContractAsync({
        address: PRIMARY_CONTRACT,
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [to as `0x${string}`, amountBigInt],
      });

      setTxHash(hash);
      updateTransaction(localId, { txHash: hash });
      if (docId) void updateTransactionStatus(docId, 'pending', hash);

      toast.dismiss(localId);
      toast.loading('Waiting for confirmation…', { id: hash });
    } catch (err) {
      const msg = parseTransactionError(err);
      setError(msg);
      updateTransaction(localId, { status: 'failed' });
      toast.dismiss(localId);
      toast.error(msg);
      if (firestoreIdRef.current) void updateTransactionStatus(firestoreIdRef.current, 'failed');
      void obs.error('wallet', 'Transfer failed', { error: msg }, address);
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
