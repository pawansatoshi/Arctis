// ============================================================
// Server-side Transaction Verification
// Uses viem to verify on-chain — called from API routes only
// ============================================================
import { createPublicClient, parseUnits, type Log } from 'viem';
import { arcTestnet, arcTransport } from '@/lib/chain/wagmi';
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

/**
 * Verify a USDC payment to treasury.
 * Checks: tx exists, status=success, recipient=TREASURY_WALLET,
 * ERC-20 Transfer event present with correct amount.
 */
export async function verifyUSDCPayment(
  txHash: `0x${string}`,
  expectedAmountUSDC: number
): Promise<VerificationResult> {
  try {
    const client = getClient();

    // Fetch receipt — will throw if hash doesn't exist
    const receipt = await client.getTransactionReceipt({ hash: txHash });

    if (receipt.status !== 'success') {
      return { valid: false, reason: 'Transaction reverted on-chain' };
    }

    // Parse Transfer event logs from the USDC contract
    const expectedAmount = parseUnits(expectedAmountUSDC.toString(), PRIMARY_DECIMALS);
    const usdcAddress = PRIMARY_CONTRACT.toLowerCase();
    const treasuryAddress = TREASURY_WALLET.toLowerCase();

    let transferFound = false;
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== usdcAddress) continue;
      try {
        // ERC-20 Transfer topic: keccak256("Transfer(address,address,uint256)")
        const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
        if (log.topics[0]?.toLowerCase() !== TRANSFER_TOPIC) continue;

        // topics[1] = from (padded), topics[2] = to (padded), data = value
        const to = `0x${log.topics[2]?.slice(26)}`.toLowerCase();
        const value = BigInt(log.data);

        if (to === treasuryAddress && value >= expectedAmount) {
          transferFound = true;
          break;
        }
      } catch { continue; }
    }

    if (!transferFound) {
      return {
        valid: false,
        reason: `No USDC Transfer of ${expectedAmountUSDC} USDC to treasury found in this transaction`,
      };
    }

    // Fetch tx to get from address
    const tx = await client.getTransaction({ hash: txHash });

    return {
      valid: true,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed,
      from: tx.from,
    };
  } catch (err) {
    const e = err as Error;
    return { valid: false, reason: `Verification error: ${e.message}` };
  }
}

/**
 * Generalized token payment verification — for any ERC-20 token and
 * any recipient (not just Treasury). Used by Swap, where the inbound
 * token varies (USDC/tUSDC/tARC) and the recipient is the Swap Wallet,
 * not the Treasury Wallet. Additive to verifyUSDCPayment; does not
 * modify or replace it.
 */
export async function verifyTokenPayment(
  txHash: `0x${string}`,
  tokenContract: string,
  expectedRecipient: string,
  expectedAmountRaw: bigint
): Promise<VerificationResult> {
  try {
    const client = getClient();
    const receipt = await client.getTransactionReceipt({ hash: txHash });

    if (receipt.status !== 'success') {
      return { valid: false, reason: 'Transaction reverted on-chain' };
    }

    const tokenAddress = tokenContract.toLowerCase();
    const recipientAddress = expectedRecipient.toLowerCase();
    const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

    let transferFound = false;
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== tokenAddress) continue;
      try {
        if (log.topics[0]?.toLowerCase() !== TRANSFER_TOPIC) continue;
        const to = `0x${log.topics[2]?.slice(26)}`.toLowerCase();
        const value = BigInt(log.data);
        if (to === recipientAddress && value >= expectedAmountRaw) {
          transferFound = true;
          break;
        }
      } catch { continue; }
    }

    if (!transferFound) {
      return { valid: false, reason: 'Expected token Transfer to recipient not found in this transaction' };
    }

    const tx = await client.getTransaction({ hash: txHash });
    return { valid: true, blockNumber: receipt.blockNumber, gasUsed: receipt.gasUsed, from: tx.from };
  } catch (err) {
    const e = err as Error;
    return { valid: false, reason: `Verification error: ${e.message}` };
  }
}
