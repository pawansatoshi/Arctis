'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useWaitForTransactionReceipt, useAccount, useChainId, useSwitchChain } from 'wagmi';
import { createPublicClient, createWalletClient, custom, formatEther, formatUnits, http, parseUnits } from 'viem';
import { TESTNET_NETWORK, MAINNET_NETWORK, ERC20_ABI } from '@/lib/contracts';
import { arcTestnet, arcMainnet } from '@/lib/chain/arcChain';
import { useAppStore } from '@/lib/store';
import { useWalletAuth } from '@/lib/auth/useWalletAuth';
import { parseTransactionError, generateId } from '@/lib/utils';
import { announceTransactionState } from '@/lib/transaction/voice';
import toast from 'react-hot-toast';
import type { TransactionRecord } from '@/types';

interface TransferParams { to: string; amount: string; note?: string }
type NetworkEnv = 'testnet' | 'mainnet';

const EVM = /^0x[a-fA-F0-9]{40}$/;
const HASH = /^0x[0-9a-fA-F]{64}$/;
const PASSPORT = /^[a-z0-9_-]{3,32}(?:\.arc)?$/i;
const AMOUNT = /^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/;

function selectedEnv(): NetworkEnv {
  try {
    return window.localStorage.getItem('arctis-network-env') === 'mainnet' ? 'mainnet' : 'testnet';
  } catch {
    return 'testnet';
  }
}

async function resolveRecipient(value: string) {
  const v = value.trim();
  if (EVM.test(v)) return v;
  if (!PASSPORT.test(v)) throw new Error('Recipient is not a valid Arc-compatible EVM address or .arc Passport.');
  const username = v.toLowerCase().replace(/\.arc$/, '');
  announceTransactionState('preflight');
  const r = await fetch(`/api/passport/resolve?username=${encodeURIComponent(username)}`);
  let d: { walletAddress?: string; error?: string } = {};
  try { d = await r.json(); } catch {}
  if (!r.ok || !d.walletAddress) throw new Error(d.error || `Passport ${username}.arc is unavailable.`);
  if (!EVM.test(d.walletAddress)) throw new Error('Passport resolution returned an invalid wallet address.');
  return d.walletAddress;
}

async function preflight(
  network: typeof TESTNET_NETWORK | typeof MAINNET_NETWORK,
  chain: typeof arcTestnet | typeof arcMainnet,
  address: `0x${string}`,
  recipient: `0x${string}`,
  amount: string
) {
  const c = createPublicClient({ chain, transport: http(network.rpc) });
  const req = parseUnits(amount, network.decimals.USDC);
  const [native, gasPrice, usdc] = await Promise.all([
    c.getBalance({ address }),
    c.getGasPrice(),
    c.readContract({ address: network.contracts.USDC, abi: ERC20_ABI, functionName: 'balanceOf', args: [address] }),
  ]);
  const gas = await c.estimateContractGas({
    account: address,
    address: network.contracts.USDC,
    abi: ERC20_ABI,
    functionName: 'transfer',
    args: [recipient, req],
  });
  const requiredGas = gasPrice * gas * 2n;
  if (usdc < req) throw new Error(`Insufficient USDC. You have ${formatUnits(usdc, network.decimals.USDC)} USDC, but ${amount} USDC is required. No transaction was submitted.`);
  if (native < requiredGas) throw new Error(`Insufficient USDC for network fees. Approximately ${formatEther(requiredGas)} USDC is required for gas. No USDC was sent.`);
}

