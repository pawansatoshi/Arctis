// ============================================================
// API Auth Middleware — Wallet signature verification helpers
// Called from credit/membership/agent API routes
// ============================================================
import { type NextRequest, NextResponse } from 'next/server';
import { verifyWalletSignature } from '@/lib/auth/verify';

export type AuthResult =
  | { ok: true; walletAddress: string }
  | { ok: false; response: NextResponse };

/**
 * Verify a wallet-signed request.
 * Expects headers:
 *   x-wallet-address: 0x...
 *   x-wallet-signature: 0x...
 *   x-wallet-nonce: <timestamp>
 *
 * @param strict  When true, rejects requests without signature headers.
 *                Use for routes with client-side signing already wired (e.g. Passport).
 *                When false (default), allows unsigned requests for backward compatibility.
 */
export async function verifyApiWallet(
  req: NextRequest,
  bodyWalletAddress?: string,
  strict = false
): Promise<{ ok: boolean; walletAddress: string; reason?: string }> {
  const headerWallet = req.headers.get('x-wallet-address');
  const signature   = req.headers.get('x-wallet-signature') as `0x${string}` | null;
  const nonce       = req.headers.get('x-wallet-nonce');

  const walletAddress = (headerWallet ?? bodyWalletAddress ?? '').toLowerCase();

  if (!walletAddress) {
    return { ok: false, walletAddress: '', reason: 'No wallet address provided' };
  }

  // If signature headers present, verify them
  if (signature && nonce && headerWallet) {
    const result = await verifyWalletSignature(headerWallet, signature, nonce);
    if (!result.valid) {
      return { ok: false, walletAddress, reason: result.reason };
    }
    return { ok: true, walletAddress };
  }

  if (strict) {
    return { ok: false, walletAddress, reason: 'Wallet signature required' };
  }

  // No signature — allow but log (graceful mode; will enforce after SIWE client integration)
  return { ok: true, walletAddress };
}

/**
 * Validate that walletAddress matches a basic Ethereum address format.
 */
export function isValidEthAddress(addr: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(addr);
}
