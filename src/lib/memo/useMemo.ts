'use client';

import { useCallback } from 'react';

// Activity/memo recording is intentionally off-chain. A previous implementation
// called a memo smart contract from this hook, which caused a second wallet
// confirmation and a second blockchain transaction after successful Transfer,
// Swap, Bridge, Credits, and Membership actions. Financial execution must remain
// one user-approved transaction path; memo/activity recording belongs in the
// server-side database only.
export function useMemo() {
  const dispatchMemo = useCallback(async (_memoData: `0x${string}`) => {
    return;
  }, []);

  return { dispatchMemo };
}
