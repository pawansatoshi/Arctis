'use client';

import { useMemo, useState } from 'react';
import { CircleHelp, Volume2, X } from 'lucide-react';
import { usePathname } from 'next/navigation';

const GUIDE: Record<string, { title: string; text: string }> = {
  '/': { title: 'Welcome to ARCTIS', text: 'ARCTIS combines stablecoin-native DeFi, payments and an agentic economy on Arc. Connect your wallet, choose an action, review the details, then authorize in your wallet.' },
  '/dashboard': { title: 'Dashboard', text: 'Your dashboard is the control center. Review balances and activity, then open Transfer, Swap, Bridge or Agents for an action.' },
  '/transfer': { title: 'Transfer', text: 'Enter a recipient and USDC amount. Review the destination and network, then confirm in your wallet. A blockchain confirmation is the final success signal.' },
  '/swap': { title: 'Swap', text: 'Choose the supported token pair and amount. Review the quoted route and settlement details, then authorize the transaction in your wallet.' },
  '/bridge': { title: 'Bridge', text: 'Select the supported source and destination flow. Review the amount and network before authorizing. Bridge status should be treated as pending until verified.' },
  '/agents': { title: 'Agents', text: 'Agents can reason and prepare economic actions, but the wallet approval remains the authorization boundary. Review every proposal before signing.' },
};

export default function HelpGuide() {
  const pathname = usePathname() || '/';
  const [open, setOpen] = useState(false);
  const guide = useMemo(() => GUIDE[pathname] ?? { title: 'ARCTIS Help', text: 'Use the navigation to explore ARCTIS. Financial actions always require review and wallet authorization.' }, [pathname]);

  const speak = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(`${guide.title}. ${guide.text}`));
  };

  return (
    <div className="fixed bottom-5 right-5 z-[70]">
      {open && (
        <div className="mb-3 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-black/[0.08] bg-white/95 p-4 shadow-2xl backdrop-blur-xl dark:border-white/[0.1] dark:bg-surface-900/95">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-surface-950 dark:text-white">{guide.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-surface-600 dark:text-surface-300">{guide.text}</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close help" className="rounded-lg p-1 text-surface-500 hover:bg-black/[0.05] dark:hover:bg-white/[0.06]"><X className="h-4 w-4" /></button>
          </div>
          <button type="button" onClick={speak} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-700 dark:text-blue-300">
            <Volume2 className="h-4 w-4" /> Listen
          </button>
        </div>
      )}
      <button type="button" onClick={() => setOpen((value) => !value)} aria-label="How to use this page" aria-expanded={open} className="flex h-11 w-11 items-center justify-center rounded-full border border-black/[0.08] bg-white/90 text-surface-700 shadow-xl backdrop-blur-md transition hover:-translate-y-0.5 hover:shadow-2xl dark:border-white/[0.1] dark:bg-surface-900/90 dark:text-surface-200">
        <CircleHelp className="h-5 w-5" />
      </button>
    </div>
  );
}
