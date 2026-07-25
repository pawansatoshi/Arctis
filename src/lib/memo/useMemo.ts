'use client';

import { useCallback } from 'react';
import { useWriteContract } from 'wagmi';
import { getMemoCallConfig, isMemoEnabled } from '@/lib/memo/service';

export function useMemo() {
  const { writeContractAsync } = useWriteContract();

  const dispatchMemo = useCallback(async (memoData: `0x${string}`) => {
    if (!isMemoEnabled()) return;
    try {
      const config = getMemoCallConfig(memoData);
      await writeContractAsync({ address: config.address, abi: config.abi, functionName: config.functionName, args: config.args });
    } catch {
      // Memo failures are intentionally silent — never block or surface to the user
    }
  }, [writeContractAsync]);

  return { dispatchMemo };
}
