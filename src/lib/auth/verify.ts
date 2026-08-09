// ============================================================
// Wallet Signature Verification — Server-side only
// Prevents anonymous API abuse without wallet auth
// ============================================================
import { verifyMessage } from 'viem';

export const AUTH_MESSAGE_PREFIX = 'ARCTIS authenticate:\n';

/**
 * Build the message the client must sign.
 * Includes nonce (timestamp-based) to prevent replay attacks.
 */
export function buildAuthMessage(walletAddress: string, nonce: string): string {
  return `${AUTH_MESSAGE_PREFIX}Wallet: ${walletAddress.toLowerCase()}\nNonce: ${nonce}`;
}

/**
 * Verify an EIP-191 signature from a wallet.
 * Returns true if the signature is valid and recent (within 5 minutes).
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
  if (age > 5 * 60 * 1000) return { valid: false, reason: 'Signature expired (> 5 minutes)' };
  if (age < 0) return { valid: false, reason: 'Nonce from future' };

  const message = buildAuthMessage(walletAddress, nonce);

  try {
    const recovered = await verifyMessage({ address: walletAddress as `0x${string}`, message, signature });
    if (!recovered) return { valid: false, reason: 'Signature verification failed' };
    return { valid: true };
  } catch (err) {
    const e = err as Error;
    return { valid: false, reason: `Signature error: ${e.message}` };
  }
}
