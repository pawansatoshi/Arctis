// ============================================================
// Server-side transaction verification. Every payment is bound to
// an explicit network, token, recipient, and authenticated sender.
// ============================================================
import { createPublicClient, http, parseUnits } from 'viem';
import { arcTestnet, arcMainnet } from '@/lib/chain/arcChain';
import { MAINNET_NETWORK, TESTNET_NETWORK, type NetworkEnv } from '@/lib/contracts';

const clients = {
  testnet: createPublicClient({ chain: arcTestnet, transport: http(TESTNET_NETWORK.rpc) }),
  mainnet: createPublicClient({ chain: arcMainnet, transport: http(MAINNET_NETWORK.rpc) }),
} as const;

const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

export interface VerificationResult {
  valid: boolean;
  reason?: string;
  blockNumber?: bigint;
  gasUsed?: bigint;
  from?: string;
}

function isAddress(value: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(value);
}

/** Verify an ERC-20 USDC payment on the caller-selected Arc network. */
export async function verifyUSDCPayment(
  txHash: `0x${string}`,
  expectedAmountUSDC: number,
  network: NetworkEnv,
  expectedSender: string,
): Promise<VerificationResult> {
  try {
    if (network !== 'testnet' && network !== 'mainnet') {
      return { valid: false, reason: 'Unsupported network' };
    }
    if (!isAddress(expectedSender)) {
      return { valid: false, reason: 'A valid authenticated sender address is required' };
    }
    if (!Number.isFinite(expectedAmountUSDC) || expectedAmountUSDC <= 0) {
      return { valid: false, reason: 'Expected payment amount must be positive' };
    }

    // Never use an unverified fallback treasury for real mainnet payments.
    const treasury = network === 'mainnet'
      ? process.env.NEXT_PUBLIC_ARCTIS_MAINNET_TREASURY
      : TESTNET_NETWORK.treasury;
    if (!treasury || !isAddress(treasury) || /^0x0{40}$/i.test(treasury)) {
      return { valid: false, reason: 'Treasury is not explicitly configured for this network' };
    }

    const profile = network === 'mainnet' ? MAINNET_NETWORK : TESTNET_NETWORK;
    const client = clients[network];
    const receipt = await client.getTransactionReceipt({ hash: txHash });
    if (receipt.status !== 'success') {
      return { valid: false, reason: 'Transaction reverted on-chain' };
    }

    const tx = await client.getTransaction({ hash: txHash });
    if (tx.chainId !== profile.chainId) {
      return { valid: false, reason: 'Transaction chain does not match the selected network' };
    }
    if (tx.from.toLowerCase() !== expectedSender.toLowerCase()) {
      return { valid: false, reason: 'Transaction sender does not match the authenticated wallet' };
    }

    const expectedAmount = parseUnits(expectedAmountUSDC.toString(), profile.decimals.USDC);
    const tokenAddress = profile.contracts.USDC.toLowerCase();
    const treasuryAddress = treasury.toLowerCase();
    const senderAddress = expectedSender.toLowerCase();

    let transferFound = false;
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== tokenAddress) continue;
      if (log.topics[0]?.toLowerCase() !== TRANSFER_TOPIC) continue;
      if (!log.topics[1] || !log.topics[2]) continue;
      try {
        const from = `0x${log.topics[1].slice(-40)}`.toLowerCase();
        const to = `0x${log.topics[2].slice(-40)}`.toLowerCase();
        const value = BigInt(log.data);
        if (from === senderAddress && to === treasuryAddress && value === expectedAmount) {
          transferFound = true;
          break;
        }
      } catch {
        continue;
      }
    }

    if (!transferFound) {
      return {
        valid: false,
        reason: `No exact USDC payment of ${expectedAmountUSDC} USDC from the authenticated wallet to the configured treasury was found on ${profile.networkName}`,
      };
    }

    return { valid: true, blockNumber: receipt.blockNumber, gasUsed: receipt.gasUsed, from: tx.from };
  } catch (err) {
    const e = err as Error;
    return { valid: false, reason: `Verification error: ${e.message}` };
  }
}

/** Swap settlement verification remains Testnet-only until production routing is audited. */
export async function verifyTokenPayment(
  txHash: `0x${string}`,
  tokenContract: string,
  expectedRecipient: string,
  expectedAmountRaw: bigint,
  expectedSender?: string,
): Promise<VerificationResult> {
  try {
    const client = clients.testnet;
    const receipt = await client.getTransactionReceipt({ hash: txHash });
    if (receipt.status !== 'success') return { valid: false, reason: 'Transaction reverted on-chain' };

    const tx = await client.getTransaction({ hash: txHash });
    if (expectedSender && tx.from.toLowerCase() !== expectedSender.toLowerCase()) {
      return { valid: false, reason: 'Transaction sender does not match the authenticated wallet' };
    }

    const tokenAddress = tokenContract.toLowerCase();
    const recipientAddress = expectedRecipient.toLowerCase();
    let transferFound = false;
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== tokenAddress || log.topics[0]?.toLowerCase() !== TRANSFER_TOPIC) continue;
      if (!log.topics[1] || !log.topics[2]) continue;
      try {
        const from = `0x${log.topics[1].slice(-40)}`.toLowerCase();
        const to = `0x${log.topics[2].slice(-40)}`.toLowerCase();
        if (to === recipientAddress && BigInt(log.data) === expectedAmountRaw &&
            (!expectedSender || from === expectedSender.toLowerCase())) {
          transferFound = true;
          break;
        }
      } catch { continue; }
    }
    if (!transferFound) {
      return { valid: false, reason: 'Expected exact token Transfer from the authenticated wallet to the swap wallet was not found' };
    }
    return { valid: true, blockNumber: receipt.blockNumber, gasUsed: receipt.gasUsed, from: tx.from };
  } catch (err) {
    const e = err as Error;
    return { valid: false, reason: `Verification error: ${e.message}` };
  }
}
