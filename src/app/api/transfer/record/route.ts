import { NextRequest, NextResponse } from 'next/server';
import { saveTransaction, updateTransactionStatus } from '@/lib/firebase/transactions';
import { obs } from '@/lib/observability/logger';
import { isValidEthAddress, verifyApiWallet } from '@/lib/auth/middleware';
import { CHAIN_ID, NETWORK_NAME, TESTNET_NETWORK, MAINNET_NETWORK } from '@/lib/contracts';
import type { TransactionRecord } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const { walletAddress, toAddress, amount, amountFormatted, token, note, mode, network } =
      (await req.json()) as {
        walletAddress?: string;
        toAddress?: string;
        amount?: string;
        amountFormatted?: string;
        token?: TransactionRecord['token'];
        note?: string;
        mode?: TransactionRecord['mode'];
        network?: 'testnet' | 'mainnet';
      };

    if (!walletAddress || !toAddress || !amount || !amountFormatted) {
      return NextResponse.json({ error: 'walletAddress, toAddress, amount, amountFormatted required' }, { status: 400 });
    }
    if (!isValidEthAddress(walletAddress) || !isValidEthAddress(toAddress)) {
      return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
    }
    const auth = await verifyApiWallet(req, walletAddress, true);
    if (!auth.ok || auth.walletAddress !== walletAddress.toLowerCase()) {
      return NextResponse.json({ error: auth.reason ?? 'Wallet signature required' }, { status: 401 });
    }
    if (mode && mode !== 'manual' && mode !== 'agent') {
      return NextResponse.json({ error: 'Invalid execution mode' }, { status: 400 });
    }

    const profile = network === 'mainnet' ? MAINNET_NETWORK : TESTNET_NETWORK;

    const id = await saveTransaction(walletAddress, {
      toAddress,
      amount,
      amountFormatted,
      status: 'pending',
      token: token ?? 'USDC',
      chainId: network ? profile.chainId : CHAIN_ID,
      networkName: network ? profile.networkName : NETWORK_NAME,
      ...(note !== undefined ? { note } : {}),
      mode: mode ?? 'manual',
      type: 'send',
    });

    return NextResponse.json({ id });
  } catch (err) {
    const e = err as Error;
    void obs.error('wallet', 'Transfer record create failed', { error: e.message });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { docId, status, txHash, walletAddress, log } = (await req.json()) as {
      docId?: string | null;
      status?: TransactionRecord['status'];
      txHash?: string;
      walletAddress?: string;
      log?: {
        level: 'info' | 'error';
        message: string;
        data?: Record<string, unknown>;
        walletAddress?: string;
      };
    };

    if (!status || !walletAddress) return NextResponse.json({ error: 'status and walletAddress required' }, { status: 400 });
    if (!isValidEthAddress(walletAddress)) return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
    const auth = await verifyApiWallet(req, walletAddress, true);
    if (!auth.ok || auth.walletAddress !== walletAddress.toLowerCase()) {
      return NextResponse.json({ error: auth.reason ?? 'Wallet signature required' }, { status: 401 });
    }
    if (docId) await updateTransactionStatus(docId, status, txHash);
    if (log) void obs[log.level]('wallet', log.message, log.data, log.walletAddress ?? walletAddress);
    return NextResponse.json({ success: true });
  } catch (err) {
    const e = err as Error;
    void obs.error('wallet', 'Transfer record update failed', { error: e.message });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
