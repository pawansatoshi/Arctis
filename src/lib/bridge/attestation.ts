import { CCTP_FEES_API, CCTP_STATUS_API } from '@/lib/contracts';
import type { AttestationMessage, BridgeFeeResponse } from './types';
import { ATTESTATION_POLL_INTERVAL, ATTESTATION_MAX_WAIT } from './types';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchBridgeFee(srcDomain: number, dstDomain: number): Promise<BridgeFeeResponse> {
  const res = await fetch(CCTP_FEES_API(srcDomain, dstDomain), { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`Iris fee API ${res.status}`);
  const data = await res.json();
  const tiers = Array.isArray(data) ? data : [data];
  const fastest = tiers.sort((a: BridgeFeeResponse, b: BridgeFeeResponse) =>
    (a.finalityThreshold ?? 0) - (b.finalityThreshold ?? 0)
  )[0];
  return { finalityThreshold: fastest?.finalityThreshold ?? 1000, minimumFee: fastest?.minimumFee ?? 0 };
}

export async function checkAttestationStatus(srcDomain: number, burnTxHash: string): Promise<AttestationMessage> {
  const res = await fetch(CCTP_STATUS_API(srcDomain, burnTxHash), { signal: AbortSignal.timeout(8000) });
  if (res.status === 404) return { status: 'pending_confirmations' };
  if (!res.ok) throw new Error(`Iris status API ${res.status}`);
  const data = await res.json();
  return data.messages?.[0] ?? { status: 'pending_confirmations' };
}

export async function pollAttestation(
  srcDomain: number,
  burnTxHash: string,
  maxWait: number = ATTESTATION_MAX_WAIT,
): Promise<{ forwardTxHash: string }> {
  const deadline = Date.now() + maxWait;
  let errors = 0;

  while (Date.now() < deadline) {
    try {
      const result = await checkAttestationStatus(srcDomain, burnTxHash);
      errors = 0;

      if (result.status === 'complete') {
        if (!result.forwardTxHash) { await sleep(ATTESTATION_POLL_INTERVAL); continue; }
        return { forwardTxHash: result.forwardTxHash };
      }
      if (result.status === 'failed') throw new Error('Attestation failed');
      await sleep(ATTESTATION_POLL_INTERVAL);
    } catch (err) {
      errors++;
      if (errors >= 3) throw err;
      await sleep(1000 * 2 ** (errors - 1));
    }
  }
  throw new Error('TIMEOUT');
}
