// ============================================================
// ARCTIS Testnet OTC Swap Executor
// This route is intentionally Testnet-only. It must not inherit the
// browser's Mainnet selector because the OTC assets are test assets.
// ============================================================
import { createWalletClient, createPublicClient, parseUnits, formatUnits, http, defineChain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { TESTNET_NETWORK, ERC20_ABI } from '@/lib/contracts';
import type { SwapToken } from './types';

const TESTNET_CHAIN = defineChain({
  id: TESTNET_NETWORK.chainId,
  name: TESTNET_NETWORK.networkName,
  nativeCurrency: { decimals: 18, name: 'USDC', symbol: 'USDC' },
  rpcUrls: { default: { http: [TESTNET_NETWORK.rpc] }, public: { http: [TESTNET_NETWORK.rpc] } },
  blockExplorers: { default: { name: 'ArcScan', url: TESTNET_NETWORK.explorer } },
  testnet: true,
});

const TOKEN_DECIMALS: Record<SwapToken, number> = { USDC: 6, tUSDC: 6, tARC: 18 };
const TOKEN_CONTRACT: Record<SwapToken, `0x${string}`> = {
  USDC: TESTNET_NETWORK.contracts.USDC as `0x${string}`,
  tUSDC: TESTNET_NETWORK.contracts.tUSDC as `0x${string}`,
  tARC: TESTNET_NETWORK.contracts.tARC as `0x${string}`,
};

let _walletClient: ReturnType<typeof createWalletClient> | null = null;
let _publicClient: ReturnType<typeof createPublicClient> | null = null;

function getClients() {
  const pk = process.env.SWAP_WALLET_PRIVATE_KEY as `0x${string}` | undefined;
  if (!pk) throw new Error('SWAP_WALLET_PRIVATE_KEY not configured');

  if (!_walletClient) {
    const account = privateKeyToAccount(pk);
    _walletClient = createWalletClient({ account, chain: TESTNET_CHAIN, transport: http(TESTNET_NETWORK.rpc) });
  }
  if (!_publicClient) {
    _publicClient = createPublicClient({ chain: TESTNET_CHAIN, transport: http(TESTNET_NETWORK.rpc) });
  }
  return { walletClient: _walletClient, publicClient: _publicClient };
}

export function getSwapWalletAddress(): string {
  const pk = process.env.SWAP_WALLET_PRIVATE_KEY as `0x${string}` | undefined;
  if (!pk) throw new Error('SWAP_WALLET_PRIVATE_KEY not configured');
  return privateKeyToAccount(pk).address;
}

export interface DispatchResult {
  success: boolean;
  txHash?: string;
  reason?: string;
}

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

export async function dispatchSwapOutput(
  toAddress: string,
  token: SwapToken,
  amount: number
): Promise<DispatchResult> {
  try {
    const { walletClient, publicClient } = getClients();
    const amountRaw = parseUnits(amount.toFixed(TOKEN_DECIMALS[token]), TOKEN_DECIMALS[token]);

    const hash = await walletClient.writeContract({
      address: TOKEN_CONTRACT[token],
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [toAddress as `0x${string}`, amountRaw],
      chain: TESTNET_CHAIN,
      account: walletClient.account!,
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') {
      return { success: false, txHash: hash, reason: 'Swap output transaction reverted on-chain.' };
    }

    return { success: true, txHash: hash };
  } catch (err) {
    return { success: false, reason: (err as Error).message };
  }
}
