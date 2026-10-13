// ============================================================
// Wallet Signature Verification — SERVER ONLY
//
// This file imports firebase-admin and 'server-only'.
// It must NEVER be imported by client components or hooks.
// Client-safe constants live in verify.ts.
//
// Nonce consumption: each nonce (wallet+timestamp) is stored
// in Firestore with a short TTL so it cannot be replayed within
// the 5-minute validity window, even across serverless instances.
// ============================================================
import 'server-only';
import { verifyMessage } from 'viem';
import { getAdminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { buildAuthMessage } from './verify';

const NONCE_WINDOW_MS = 5 * 60 * 1_000; // 5 minutes

/**
 * Consume a nonce atomically using a Firestore transaction.
 * Returns false if the nonce was already used — callers must
 * treat false as an authentication failure (fail closed).
 *
 * Concurrency note: the Firestore transaction serialises concurrent
 * requests with the same signed message across all serverless
 * instances. Only the first one through the transaction wins.
 */
async function consumeNonce(walletAddress: string, nonce: string): Promise<boolean> {
  try {
    const db = getAdminDb();
    const key = `${walletAddress.toLowerCase()}_${nonce}`;
    const ref = db.collection('used_nonces').doc(key);

    return await db.runTransaction(async (tx: FirebaseFirestore.Transaction) => {
      const snap = await tx.get(ref);
      if (snap.exists) return false; // already consumed — replay attempt
      tx.set(ref, {
        walletAddress: walletAddress.toLowerCase(),
        nonce,
        consumedAt: FieldValue.serverTimestamp(),
        // TTL field — configure a Firestore TTL policy on `used_nonces.expireAt`
        // to auto-delete documents after the validity window closes.
        expireAt: new Date(Date.now() + NONCE_WINDOW_MS + 60_000),
      });
      return true;
    });
  } catch {
    // Fail closed: if Firestore is unavailable, reject the request
    // rather than silently disabling replay protection.
    return false;
  }
}

/**
 * Verify an EIP-191 wallet signature and atomically consume its nonce.
 *
 * Returns { valid: false } if the signature is invalid, the nonce is
 * expired or from the future, or the nonce has already been used.
 * Server-side only — never call from client components.
 */
export async function verifyWalletSignature(
  walletAddress: string,
  signature: `0x${string}`,
  nonce: string
): Promise<{ valid: boolean; reason?: string }> {
  // 1. Validate nonce is a recent timestamp
  const ts = parseInt(nonce, 10);
  if (isNaN(ts)) return { valid: false, reason: 'Invalid nonce format' };

  const age = Date.now() - ts;
  if (age > NONCE_WINDOW_MS) return { valid: false, reason: 'Signature expired (> 5 minutes)' };
  if (age < 0)               return { valid: false, reason: 'Nonce from future' };

  // 2. Verify the EIP-191 signature
  const message = buildAuthMessage(walletAddress, nonce);
  try {
    const recovered = await verifyMessage({
      address: walletAddress as `0x${string}`,
      message,
      signature,
    });
    if (!recovered) return { valid: false, reason: 'Signature verification failed' };
  } catch (err) {
    const e = err as Error;
    return { valid: false, reason: `Signature error: ${e.message}` };
  }

  // 3. Consume the nonce — must succeed atomically for the request to be accepted
  const consumed = await consumeNonce(walletAddress, nonce);
  if (!consumed) return { valid: false, reason: 'Nonce already used — obtain a fresh signature' };

  return { valid: true };
}