async function record(payload: Record<string, unknown>, headers: Record<string, string>) {
  try {
    const r = await fetch('/api/transfer/record', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    if (!r.ok) return null;
    return ((await r.json()) as { id?: string }).id ?? null;
  } catch { return null; }
}

function patch(payload: Record<string, unknown>, headers: Record<string, string>) {
  void fetch('/api/transfer/record', { method: 'PATCH', headers, body: JSON.stringify(payload) }).catch(() => {});
}

export function useTransfer(mode: TransactionRecord['mode'] = 'manual') {
  const { address, connector } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { addTransaction, updateTransaction } = useAppStore();
  const { getAuthHeaders } = useWalletAuth();
  const [networkEnv, setNetworkEnv] = useState<NetworkEnv>('testnet');
  const [isPending, setPending] = useState(false);
  const [isSuccess, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}`>();
  const localId = useRef<string | null>(null);
  const docId = useRef<string | null>(null);
  const authHeaders = useRef<Record<string, string>>({ 'Content-Type': 'application/json' });

  useEffect(() => {
    setNetworkEnv(selectedEnv());
    const onNetworkChanged = () => setNetworkEnv(selectedEnv());
    window.addEventListener('arctis-network-changed', onNetworkChanged);
    return () => window.removeEventListener('arctis-network-changed', onNetworkChanged);
  }, []);

  const network = networkEnv === 'mainnet' ? MAINNET_NETWORK : TESTNET_NETWORK;
  const chain = networkEnv === 'mainnet' ? arcMainnet : arcTestnet;

  const { isLoading: isConfirming, isSuccess: receiptSuccess, isError: receiptError } =
    useWaitForTransactionReceipt({ hash: txHash, query: { enabled: !!txHash } });

  if (receiptSuccess && txHash && localId.current && !isSuccess) {
    setSuccess(true);
    setPending(false);
    updateTransaction(localId.current, { status: 'confirmed', txHash });
    patch({ docId: docId.current, status: 'confirmed', txHash, walletAddress: address }, authHeaders.current);
    toast.dismiss(txHash);
    toast.success(`Transfer confirmed on ${network.networkName}`);
    announceTransactionState('confirmed');
  }

  if (receiptError && txHash && localId.current && !isSuccess) {
    setPending(false);
    updateTransaction(localId.current, { status: 'failed', txHash });
    patch({ docId: docId.current, status: 'failed', txHash, walletAddress: address, log: { level: 'error', message: 'Transaction failed on-chain', walletAddress: address } }, authHeaders.current);
    toast.dismiss(txHash);
    toast.error('Transaction failed on-chain');
    announceTransactionState('failed');
  }

  const transfer = useCallback(async ({ to, amount, note }: TransferParams) => {
    if (!address || !connector) { setError('Wallet not connected'); return; }
    if (isPending) return;
    if (!AMOUNT.test(amount) || Number(amount) <= 0) {
      setError('Enter a valid USDC amount with up to 6 decimal places.');
      return;
    }

    setError(null);
    setSuccess(false);
    setTxHash(undefined);
    setPending(true);
    const id = generateId();
    localId.current = id;

    try {
      announceTransactionState('preflight');
      const resolved = await resolveRecipient(to);
      if (resolved.toLowerCase() === address.toLowerCase()) throw new Error('Recipient must be different from the sending wallet.');

      // Hard boundary: wallet must be on exactly the network selected in ARCTIS.
      if (chainId !== network.chainId) {
        await switchChainAsync({ chainId: network.chainId });
      }

      await preflight(network, chain, address, resolved as `0x${string}`, amount);

      const rawAmount = parseUnits(amount, network.decimals.USDC).toString();
      addTransaction({
        id,
        walletAddress: address,
        toAddress: resolved,
        amount: rawAmount,
        amountFormatted: amount,
        status: 'pending',
        token: 'USDC',
        chainId: network.chainId,
        createdAt: new Date().toISOString(),
        note,
        mode,
        type: 'send',
      });

      authHeaders.current = await getAuthHeaders();
      const d = await record({
        walletAddress: address,
        toAddress: resolved,
        amount: rawAmount,
        amountFormatted: amount,
        token: 'USDC',
        note,
        mode,
        network: networkEnv,
      }, authHeaders.current);
      docId.current = d;

      announceTransactionState('wallet_approval');
      const provider = await connector.getProvider();
      const walletClient = createWalletClient({
        account: address,
        chain,
        transport: custom(provider as Parameters<typeof custom>[0]),
      });

      const hash = await walletClient.writeContract({
        address: network.contracts.USDC,
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [resolved as `0x${string}`, parseUnits(amount, network.decimals.USDC)],
      });

      if (!HASH.test(hash)) throw new Error('Wallet returned no valid transaction hash');
      setTxHash(hash);
      updateTransaction(id, { txHash: hash, status: 'pending' });
      patch({ docId: d, status: 'pending', txHash: hash, walletAddress: address }, authHeaders.current);
      toast.success(`Transaction submitted on ${network.networkName} — waiting for confirmation`, { id: hash, duration: Infinity });
      announceTransactionState('submitted');
      announceTransactionState('processing');
    } catch (e) {
      const msg = parseTransactionError(e);
      setError(msg);
      setPending(false);
      updateTransaction(id, { status: 'failed' });
      patch({ docId: docId.current, status: 'failed', walletAddress: address, log: { level: 'error', message: 'Transfer failed', data: { error: msg }, walletAddress: address } }, authHeaders.current);
      toast.error(msg);
      announceTransactionState('failed');
    }
  }, [address, connector, chainId, switchChainAsync, addTransaction, updateTransaction, isPending, mode, getAuthHeaders, networkEnv, network, chain]);

  const reset = useCallback(() => {
    setPending(false);
    setSuccess(false);
    setError(null);
    setTxHash(undefined);
    localId.current = null;
    docId.current = null;
  }, []);

  return { transfer, isPending, isConfirming, isSuccess, isError: !!error, error, txHash: txHash ?? null, reset, networkEnv, networkName: network.networkName, networkChainId: network.chainId };
}
