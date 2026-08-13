'use client';

import { useEffect, useRef } from 'react';
import { announceTransactionState } from '@/lib/transaction/voice';

export function useTransactionVoice(state: 'idle' | 'network' | 'switching' | 'processing' | 'submitted' | 'success' | 'failed') {
  const previous = useRef(state);
  useEffect(() => {
    if (previous.current === state) return;
    previous.current = state;
    if (state === 'network') announceTransactionState('network');
    else if (state === 'switching') announceTransactionState('switching');
    else if (state === 'processing') announceTransactionState('processing');
    else if (state === 'submitted') announceTransactionState('submitted');
    else if (state === 'success') announceTransactionState('success');
    else if (state === 'failed') announceTransactionState('failed');
  }, [state]);
}
