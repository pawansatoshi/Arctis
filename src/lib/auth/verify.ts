// ============================================================
// Wallet Signature Verification — Server-side only
// Prevents anonymous API abuse without wallet auth.
//
// Nonce consumption: each nonce (wallet+timestamp) is stored in
// Firestore with a short TTL so it cannot be replayed within the
// 5-minute validity window even across serverless invocations.
// ============================================================
import { verifyMessage } from 'viem';
import { getAdminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

export const AUTH_MESSAGE_PREFIX = 'ARCTIS authenticate:\n';
const NONCE_WINDOW_MS = 5 * 60 * 1_000; // 5 minutes

/**
 * Build the message the client must sign.
 * Includes nonce (timestamp-based) to prevent replay attacks.
 */
export function buildAuthMessage(walletAddress: string, nonce: string): string {
  return `${AUTH_MESSAGE_PREFIX}Wallet: ${walletAddress.toLowerCase()}\nNonce: ${nonce}`;
}

/**
 * Consume a nonce atomically. Returns false if the nonce was already used.
 * Uses a Firestore document with a deterministic key (wallet+nonce) so that
 * concurrent requests cannot both succeed with the same signed message.
 */
async function consumeNonce(walletAddress: string, nonce: string): Promise<boolean> {
  try {
    const db = getAdminDb();
    const key = `${walletAddress.toLowerCase()}_${nonce}`;
    const ref = db.collection('used_nonces').doc(key);
    const snap = await ref.get();
    if (snap.exists) return false; // already consumed
    // Set with merge:false creates the doc only if it does not exist.
    // Firestore does not support conditional creates natively on the
    // Admin SDK, so we use a transaction to make it atomic.
    const consumed = await db.runTransaction(async (tx: FirebaseFirestore.Transaction) => {
      const txSnap = await tx.get(ref);
      if (txSnap.exists) return false;
      tx.set(ref, {
        walletAddress: walletAddress.toLowerCase(),
        nonce,
        consumedAt: FieldValue.serverTimestamp(),
        // TTL field for Firestore TTL policy (set expireAt ≥ now + window + buffer).
        expireAt: new Date(Date.now() + NONCE_WINDOW_MS + 60_000),
      });
      return true;
    });
    return consumed;
  } catch {
    // If Firestore is unavailable, fail closed — reject the request rather
    // than silently disabling replay protection.
    return false;
  }
}

/**
 * Verify an EIP-191 signature from a wallet and consume the nonce.
 * Returns valid: false if the signature is invalid, expired, or already used.
 */
export async function verifyWalletSignature(
  walletAddress: string,
  signature: `0x${string}`,
  nonce: string
): Promise<{ valid: boolean; reason?: string }> {
  // Validate nonce is a recent timestamp (within 5 minutes)
  const ts = parseInt(nonce, 10);
  if (isNaN(ts)) return { valid: false, reason: 'Invalid nonce format' };

  const age = Date.now() - ts;
  if (age > NONCE_WINDOW_MS) return { valid: false, reason: 'Signature expired (> 5 minutes)' };
  if (age < 0) return { valid: false, reason: 'Nonce from future' };

  const message = buildAuthMessage(walletAddress, nonce);

  try {
    const recovered = await verifyMessage({ address: walletAddress as `0x${string}`, message, signature });
    if (!recovered) return { valid: false, reason: 'Signature verification failed' };
  } catch (err) {
    const e = err as Error;
    return { valid: false, reason: `Signature error: ${e.message}` };
  }

  // Consume the nonce — must succeed for the request to be accepted.
  const consumed = await consumeNonce(walletAddress, nonce);
  if (!consumed) return { valid: false, reason: 'Nonce already used — obtain a fresh signature' };

  return { valid: true };
}
