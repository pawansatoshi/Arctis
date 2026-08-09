'use client';

import { useCallback } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { AUTH_MESSAGE_PREFIX } from '@/lib/auth/verify';

function buildAuthMessage(walletAddress: string, nonce: string): string {
  return `${AUTH_MESSAGE_PREFIX}Wallet: ${walletAddress.toLowerCase()}\nNonce: ${nonce}`;
}

export function useWalletAuth() {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    if (!address) return { 'Content-Type': 'application/json' };
    const nonce = String(Date.now());
    const message = buildAuthMessage(address, nonce);
    const signature = await signMessageAsync({ message });
    return {
      'Content-Type': 'application/json',
      'x-wallet-address': address,
      'x-wallet-signature': signature,
      'x-wallet-nonce': nonce,
    };
  }, [address, signMessageAsync]);

  return { getAuthHeaders };
}
