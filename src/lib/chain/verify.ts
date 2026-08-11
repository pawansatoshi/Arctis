// ============================================================
// Server-side Transaction Verification
// Uses viem to verify on-chain — called from API routes only
// ============================================================
import { createPublicClient, parseUnits } from 'viem';
import { arcTestnet, arcTransport } from '@/lib/chain/arcChain';
import { PRIMARY_CONTRACT, TREASURY_WALLET, PRIMARY_DECIMALS, ERC20_ABI } from '@/lib/contracts';

let _client: ReturnType<typeof createPublicClient> | null = null;

function getClient() {
  if (!_client) {
    _client = createPublicClient({ chain: arcTestnet, transport: arcTransport });
  }
  return _client;
}

export interface VerificationResult {
  valid: boolean;
  reason?: string;
  blockNumber?: bigint;
  gasUsed?: bigint;
  from?: string;
}

/** Verify a USDC payment to the treasury. */
export async function verifyUSDCPayment(
  txHash: `0x${string}`,
  expectedAmountUSDC: number
): Promise<VerificationResult> {
  try {
    const client = getClient();
    const receipt = await client.getTransactionReceipt({ hash: txHash });

    if (receipt.status !== 'success') {
      return { valid: false, reason: 'Transaction reverted on-chain' };
    }

    const expectedAmount = parseUnits(expectedAmountUSDC.toString(), PRIMARY_DECIMALS);
    const usdcAddress = PRIMARY_CONTRACT.toLowerCase();
    const treasuryAddress = TREASURY_WALLET.toLowerCase();
    const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

    let transferFound = false;
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== usdcAddress) continue;
      try {
        if (log.topics[0]?.toLowerCase() !== transferTopic) continue;
        const to = `0x${log.topics[2]?.slice(26)}`.toLowerCase();
        const value = BigInt(log.data);
        if (to === treasuryAddress && value >= expectedAmount) {
          transferFound = true;
          break;
        }
      } catch { continue; }
    }

    if (!transferFound) {
      return { valid: false, reason: `No USDC Transfer of ${expectedAmountUSDC} USDC to treasury found in this transaction` };
    }

    const tx = await client.getTransaction({ hash: txHash });
    return { valid: true, blockNumber: receipt.blockNumber, gasUsed: receipt.gasUsed, from: tx.from };
  } catch (err) {
    const e = err as Error;
    return { valid: false, reason: `Verification error: ${e.message}` };
  }
}

/**
 * Verify a swap payment on Arc Testnet.
 *
 * Security invariant:
 *   txHash + token + recipient + sender + exact amount
 * must all match the authenticated swap request.
 *
 * Without sender binding, a caller could potentially reuse another user's
 * valid deposit transaction and receive that user's OTC settlement.
 */
export async function verifyTokenPayment(
  txHash: `0x${string}`,
  tokenContract: string,
  expectedRecipient: string,
  expectedAmountRaw: bigint,
  expectedSender?: string,
): Promise<VerificationResult> {
  try {
    const client = getClient();
    const receipt = await client.getTransactionReceipt({ hash: txHash });

    if (receipt.status !== 'success') {
      return { valid: false, reason: 'Transaction reverted on-chain' };
    }

    const tx = await client.getTransaction({ hash: txHash });
    const txSender = tx.from.toLowerCase();
    if (expectedSender && txSender !== expectedSender.toLowerCase()) {
      return { valid: false, reason: 'Transaction sender does not match the authenticated wallet' };
    }

    const tokenAddress = tokenContract.toLowerCase();
    const recipientAddress = expectedRecipient.toLowerCase();
    const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

    let transferFound = false;
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== tokenAddress) continue;
      try {
        if (log.topics[0]?.toLowerCase() !== transferTopic) continue;
        const from = `0x${log.topics[1]?.slice(26)}`.toLowerCase();
        const to = `0x${log.topics[2]?.slice(26)}`.toLowerCase();
        const value = BigInt(log.data);

        if (
          to === recipientAddress &&
          value === expectedAmountRaw &&
          (!expectedSender || from === expectedSender.toLowerCase())
        ) {
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
