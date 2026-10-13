// ============================================================
// Wallet Auth — Shared constants (client + server safe)
//
// This file is imported by both client hooks (useWalletAuth.ts)
// and server-side code, so it MUST NOT import server-only
// modules (firebase-admin, 'server-only', etc.).
//
// All server-side signature verification (including nonce
// consumption against Firestore) lives in verify.server.ts,
// which is never imported by client bundles.
// ============================================================

export const AUTH_MESSAGE_PREFIX = 'ARCTIS authenticate:\n';

/**
 * Build the message the client must sign.
 * Includes nonce (timestamp-based) to prevent replay attacks.
 */
export function buildAuthMessage(walletAddress: string, nonce: string): string {
  return `${AUTH_MESSAGE_PREFIX}Wallet: ${walletAddress.toLowerCase()}\nNonce: ${nonce}`;
}
