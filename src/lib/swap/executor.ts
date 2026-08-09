// ============================================================
// Swap Executor — OTC settlement, server-signed dispatch
// Uses a dedicated Swap Wallet (SWAP_WALLET_PRIVATE_KEY), never
// the Treasury Wallet. Treasury remains observer-only per the
// locked separation rule — logTreasuryEvent() is called by the
// API route AFTER settlement, never by this executor.
// ============================================================
import { createWalletClient, createPublicClient, parseUnits, formatUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arcTestnet, arcTransport } from '@/lib/chain/arcChain';
import { CONTRACTS, ERC20_ABI } from '@/lib/contracts';
import type { SwapToken } from './types';

let _walletClient: ReturnType<typeof createWalletClient> | null = null;
let _publicClient: ReturnType<typeof createPublicClient> | null = null;

function getClients() {
  const pk = process.env.SWAP_WALLET_PRIVATE_KEY as `0x${string}` | undefined;
  if (!pk) throw new Error('SWAP_WALLET_PRIVATE_KEY not configured');

  if (!_walletClient) {
    const account = privateKeyToAccount(pk);
    _walletClient = createWalletClient({ account, chain: arcTestnet, transport: arcTransport });
  }
  if (!_publicClient) {
    _publicClient = createPublicClient({ chain: arcTestnet, transport: arcTransport });
  }
  return { walletClient: _walletClient, publicClient: _publicClient };
}

export function getSwapWalletAddress(): string {
  const pk = process.env.SWAP_WALLET_PRIVATE_KEY as `0x${string}` | undefined;
  if (!pk) throw new Error('SWAP_WALLET_PRIVATE_KEY not configured');
  return privateKeyToAccount(pk).address;
}

const TOKEN_DECIMALS: Record<SwapToken, number> = { USDC: 6, tUSDC: 6, tARC: 18 };
const TOKEN_CONTRACT: Record<SwapToken, `0x${string}`> = {
  USDC: CONTRACTS.USDC as `0x${string}`,
  tUSDC: CONTRACTS.tUSDC as `0x${string}`,
  tARC: CONTRACTS.tARC as `0x${string}`,
};

export interface DispatchResult {
  success: boolean;
  txHash?: string;
  reason?: string;
}

/**
 * Checks the swap wallet's on-chain balance of a given token.
 * Used by the quote route to warn the user before they sign
 * the inbound transfer if the swap wallet cannot fulfil the route.
 */
export async function getSwapWalletReserve(token: SwapToken): Promise<number> {
  const { publicClient } = getClients();
  const address = getSwapWalletAddress();
  const balance = await publicClient.readContract({
    address: TOKEN_CONTRACT[token],
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address as `0x${string}`],
  }) as bigint;
  return parseFloat(formatUnits(balance, TOKEN_DECIMALS[token]));
}

/**
 * Dispatches the output token from the swap wallet to the user.
 * This is the OTC settlement leg — real on-chain transfer, real
 * reserves, no simulation.
 */
export async function dispatchSwapOutput(
  toAddress: string,
  token: SwapToken,
  amount: number
): Promise<DispatchResult> {
  try {
    const { walletClient } = getClients();
    const amountRaw = parseUnits(amount.toFixed(TOKEN_DECIMALS[token]), TOKEN_DECIMALS[token]);

    const hash = await walletClient.writeContract({
      address: TOKEN_CONTRACT[token],
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [toAddress as `0x${string}`, amountRaw],
      chain: arcTestnet,
      account: walletClient.account!,
    });

    return { success: true, txHash: hash };
  } catch (err) {
    return { success: false, reason: (err as Error).message };
  }
}
