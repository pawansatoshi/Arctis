'use client';

import { useState, useCallback, useRef } from 'react';
import { useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { createViemAdapterFromProvider } from '@circle-fin/adapter-viem-v2';
import { AppKit } from '@circle-fin/app-kit';
import { createPublicClient, fallback, formatUnits, http, parseUnits } from 'viem';
import { PRIMARY_CONTRACT, PRIMARY_DECIMALS, ERC20_ABI, CHAIN_ID, RPC_FALLBACK_URLS } from '@/lib/contracts';
import { useAppStore } from '@/lib/store';
import { parseTransactionError, generateId } from '@/lib/utils';
import toast from 'react-hot-toast';
import type { TransactionRecord } from '@/types';

interface TransferParams { to: string; amount: string; note?: string; }

function normalizePassportRecipient(value: string): string {
  return value.trim().replace(/^['"`]+|['"`]+$/g, '').replace(/^@/, '').toLowerCase();
}

function isPassportRecipient(value: string): boolean {
  const v = normalizePassportRecipient(value);
  return !v.startsWith('0x') && /^[a-z0-9_-]{2,32}(?:\.arc)?$/.test(v);
}

async function resolveTransferRecipient(value: string): Promise<string> {
  const recipient = normalizePassportRecipient(value);
  if (/^0x[a-fA-F0-9]{40}$/.test(recipient)) return recipient;
  if (!isPassportRecipient(recipient)) throw new Error('Enter a valid wallet address or Passport ID');

  const username = recipient.endsWith('.arc') ? recipient.slice(0, -4) : recipient;
  const response = await fetch(`/api/passport/resolve?username=${encodeURIComponent(username)}`);
  let data: { walletAddress?: string; error?: string } = {};
  try { data = await response.json(); } catch { /* explicit error below */ }
  if (!response.ok || !data.walletAddress) throw new Error(data.error || `Passport not found: ${username}.arc`);
  if (!/^0x[a-fA-F0-9]{40}$/.test(data.walletAddress)) throw new Error('Passport resolved to an invalid wallet address');
  return data.walletAddress;
}

/**
 * Arc uses USDC as its native gas asset. Arc documents the ERC-20 USDC
 * interface as the recommended balance/transfer interface; the native
 * representation is the same underlying balance at 18 decimals.
 */
async function preflightTransfer(address: `0x${string}`, to: `0x${string}`, amount: string) {
  const client = createPublicClient({ transport: fallback(RPC_FALLBACK_URLS.map((url) => http(url))) });
  const requiredUsdc = parseUnits(amount, PRIMARY_DECIMALS);
  const [usdcBalance, gasPrice] = await Promise.all([
    client.readContract({ address: PRIMARY_CONTRACT, abi: ERC20_ABI, functionName: 'balanceOf', args: [address] }),
    client.getGasPrice(),
  ]);

  let gasLimit = 100_000n;
  try {
    gasLimit = await client.estimateContractGas({
      address: PRIMARY_CONTRACT,
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [to, requiredUsdc],
      account: address,
    });
  } catch {
    // App Kit performs the authoritative estimate immediately before send.
  }

  // Gas is returned in Arc's 18-decimal native USDC representation. Convert
  // the fee upward into the ERC-20 6-decimal representation before comparing
  // it with the ERC-20 balance. This avoids mixing the two decimal systems.
  const estimatedNativeGas = gasPrice * gasLimit;
  const nativeScale = 10n ** 12n;
  const gasFeeUsdc = (estimatedNativeGas + nativeScale - 1n) / nativeScale;
  const requiredTotalUsdc = requiredUsdc + gasFeeUsdc;

  if (usdcBalance < requiredTotalUsdc) {
    const availableUsdc = formatUnits(usdcBalance, PRIMARY_DECIMALS);
    const requiredDisplay = formatUnits(requiredUsdc, PRIMARY_DECIMALS);
    const feeUsdc = formatUnits(gasFeeUsdc, PRIMARY_DECIMALS);
    throw new Error(`Insufficient USDC for payment and network fee. Available: ${availableUsdc} USDC. Required: ${requiredDisplay} USDC + ~${feeUsdc} USDC network fee. No transaction was submitted.`);
  }
}

async function createTransferRecord(payload: { walletAddress: string; toAddress: string; amount: string; amountFormatted: string; token: TransactionRecord['token']; note?: string; mode?: TransactionRecord['mode'] }): Promise<string | null> {
  try {
    const res = await fetch('/api/transfer/record', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) return null;
    const data = (await res.json()) as { id?: string };
    return data.id ?? null;
  } catch { return null; }
}

function patchTransferRecord(payload: { docId?: string | null; status: TransactionRecord['status']; txHash?: string; log?: { level: 'info' | 'error'; message: string; data?: Record<string, unknown>; walletAddress?: string } }): void {
  void fetch('/api/transfer/record', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).catch(() => { /* non-critical */ });
}

export function useTransfer() {
  const { address, connector } = useAccount();
  const { addTransaction, updateTransaction } = useAppStore();
  const [isPending, setIsPending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const firestoreIdRef = useRef<string | null>(null);
  const localIdRef = useRef<string | null>(null);

  const { isLoading: isConfirming, isSuccess: receiptSuccess, isError: receiptError } = useWaitForTransactionReceipt({ hash: txHash, query: { enabled: !!txHash } });

  if (receiptSuccess && txHash && localIdRef.current && !isSuccess) {
    setIsSuccess(true);
    setIsPending(false);
    updateTransaction(localIdRef.current, { status: 'confirmed', txHash });
    patchTransferRecord({ docId: firestoreIdRef.current, status: 'confirmed', txHash, log: { level: 'info', message: 'Transfer confirmed', data: { hash: txHash }, walletAddress: address });
    toast.dismiss(txHash);
    toast.success('Transfer confirmed on Arc!');
  }

  if (receiptError && txHash && localIdRef.current && !isSuccess) {
    setIsPending(false);
    updateTransaction(localIdRef.current, { status: 'failed', txHash });
    if (firestoreIdRef.current) patchTransferRecord({ docId: firestoreIdRef.current, status: 'failed', txHash });
    toast.dismiss(txHash);
    toast.error('Transaction failed on-chain');
  }

  const transfer = useCallback(async ({ to, amount, note }: TransferParams) => {
    if (!address || !connector) { setError('Wallet not connected'); return; }
    if (isPending) return;
    setError(null);
    setIsSuccess(false);
    setTxHash(undefined);
    setIsPending(true);

    const localId = generateId();
    localIdRef.current = localId;

    try {
      const resolvedTo = await resolveTransferRecipient(to);
      await preflightTransfer(address, resolvedTo as `0x${string}`, amount);
      const mode: TransactionRecord['mode'] = typeof window !== 'undefined' && window.sessionStorage.getItem('arctis-transfer-mode') === 'agent' ? 'agent' : 'manual';

      const amountBigInt = parseUnits(amount, PRIMARY_DECIMALS);
      addTransaction({ id: localId, walletAddress: address, toAddress: resolvedTo, amount: amountBigInt.toString(), amountFormatted: amount, status: 'pending', token: 'USDC', chainId: CHAIN_ID, createdAt: new Date().toISOString(), note, mode, type: 'send' });
      toast.loading('Confirm in wallet…', { id: localId });

      let docId: string | null = null;
      try {
        docId = await Promise.race([
          createTransferRecord({ walletAddress: address, toAddress: resolvedTo, amount: amountBigInt.toString(), amountFormatted: amount, token: 'USDC', note, mode }),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000)),
        ]);
        if (docId) firestoreIdRef.current = docId;
      } catch { /* non-critical */ }

      const provider = await connector.getProvider();
      const adapter = await createViemAdapterFromProvider({ provider: provider as never });
      const kit = new AppKit();
      const sendParams = { from: { adapter, chain: 'Arc_Testnet' as const }, to: resolvedTo, amount, token: 'USDC' as const };
      await kit.estimateSend(sendParams);
      const result = await kit.send(sendParams);
      const hash = result.txHash as `0x${string}`;
      if (!hash || !/^0x[0-9a-fA-F]{64}$/.test(hash)) throw new Error('Arc App Kit returned no valid transaction hash');

      setTxHash(hash);
      updateTransaction(localId, { txHash: hash });
      if (docId) patchTransferRecord({ docId, status: 'pending', txHash: hash });
      toast.dismiss(localId);
      toast.loading('Waiting for confirmation…', { id: hash });
    } catch (err) {
      const msg = parseTransactionError(err);
      setError(msg);
      setIsPending(false);
      updateTransaction(localId, { status: 'failed' });
      toast.dismiss(localId);
      toast.error(msg);
      patchTransferRecord({ docId: firestoreIdRef.current, status: 'failed', log: { level: 'error', message: 'Transfer failed', data: { error: msg }, walletAddress: address } });
    }
  }, [address, connector, addTransaction, updateTransaction, isPending]);

  const reset = useCallback(() => {
    setIsPending(false);
    setIsSuccess(false);
    setError(null);
    setTxHash(undefined);
    firestoreIdRef.current = null;
    localIdRef.current = null;
  }, []);

  return { transfer, isPending, isConfirming, isSuccess, isError: !!error, error, txHash: txHash ?? null, reset };
}
