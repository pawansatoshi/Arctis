import { NextRequest, NextResponse } from 'next/server';
import { saveTransaction, updateTransactionStatus } from '@/lib/firebase/transactions';
import { obs } from '@/lib/observability/logger';
import { isValidEthAddress } from '@/lib/auth/middleware';
import { CHAIN_ID, NETWORK_NAME } from '@/lib/contracts';
import type { TransactionRecord } from '@/types';

// ============================================================
// Transfer record API — server boundary for useTransfer.ts
// ============================================================
// This route exists solely so the client (`src/lib/hooks/useTransfer.ts`,
// a 'use client' hook) never imports `@/lib/firebase/transactions` or
// `@/lib/observability/logger` directly — both are 'server-only' /
// firebase-admin modules. Mirrors the same client → API route →
// Firebase Admin shape already used by /api/swap/execute and
// /api/bridge/execute.
//
// No server-side transaction is ever signed here — this route only
// persists a record of a transfer the user already signed (or is about
// to sign) client-side via their own wallet. Wallet signing itself is
// untouched and remains 100% client-side in useTransfer.ts.

// ── POST — create a pending transfer record ────────────────
// Called right before / around the wallet signature request, same as
// the original client-side saveTransaction() call.
export async function POST(req: NextRequest) {
  try {
    const { walletAddress, toAddress, amount, amountFormatted, token, note } =
      (await req.json()) as {
        walletAddress?: string;
        toAddress?: string;
        amount?: string;
        amountFormatted?: string;
        token?: TransactionRecord['token'];
        note?: string;
      };

    if (!walletAddress || !toAddress || !amount || !amountFormatted) {
      return NextResponse.json(
        { error: 'walletAddress, toAddress, amount, amountFormatted required' },
        { status: 400 }
      );
    }
    if (!isValidEthAddress(walletAddress) || !isValidEthAddress(toAddress)) {
      return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
    }

    const id = await saveTransaction(walletAddress, {
      toAddress,
      amount,
      amountFormatted,
      status: 'pending',
      token: token ?? 'USDC',
      chainId: CHAIN_ID,
      networkName: NETWORK_NAME,
      note,
      type: 'send',
    });

    return NextResponse.json({ id });
  } catch (err) {
    const e = err as Error;
    void obs.error('wallet', 'Transfer record create failed', { error: e.message });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ── PATCH — update an existing transfer record's status ────
// Called when the tx hash is known (status: 'pending' + txHash), when
// the receipt confirms (status: 'confirmed'), or when signing/on-chain
// fails (status: 'failed'). `docId` may be null (e.g. the original
// create call timed out client-side) — in that case the Firestore
// update is skipped but an optional `log` is still recorded, matching
// the original hook's behavior where the obs call was unconditional
// but the Firestore update was guarded by `firestoreIdRef.current`.
export async function PATCH(req: NextRequest) {
  try {
    const { docId, status, txHash, log } = (await req.json()) as {
      docId?: string | null;
      status?: TransactionRecord['status'];
      txHash?: string;
      log?: {
        level: 'info' | 'error';
        message: string;
        data?: Record<string, unknown>;
        walletAddress?: string;
      };
    };

    if (!status) {
      return NextResponse.json({ error: 'status required' }, { status: 400 });
    }

    if (docId) {
      await updateTransactionStatus(docId, status, txHash);
    }

    if (log) {
      void obs[log.level]('wallet', log.message, log.data, log.walletAddress);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const e = err as Error;
    void obs.error('wallet', 'Transfer record update failed', { error: e.message });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
